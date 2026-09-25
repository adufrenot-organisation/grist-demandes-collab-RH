const VERSION="V1.43";
const T={requests:"Demandes_RH",resources:"Ressources",motifs:"Motifs_RH",admins:"ADMIN_PORTAIL",labels:"PARAM_LIBELLES",managerResources:"Managers_Ressources"};
const S={user:null,person:null,requests:[],myRequests:[],allRequests:[],motifs:[],resources:[],editing:null,motifEditing:null,isOwner:false,isAdmin:false,accessLevel:"",labels:[],labelsReady:false,managerLinks:[],managedResources:[],viewAs:null};
const SYNC={host:"",cockpitDocId:"",apiKey:""};
function syncConfig(){
  // Configuration utilisateur/session uniquement. Ne jamais embarquer une clé maître dans le code.
  // Pour une installation Grist autorisant l'API avec les droits propres de l'utilisateur,
  // adapter authHeaders() à votre mécanisme SSO/proxy. Une clé saisie ici reste optionnelle
  // et ne doit être qu'une clé personnelle aux droits minimaux.
  try{return {...SYNC,...JSON.parse(sessionStorage.getItem("rh_sync_config")||"{}")}}catch{return {...SYNC}}
}
function authHeaders(){
  const c=syncConfig(),h={"Content-Type":"application/json"};
  if(c.apiKey)h.Authorization=`Bearer ${c.apiKey}`;
  return h;
}
async function remote(path,opt={}){
  const c=syncConfig(); if(!c.host||!c.cockpitDocId)throw new Error("Synchronisation Cockpit non configurée.");
  const r=await fetch(`${c.host.replace(/\/$/,"")}/api${path}`,{method:opt.method||"GET",headers:authHeaders(),body:opt.body?JSON.stringify(opt.body):undefined});
  if(!r.ok)throw new Error(`Sync Cockpit ${r.status}: ${await r.text()}`);
  return r.status===204?null:r.json();
}
async function remoteRecords(tableName){
  const c=syncConfig();
  return (await remote(`/docs/${encodeURIComponent(c.cockpitDocId)}/tables/${encodeURIComponent(tableName)}/records`)).records||[];
}
function setSyncState(state,detail=""){
  const s=$("syncState"),l=$("syncLast"),d=$("syncDot");
  if(!s||!l||!d)return;
  if(state==="busy"){s.textContent="Synchronisation…";d.className="busy";l.textContent=detail||"Échanges en cours";}
  else if(state==="ok"){s.textContent="Synchronisé";d.className="ok";l.textContent=detail||`Dernière synchro : ${new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}`;}
  else if(state==="off"){s.textContent="Sync non configurée";d.className="off";l.textContent=detail||"Configurer la connexion Cockpit";}
  else {s.textContent="Erreur de synchro";d.className="err";l.textContent=detail||"Consulter la configuration";}
}
async function syncAll(reason="manual"){
  const c=syncConfig();
  if(!c.host||!c.cockpitDocId){setSyncState("off");return false}
  setSyncState("busy",reason==="startup"?"Mise à jour à l’ouverture":"Mise à jour en cours");
  try{
    await syncFromCockpit();
    setSyncState("ok");
    return true;
  }catch(e){
    console.warn("Synchronisation Cockpit indisponible:",e);
    setSyncState("err",e?.message||String(e));
    return false;
  }
}
async function syncFromCockpit(){
  const c=syncConfig(); if(!c.host||!c.cockpitDocId)return;
  // Important: cette lecture ne doit réussir que si les ACL/API du Cockpit l'autorisent pour cet utilisateur.
  const [team,remoteReq]=await Promise.all([remoteRecords("Team"),remoteRecords("Demandes_RH")]);
  const localRes=await table(T.resources), localReq=await table(T.requests);
  const rt=grist.getTable(T.resources), rq=grist.getTable(T.requests);
  for(const x of team){
    const f=x.fields||{},mail=email(f.Email); if(!mail)continue;
    const d=localRes.find(r=>email(F(r,"Email"))===mail);
    const fields={UUID_Ressource:f.UUID_Ressource||"",Email:f.Email,Nom:f.Nom,Profil:f.Profil,Actif:f.Actif,Source_Team_ID:x.id,Derniere_Sync:Math.floor(Date.now()/1000),Erreur_Sync:""};
    if(d) await rt.update({id:d.id,fields}); else await rt.create({fields});
  }
  for(const x of remoteReq){
    const f=x.fields||{},uuid=norm(f.UUID_Demande); if(!uuid)continue;
    const d=localReq.find(r=>norm(F(r,"UUID_Demande"))===uuid); if(!d)continue;
    await rq.update({id:d.id,fields:{Statut:f.Statut||F(d,"Statut"),Manager_Email:f.Manager_Email||"",Commentaire_Manager:f.Commentaire_Manager||"",Date_Decision:f.Date_Decision||null}});
  }
}
async function syncRequestToCockpit(localId){
  const c=syncConfig(); if(!c.host||!c.cockpitDocId)return;
  const localReq=(await table(T.requests)).find(r=>r.id===localId); if(!localReq)return;
  const localRes=(await table(T.resources)).find(r=>r.id===rid(F(localReq,"Demandeur"))); if(!localRes)return;
  const [teams,motifs,reqs]=await Promise.all([remoteRecords("Team"),remoteRecords("Motifs_RH"),remoteRecords("Demandes_RH")]);
  const person=teams.find(x=>email(x.fields?.Email)===email(F(localRes,"Email"))); if(!person)throw new Error("Ressource absente du Cockpit.");
  const code=norm(F(localReq,"Motif_Code")); const motif=motifs.find(x=>norm(x.fields?.Code)===code);
  if(!motif)throw new Error(`Motif '${code}' absent du Cockpit.`);
  const uuid=norm(F(localReq,"UUID_Demande")), found=reqs.find(x=>norm(x.fields?.UUID_Demande)===uuid);
  const fields={Reference:F(localReq,"Reference"),Demandeur:person.id,Type:F(localReq,"Type"),Date_Debut:F(localReq,"Date_Debut"),Date_Fin:F(localReq,"Date_Fin"),Motif:motif.id,Commentaire_Demandeur:F(localReq,"Commentaire_Demandeur"),Date_Demande:F(localReq,"Date_Demande"),UUID_Demande:uuid};
  if(!found)fields.Statut=F(localReq,"Statut")||"EN_ATTENTE";
  const path=`/docs/${encodeURIComponent(c.cockpitDocId)}/tables/Demandes_RH/records`;
  if(found) await remote(path,{method:"PATCH",body:{records:[{id:found.id,fields}]}});
  else await remote(path,{method:"POST",body:{records:[{fields}]}});
  const currentVersion=Number(F(localReq,"Version_Sync")||0);
  await grist.getTable(T.requests).update({id:localId,fields:{Date_Modification:Math.floor(Date.now()/1000),Version_Sync:Math.max(1,currentVersion+1)}});
  setSyncState("ok","Demande envoyée au Cockpit");
}

const $=x=>document.getElementById(x), norm=x=>String(x??"").trim(), email=x=>norm(x).toLowerCase();
const F=(r,...ks)=>{for(const k of ks)if(r?.[k]!==undefined)return r[k]};
const rid=v=>Number(Array.isArray(v)?v[1]:(v?.id??v??0))||0;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ep=d=>Math.floor(new Date(d+"T00:00:00").getTime()/1000), st=r=>norm(F(r,"Statut")||"EN_ATTENTE").toUpperCase();
const dt=v=>v?new Date(Number(v)*1000).toLocaleDateString("fr-FR"):"—";
function rows(t){const ids=t.id||[];return ids.map((id,i)=>{const r={id};for(const k of Object.keys(t))if(k!=="id")r[k]=t[k]?.[i];return r})}
async function table(name){return rows(await grist.docApi.fetchTable(name))}
async function identify(){
  const rr=(await table(T.resources)).filter(r=>F(r,"Actif","actif")!==false);

  // Owner : le bootstrap ADMIN_PORTAIL reste prioritaire et ne dépend pas
  // du nombre de ressources rendues visibles par les ACL.
  if(S.isOwner && rr.length!==1){
    S.person=null;
    S.user={email:S.ownerBootstrap?.email||"",name:S.ownerBootstrap?.name||"Owner"};
    return;
  }

  if(rr.length===0){
    throw new Error("Aucune ressource autorisée pour cet utilisateur.");
  }

  // Cas historique collaborateur : une seule ligne Ressources visible.
  if(rr.length===1){
    S.person=rr[0];
  } else {
    // Cas Manager : les ACL peuvent légitimement rendre visibles le manager
    // ET ses ressources. On identifie alors la ligne du manager grâce à
    // Managers_Ressources, sans exiger que Ressources ne contienne qu'une ligne.
    let links=[];
    try{
      links=(await table(T.managerResources)).filter(r=>F(r,"Actif")!==false);
    }catch(e){
      console.warn("Managers_Ressources indisponible pendant l’identification:",e);
    }

    const visibleIds=new Set(rr.map(r=>Number(r.id)));
    const managerIds=[...new Set(
      links.map(r=>rid(F(r,"Manager"))).filter(id=>id && visibleIds.has(Number(id)))
    )];

    if(managerIds.length===1){
      S.person=rr.find(r=>Number(r.id)===Number(managerIds[0]))||null;
    }

    if(!S.person){
      throw new Error("Impossible d’identifier la ressource connectée : plusieurs lignes Ressources sont visibles et aucun manager unique n’est identifiable dans Managers_Ressources.");
    }
  }

  const mail=norm(F(S.person,"Email","email"));
  S.user={email:mail,name:norm(F(S.person,"Nom","nom"))||mail||"Collaborateur"};
}
async function load(){
  const [q,m,res]=await Promise.all([table(T.requests),table(T.motifs),table(T.resources)]);
  S.motifs=m; S.resources=res;
  S.isAdmin=norm(F(S.person,"Profil","profil")).toUpperCase()==="ADMIN";
  $("adminNav")?.classList.toggle("hidden",!(S.isAdmin||S.isOwner));
  document.querySelectorAll(".owner-only").forEach(el=>el.classList.toggle("hidden",!S.isOwner));
  S.allRequests=q;
  S.myRequests=S.person?q.filter(r=>rid(F(r,"Demandeur"))===Number(S.person.id)):[];
  // Sécurité : q ne contient que ce que les ACL Grist autorisent réellement.
  // ADMIN voit tout q ; tous les autres profils restent limités à leurs propres demandes.
  S.requests=S.isAdmin?q:S.myRequests;
  $("allRequestsNav")?.classList.toggle("hidden",!(S.isAdmin||S.isOwner));
  render();
  applyLabels();
}
function motifName(id){const r=S.motifs.find(x=>x.id===id);return r?norm(F(r,"Libelle","Nom","Code")||`Motif ${id}`):"—"}
function motifCode(id){const r=S.motifs.find(x=>x.id===id);return r?norm(F(r,"Code")):""}

// V1.29 — libellés administrables localement dans Grist
const LABEL_DEFS=[
 ["nav.home","Menu","Accueil"],["nav.new","Menu","Nouvelle demande"],["nav.mine","Menu","Mes demandes"],["nav.all","Menu","Autres demandes"],
 ["nav.resources","Menu","Ressources"],["nav.motifs","Menu","Motifs RH"],["nav.acl","Menu","ACL & Permissions"],["nav.labels","Menu","Libellés de l’application"],
 ["section.space","Menu","MON ESPACE"],["section.admin","Menu","ADMINISTRATION"],
 ["brand.title","En-tête","Demandes RH"],["brand.subtitle","En-tête","Portail collaborateur"],["header.eyebrow","En-tête","ESPACE RH"],
 ["page.home","Pages","Bonjour"],["page.new","Pages","Nouvelle demande"],["page.mine","Pages","Mes demandes"],["page.all","Pages","Autres demandes"],
 ["page.resources","Pages","Ressources"],["page.motifs","Pages","Motifs RH"],["page.acl","Pages","ACL & Permissions"],["page.sync","Pages","Synchronisation"],["page.labels","Pages","Libellés de l’application"],
 ["home.pill","Accueil","Portail collaborateur"],["home.hero","Accueil","Gérez vos demandes simplement."],
 ["mine.pill","Mes demandes","SUIVI"],["mine.title","Mes demandes","Mes demandes"],["mine.subtitle","Mes demandes","Historique et état de traitement."],
 ["all.pill","Autres demandes","ADMIN"],["all.title","Autres demandes","Autres demandes"],
 ["action.new","Actions","Nouvelle demande"],["action.save","Actions","Enregistrer"],["action.cancel","Actions","Annuler"],["action.edit","Actions","Modifier"],["action.refresh","Actions","Actualiser"],
 ["action.audit","Actions","Auditer"],["action.reset","Actions","Réinitialiser tout"],["action.default","Actions","Défaut"],
 ["table.reference","Tableaux","RÉFÉRENCE"],["table.type","Tableaux","TYPE"],["table.period","Tableaux","PÉRIODE"],["table.motif","Tableaux","MOTIF"],["table.status","Tableaux","STATUT"],["table.actions","Tableaux","ACTIONS"],
 ["table.name","Tableaux","NOM"],["table.email","Tableaux","EMAIL"],["table.team","Tableaux","ÉQUIPE"],["table.profile","Tableaux","PROFIL"],["table.state","Tableaux","ÉTAT"],
 ["field.type","Formulaire","Type"],["field.start","Formulaire","Date de début"],["field.end","Formulaire","Date de fin"],["field.motif","Formulaire","Motif"],["field.comment","Formulaire","Commentaire"],
 ["field.code","Formulaire","Code"],["field.label","Formulaire","Libellé"],["field.description","Formulaire","Description"],
 ["status.pending","Statuts","En attente"],["status.approved","Statuts","Validée"],["status.refused","Statuts","Refusée"],["status.cancelled","Statuts","Annulée"],
 ["empty.requests","Messages","Aucune demande."],["empty.resources","Messages","Aucune ressource synchronisée."],["empty.motifs","Messages","Aucun motif local."],
 ["sync.title","Synchronisation","Synchronisation"],["sync.notrun","Synchronisation","Pas encore exécutée"],
 ["labels.title","Libellés","Libellés de l’application"],["labels.subtitle","Libellés","Modifiez les textes affichés sans changer les clés techniques ni le fonctionnement."],
 ["labels.table","Libellés","Table des libellés"],["labels.init","Libellés","Initialiser la table"],["labels.complete","Libellés","Compléter / vérifier la table"],
 ["acl.pill","ACL","SECURITY CENTER"],["acl.title","ACL","ACL & Permissions"],["acl.audit","ACL","Audit des permissions"],
 ["motifs.pill","Motifs","RÉFÉRENTIEL LOCAL"],["motifs.new","Motifs","Nouveau motif"],["motifs.active","Motifs","Motif actif"],
 ["resources.title","Ressources","Ressources"],
 ["nav.managers","Menu","Managers & Ressources"],["page.managers","Pages","Managers & Ressources"],];
const LABEL_BY_DEFAULT=Object.fromEntries(LABEL_DEFS.map(([k,c,d])=>[d,k]));
function labelMap(){return Object.fromEntries((S.labels||[]).map(r=>[norm(F(r,"Cle")),norm(F(r,"Libelle"))]).filter(([k,v])=>k&&v))}
function L(key,fallback=""){return labelMap()[key]||fallback||LABEL_DEFS.find(x=>x[0]===key)?.[2]||key}
function applyLabels(root=document){
  const map=labelMap();
  root.querySelectorAll?.("[data-label-key]").forEach(el=>{
    const key=el.dataset.labelKey;
    const def=LABEL_DEFS.find(x=>x[0]===key);
    if(def)el.textContent=L(key,def[2]);
  });
  const replacements=new Map(LABEL_DEFS.map(([k,c,d])=>[d.toLocaleLowerCase("fr"),map[k]||d]));
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{
    const raw=n.nodeValue, trimmed=raw.trim(), key=trimmed.toLocaleLowerCase("fr");
    if(replacements.has(key)){
      const lead=raw.match(/^\s*/)?.[0]||"", tail=raw.match(/\s*$/)?.[0]||"";
      n.nodeValue=lead+replacements.get(key)+tail;
    }
  });
  root.querySelectorAll?.("[placeholder],[title]").forEach(el=>{
    ["placeholder","title"].forEach(a=>{
      const v=el.getAttribute(a); if(v&&replacements.has(v))el.setAttribute(a,replacements.get(v));
    });
  });
  const navKeys={home:"nav.home",new:"nav.new",mine:"nav.mine",all:"nav.all",resources:"nav.resources",managers:"nav.managers",motifs:"nav.motifs",acl:"nav.acl",labels:"nav.labels"};
  Object.entries(navKeys).forEach(([view,key])=>{
    const span=document.querySelector(`.nav[data-view="${view}"] span`); if(span)span.textContent=L(key,span.textContent);
  });
  const heads=[...document.querySelectorAll(".nav-title[data-accordion]")];
  heads.forEach(el=>{
    const chevron=el.querySelector(".acc-chevron");
    const key=el.dataset.accordion==="space"?"section.space":"section.admin";
    const base=el.dataset.accordion==="space"?"MON ESPACE":"ADMINISTRATION";
    [...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.nodeValue="");
    el.insertBefore(document.createTextNode(L(key,base)+" "),chevron||null);
  });

}
async function labelsTableExists(){
  try{await grist.docApi.fetchTable(T.labels);return true}catch{return false}
}
async function loadLabels(){
  if(!(S.isAdmin||S.isOwner))return;
  const exists=await labelsTableExists();
  S.labelsReady=exists;
  S.labels=exists?await table(T.labels):[];
  $("labelsSetup")?.classList.remove("hidden");
  const setupText=$("labelsSetupText");
  if(setupText)setupText.innerHTML=exists
    ? `<strong>PARAM_LIBELLES</strong> est disponible · ${S.labels.length} libellé(s) enregistré(s).`
    : `<strong>PARAM_LIBELLES</strong> n’existe pas encore. Cliquez sur « Initialiser / compléter la table ».`;
  const initBtn=$("initLabelsBtn");
  if(initBtn) initBtn.textContent=exists?"Compléter / vérifier la table":"Initialiser la table";
  $("labelsManager")?.classList.toggle("hidden",!exists);
  if(exists){
    const count=$("labelsCount"); if(count)count.textContent=`${LABEL_DEFS.length} libellés disponibles`;
    renderLabelsManager();applyLabels();
  }
}
async function initLabelsTable(){
  if(!(S.isAdmin||S.isOwner))return;
  const btn=$("initLabelsBtn");
  const previous=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent="Initialisation…";}
  try{
    if(!await labelsTableExists()){
      await grist.docApi.applyUserActions([["AddTable",T.labels,[
        {id:"Cle",type:"Text"},{id:"Categorie",type:"Text"},{id:"Libelle",type:"Text"}
      ]]]);
    }
    const existing=await table(T.labels), keys=new Set(existing.map(r=>norm(F(r,"Cle"))));
    const actions=LABEL_DEFS.filter(([k])=>!keys.has(k)).map(([k,c,d])=>["AddRecord",T.labels,null,{Cle:k,Categorie:c,Libelle:d}]);
    if(actions.length)await grist.docApi.applyUserActions(actions);
    await loadLabels();
    showLabelMsg("Table PARAM_LIBELLES initialisée et vérifiée.","success");
  }catch(e){
    const msg=$("labelsSetupText");
    if(msg)msg.innerHTML=`Impossible d’initialiser <strong>PARAM_LIBELLES</strong>. Vérifiez que votre compte Grist peut créer/modifier les tables.`;
    throw e;
  }finally{
    if(btn){btn.disabled=false;if(!btn.textContent||btn.textContent==="Initialisation…")btn.textContent=previous||"Initialiser / compléter la table";}
  }
}
function renderLabelsManager(filter=""){
  if(!S.labelsReady)return;
  const byKey=Object.fromEntries(S.labels.map(r=>[norm(F(r,"Cle")),r]));
  const q=norm(filter).toLowerCase();
  $("labelsRows").innerHTML=LABEL_DEFS.filter(([k,c,d])=>!q||`${k} ${c} ${d} ${L(k,d)}`.toLowerCase().includes(q)).map(([k,c,d])=>{
    const r=byKey[k], current=r?norm(F(r,"Libelle")):d;
    return `<tr><td>${esc(c)}</td><td><span class="codechip">${esc(k)}</span></td><td>${esc(d)}</td><td><input class="label-input" data-label-key="${esc(k)}" value="${esc(current)}"></td><td><div class="label-actions"><button class="table-action" data-label-save="${esc(k)}">Enregistrer</button><button class="table-action" data-label-reset="${esc(k)}">Défaut</button></div></td></tr>`;
  }).join("");
  document.querySelectorAll("[data-label-save]").forEach(b=>b.onclick=()=>saveLabel(b.dataset.labelSave).catch(fatal));
  document.querySelectorAll("[data-label-reset]").forEach(b=>b.onclick=()=>resetLabel(b.dataset.labelReset).catch(fatal));
}
async function saveLabel(key){
  if(!(S.isAdmin||S.isOwner))return;
  const input=document.querySelector(`[data-label-key="${CSS.escape(key)}"]`), value=norm(input?.value);
  if(!value)throw new Error("Le libellé ne peut pas être vide.");
  const r=S.labels.find(x=>norm(F(x,"Cle"))===key);
  if(r)await grist.docApi.applyUserActions([["UpdateRecord",T.labels,r.id,{Libelle:value}]]);
  else {
    const def=LABEL_DEFS.find(x=>x[0]===key);
    await grist.docApi.applyUserActions([["AddRecord",T.labels,null,{Cle:key,Categorie:def?.[1]||"",Libelle:value}]]);
  }
  await loadLabels(); showLabelMsg("Libellé enregistré.","success");
}
async function resetLabel(key){
  const def=LABEL_DEFS.find(x=>x[0]===key); if(!def)return;
  const r=S.labels.find(x=>norm(F(x,"Cle"))===key);
  if(r)await grist.docApi.applyUserActions([["UpdateRecord",T.labels,r.id,{Libelle:def[2]}]]);
  await loadLabels(); showLabelMsg("Libellé réinitialisé.","success");
}
async function resetAllLabels(){
  if(!(S.isAdmin||S.isOwner)||!S.labelsReady)return;
  const byKey=Object.fromEntries(S.labels.map(r=>[norm(F(r,"Cle")),r]));
  const actions=LABEL_DEFS.flatMap(([k,c,d])=>byKey[k]?[["UpdateRecord",T.labels,byKey[k].id,{Libelle:d}]]:[["AddRecord",T.labels,null,{Cle:k,Categorie:c,Libelle:d}]]);
  if(actions.length)await grist.docApi.applyUserActions(actions);
  await loadLabels(); showLabelMsg("Tous les libellés ont été réinitialisés.","success");
}
function showLabelMsg(text,type=""){
  const el=$("labelsMsg"); if(!el)return; el.textContent=text; el.className=`alert ${type}`; setTimeout(()=>el.classList.add("hidden"),2500);
}


// V1.36 — gestion locale des affectations, sans toucher au démarrage du portail
async function managerTableExists(){
  try{await grist.docApi.fetchTable(T.managerResources);return true}catch(e){return false}
}
function rowsFromFetch(raw){
  const ids=raw?.id||[];
  return ids.map((id,i)=>{const r={id};Object.keys(raw||{}).forEach(k=>{if(k!=="id"&&Array.isArray(raw[k]))r[k]=raw[k][i]});return r});
}
async function refreshManagersAdmin(){
  if(!S.isOwner)return;
  try{await renderManagersAdmin()}catch(e){managerAdminError(e)}
}
function managerAdminError(e){
  const el=$("managerAdminMsg");if(!el)return;
  el.textContent=e?.message||String(e);el.className="alert danger";
}
function resLabel(r){return `${norm(F(r,"Nom","nom"))||"Ressource"}${norm(F(r,"Email","email"))?` · ${norm(F(r,"Email","email"))}`:""}`}
async function renderManagersAdmin(){
  if(!S.isOwner)return;
  const exists=await managerTableExists();
  $("managerAdminArea")?.classList.toggle("hidden",!exists);
  if($("managerTableState")) $("managerTableState").textContent=exists?"Table Managers_Ressources détectée.":"Table Managers_Ressources introuvable.";
  if(!exists)return;
  const raw=await grist.docApi.fetchTable(T.managerResources), links=rowsFromFetch(raw);
  const opts=(S.resources||[]).filter(r=>F(r,"Actif","actif")!==false).map(r=>`<option value="${r.id}">${esc(resLabel(r))}</option>`).join("");
  $("managerSelect").innerHTML='<option value="">— Manager —</option>'+opts;
  $("managedResourceSelect").innerHTML='<option value="">— Ressource —</option>'+opts;
  $("managerRows").innerHTML=links.filter(x=>F(x,"Actif")!==false).map(x=>{
    const m=S.resources.find(r=>Number(r.id)===rid(F(x,"Manager"))), rr=S.resources.find(r=>Number(r.id)===rid(F(x,"Ressource")));
    return `<tr><td>${esc(m?resLabel(m):"—")}</td><td>${esc(rr?resLabel(rr):"—")}</td><td>Actif</td><td><button class="table-action" data-manager-off="${x.id}">Retirer</button></td></tr>`;
  }).join("")||'<tr><td colspan="4">Aucune affectation.</td></tr>';
  document.querySelectorAll("[data-manager-off]").forEach(b=>b.onclick=()=>disableManagerLink(+b.dataset.managerOff).catch(managerAdminError));
}
async function addManagerLink(){
  if(!S.isOwner)return;
  const m=+$("managerSelect").value,r=+$("managedResourceSelect").value;
  if(!m||!r)return managerAdminError(new Error("Sélectionnez un manager et une ressource."));
  if(m===r)return managerAdminError(new Error("Le manager et la ressource doivent être différents."));
  const raw=await grist.docApi.fetchTable(T.managerResources), links=rowsFromFetch(raw);
  const old=links.find(x=>rid(F(x,"Manager"))===m&&rid(F(x,"Ressource"))===r);
  if(old)await grist.getTable(T.managerResources).update({id:old.id,fields:{Actif:true}});
  else await grist.getTable(T.managerResources).create({fields:{Manager:m,Ressource:r,Actif:true}});
  await renderManagersAdmin();
}
async function disableManagerLink(id){
  if(!S.isOwner)return;
  await grist.getTable(T.managerResources).update({id,fields:{Actif:false}});
  await renderManagersAdmin();
}

function managerTargetLabel(id){
  const r=(S.resources||[]).find(x=>Number(x.id)===Number(id));
  return r?resLabel(r):`Ressource #${id}`;
}
function applyViewAs(){
  const target=S.viewAs;
  const targetId=target?Number(target.id):Number(S.person?.id||0);
  S.myRequests=targetId?S.allRequests.filter(r=>rid(F(r,"Demandeur"))===targetId):[];
  S.requests=S.viewAs?S.myRequests:(S.isAdmin?S.allRequests:S.myRequests);
  document.body.classList.toggle("view-as-mode",!!S.viewAs);
  const bar=$("viewAsBar"), sel=$("viewAsSelect");
  if(bar)bar.classList.toggle("hidden",!S.managedResources.length);
  if(sel && S.managedResources.length){
    const current=S.viewAs?String(S.viewAs.id):"";
    sel.innerHTML='<option value="">Moi-même</option>'+S.managedResources.map(x=>`<option value="${x.id}">${esc(managerTargetLabel(x.id))}</option>`).join("");
    sel.value=current;
  }
}
async function loadManagerContext(){
  // Appelé uniquement APRÈS le boot normal. Il ne peut pas bloquer l'identification.
  try{
    const raw=await grist.docApi.fetchTable(T.managerResources), links=rowsFromFetch(raw);

    // Utilisateur standard/manager : S.person est déjà connu.
    // Owner : identify() peut volontairement laisser S.person=null. Dans ce cas,
    // on retrouve sa ligne Ressources par l'email du bootstrap ADMIN_PORTAIL.
    let managerId=Number(S.person?.id||0);
    if(!managerId && S.isOwner && S.user?.email){
      const me=(S.resources||[]).find(r=>email(F(r,"Email","email"))===email(S.user.email));
      if(me) managerId=Number(me.id);
    }

    if(!managerId){
      S.managerLinks=[];S.managedResources=[];S.viewAs=null;
      applyViewAs();
      return;
    }

    S.managerLinks=links.filter(x=>
      F(x,"Actif")!==false &&
      Number(rid(F(x,"Manager")))===managerId
    );

    const ids=[...new Set(
      S.managerLinks.map(x=>Number(rid(F(x,"Ressource")))).filter(Boolean)
    )];

    S.managedResources=ids
      .filter(id=>(S.resources||[]).some(r=>Number(r.id)===id))
      .map(id=>({id}));

    applyViewAs();
    render();
  }catch(e){
    console.warn("Mode manager indisponible:",e);
    S.managerLinks=[];S.managedResources=[];S.viewAs=null;
    applyViewAs();
  }
}
function setViewAs(id){
  const n=Number(id||0);
  if(!n){
    S.viewAs=null;
  }else{
    const allowed=S.managedResources.find(x=>Number(x.id)===n);
    if(!allowed)return;
    S.viewAs={id:n};
  }
  reset();
  applyViewAs();
  render();
  showView("home");
}

function showView(name){
  if(S.viewAs && name==="new")return;
  if(["resources","managers","motifs","acl","sync"].includes(name)&&!S.isOwner)return;
  if(name==="labels"&&!(S.isAdmin||S.isOwner))return;
  if(name==="all"&&!(S.isAdmin||S.isOwner))return;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(v=>v.classList.remove("active"));
  document.getElementById(`view-${name}`)?.classList.add("active");
  document.querySelector(`.nav[data-view="${name}"]`)?.classList.add("active");
  const titles={home:["page.home","Bonjour"],new:["page.new","Nouvelle demande"],mine:["page.mine","Mes demandes"],all:["page.all","Autres demandes"],resources:["page.resources","Ressources"],motifs:["page.motifs","Motifs RH"],acl:["page.acl","ACL & Permissions"],sync:["page.sync","Synchronisation"],managers:["page.managers","Managers & Ressources"],labels:["page.labels","Libellés de l’application"]};
  const t=titles[name];
  const pageTitle=$("pageTitle");
  if(pageTitle){
    pageTitle.dataset.labelKey=t?t[0]:"brand.title";
    pageTitle.textContent=t?L(t[0],t[1]):L("brand.title","Demandes RH");
  }
}
async function detectOwner(){
  // Bootstrap V1.7 : l'espace Admin ne dépend plus des ACL Ressources.
  // Le setup admin alimente ADMIN_PORTAIL avec les emails autorisés.
  S.isOwner=false;
  try{
    const admins=await table(T.admins);
    // Tant que l'identité Grist n'est pas directement exposée par l'API widget,
    // le bootstrap Owner s'appuie sur une option locale réservée à l'installation
    // OU sur un ADMIN_PORTAIL unique. Le setup peut créer cette ligne avant les ACL.
    const opt=(await grist.getOptions())||{};
    const ownerEmail=email(opt.Owner_Email||opt.ownerEmail||"");
    const active=admins.filter(r=>F(r,"Actif")!==false && norm(F(r,"Role")).toUpperCase()==="OWNER");
    let admin=null;
    if(ownerEmail) admin=active.find(r=>email(F(r,"Email"))===ownerEmail);
    else if(active.length===1) admin=active[0];
    if(admin){
      S.isOwner=true;
      S.accessLevel="owner-bootstrap";
      S.ownerBootstrap={email:norm(F(admin,"Email")),name:norm(F(admin,"Nom"))||norm(F(admin,"Email"))};
    }
  }catch(e){console.warn("Bootstrap Owner indisponible:",e)}
  $("adminNav")?.classList.toggle("hidden",!S.isOwner);
}
function bindNav(){
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
}
function renderAdmin(){
  if(!S.isOwner)return;
  const anomalies=S.resources.filter(r=>!norm(F(r,"Nom","nom")));
  $("resCount").textContent=S.resources.length;
  $("resActive").textContent=S.resources.filter(r=>F(r,"Actif","actif")!==false).length;
  $("resErrors").textContent=anomalies.length;
  $("resourcesRows").innerHTML=S.resources.length?S.resources.map(r=>{
    const nom=norm(F(r,"Nom","nom")), mail=norm(F(r,"Email","email"));
    const equipe=norm(F(r,"Equipe_Code","Equipe","equipe")), profil=norm(F(r,"Profil","profil"));
    const actif=F(r,"Actif","actif")!==false, uuid=norm(F(r,"UUID_Ressource"));
    const bad=!nom;
    const state=bad?"Anomalie":!actif?"Inactif":mail?"Synchronisé":"Synchronisé · sans email";
    return `<tr title="UUID : ${esc(uuid||"—")}"><td><strong>${esc(nom||"—")}</strong></td><td>${esc(mail||"—")}</td><td>${esc(equipe||"—")}</td><td>${esc(profil||"—")}</td><td><span class="state ${bad?"err":!actif?"off":"ok"}">${state}</span></td></tr>`;
  }).join(""):'<tr><td colspan="5">Aucune ressource synchronisée.</td></tr>';
  $("motifsRows").innerHTML=S.motifs.length?S.motifs.map(r=>`<tr><td><span class="codechip">${esc(F(r,"Code")||"—")}</span></td><td><strong>${esc(F(r,"Libelle")||"—")}</strong></td><td>${esc(F(r,"Description")||"")}</td><td><span class="state ${F(r,"Actif")===false?"off":"ok"}">${F(r,"Actif")===false?"Inactif":"Actif"}</span></td><td><button class="table-action" data-motif-edit="${r.id}">Modifier</button></td></tr>`).join(""):'<tr><td colspan="5">Aucun motif local.</td></tr>';
  document.querySelectorAll("[data-motif-edit]").forEach(b=>b.onclick=()=>openMotifEditor(+b.dataset.motifEdit));
  $("syncAdmin").innerHTML=`<strong>Synchronisation sécurisée RH-SYNC</strong><p>Ressources : Cockpit.Team → Ressources via le compte technique. Motifs : catalogue local, administré ici et rapproché du Cockpit uniquement par Code.</p>`;
}
function openMotifEditor(id=null){
  if(!S.isOwner)return;
  S.motifEditing=id;
  const r=id?S.motifs.find(x=>x.id===id):null;
  $("motifEditorTitle").textContent=r?"Modifier le motif":"Nouveau motif";
  $("motifCodeAdmin").value=r?norm(F(r,"Code")):"";
  $("motifLabelAdmin").value=r?norm(F(r,"Libelle")):"";
  $("motifDescAdmin").value=r?norm(F(r,"Description")):"";
  $("motifActiveAdmin").checked=r?F(r,"Actif")!==false:true;
  $("motifAdminMsg").classList.add("hidden");
  $("motifEditor").classList.remove("hidden");
}
function closeMotifEditor(){$("motifEditor").classList.add("hidden");S.motifEditing=null}
async function saveAdminMotif(){
  if(!S.isOwner)return;
  const code=norm($("motifCodeAdmin").value).toUpperCase(),label=norm($("motifLabelAdmin").value);
  if(!code||!label){$("motifAdminMsg").textContent="Code et libellé sont obligatoires.";$("motifAdminMsg").classList.remove("hidden");return}
  const dup=S.motifs.find(r=>norm(F(r,"Code")).toUpperCase()===code&&r.id!==S.motifEditing);
  if(dup){$("motifAdminMsg").textContent=`Le code ${code} existe déjà.`;$("motifAdminMsg").classList.remove("hidden");return}
  const fields={Code:code,Libelle:label,Description:norm($("motifDescAdmin").value),Actif:$("motifActiveAdmin").checked};
  const t=grist.getTable(T.motifs);
  try{
    if(S.motifEditing)await t.update({id:S.motifEditing,fields});else await t.create({fields});
    closeMotifEditor();await load();showView("motifs");
  }catch(e){
    $("motifAdminMsg").textContent="Impossible d'enregistrer le motif : "+(e?.message||String(e));
    $("motifAdminMsg").classList.remove("hidden");
  }
}
async function adminSyncResources(){
  if(!S.isOwner)return;
  try{await load();showView("resources")}catch(e){fatal(e)}
}
function auditAcl(){
  if(!S.isOwner)return;
  const checks=[
    ["Ressources","Filtrage collaborateur attendu : user.Email = rec.Email",S.person?"ok":"warn"],
    ["Demandes_RH","Lecture/édition limitée aux demandes du collaborateur","warn"],
    ["Champs manager","Statut décisionnel, commentaire et date de décision protégés","warn"]
  ];
  const ok=checks.filter(x=>x[2]==="ok").length, score=Math.round(ok/checks.length*100);
  $("aclScore").textContent=`${score}%`; $("aclState").textContent=score===100?"Conforme":"À vérifier";
  $("aclResults").innerHTML=checks.map(x=>`<div class="check"><div><strong>${esc(x[0])}</strong><small>${esc(x[1])}</small></div><b class="${x[2]==="ok"?"status-ok":"status-warn"}">${x[2]==="ok"?"Conforme":"À contrôler"}</b></div>`).join("");
  $("applyAcl").disabled=true; // L'API Custom Widget standard ne permet pas d'écrire les ACL de façon sûre.
}

function render(){
  const realIdentity=`${S.user.name||S.user.email}${S.user.email?` · ${S.user.email}`:""}`;
  $("identity").textContent=S.viewAs?`${realIdentity} · Vue lecture seule : ${managerTargetLabel(S.viewAs.id)}`:realIdentity;
  applyViewAs();
  $("setup").classList.add("hidden");$("app").classList.remove("hidden");$("fatal").classList.add("hidden");
  $("motif").innerHTML='<option value="">— Choisir —</option>'+S.motifs.filter(r=>F(r,"Actif","actif")!==false).map(r=>`<option value="${r.id}">${esc(motifName(r.id))}</option>`).join("");
  $("kw").textContent=S.myRequests.filter(r=>st(r)==="EN_ATTENTE").length;
  $("kv").textContent=S.myRequests.filter(r=>st(r)==="VALIDEE").length;
  $("kr").textContent=S.myRequests.filter(r=>st(r)==="REFUSEE").length;
  const makeRows=(items,actions=true)=>items.length?items.map(r=>{const e=st(r)==="EN_ATTENTE";return `<tr><td><strong>${esc(F(r,"Reference")||"#"+r.id)}</strong></td><td>${esc(F(r,"Type")||"—")}</td><td>${dt(F(r,"Date_Debut"))} → ${dt(F(r,"Date_Fin"))}</td><td>${esc(motifName(rid(F(r,"Motif"))))}</td><td><span class="badge">${esc(st(r))}</span></td><td>${actions&&e?`<div class="rowactions"><button class="secondary" data-e="${r.id}">Modifier</button><button class="secondary" data-c="${r.id}">Annuler</button></div>`:""}</td></tr>`}).join(""):'<tr><td colspan="6">Aucune demande.</td></tr>';
  $("rows").innerHTML=makeRows(S.myRequests.slice().reverse(),!S.viewAs);
  $("rowsHome").innerHTML=makeRows(S.myRequests.slice().reverse().slice(0,5),false);
  if($("rowsAll")) $("rowsAll").innerHTML=makeRows((S.isAdmin||S.isOwner)?S.allRequests.filter(r=>!S.person||rid(F(r,"Demandeur"))!==Number(S.person.id)).slice().reverse():[],false);
  document.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{edit(+b.dataset.e);showView("new")});
  document.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>cancelReq(+b.dataset.c));
  renderAdmin();
}
function reset(){S.editing=null;$("formTitle").textContent="Nouvelle demande";$("save").textContent="Envoyer";$("type").value="CONGE";$("motif").value="";$("start").value="";$("end").value="";$("comment").value="";$("cancelEdit").classList.add("hidden")}
function edit(id){const r=S.myRequests.find(x=>x.id===id);if(!r||st(r)!=="EN_ATTENTE")return;S.editing=id;$("formTitle").textContent="Modifier ma demande";$("save").textContent="Enregistrer";$("type").value=F(r,"Type")||"CONGE";$("motif").value=rid(F(r,"Motif"));const iso=v=>new Date(Number(v)*1000).toISOString().slice(0,10);$("start").value=iso(F(r,"Date_Debut"));$("end").value=iso(F(r,"Date_Fin"));$("comment").value=F(r,"Commentaire_Demandeur")||"";$("cancelEdit").classList.remove("hidden")}
async function save(){
  const a=$("start").value,b=$("end").value,m=+$("motif").value;
  if(!a||!b||!m)return msg("Motif et période obligatoires.");
  if(b<a)return msg("La date de fin doit être ≥ à la date de début.");
  const fields={Type:$("type").value,Date_Debut:ep(a),Date_Fin:ep(b),Motif:m,Motif_Code:motifCode(m),Commentaire_Demandeur:$("comment").value.trim(),Date_Modification:Math.floor(Date.now()/1000)};
  const tab=grist.getTable(T.requests);
  if(S.editing){
    const r=S.myRequests.find(x=>x.id===S.editing);if(!r||st(r)!=="EN_ATTENTE")throw new Error("Demande non modifiable.");
    await tab.update({id:S.editing,fields});
    await syncRequestToCockpit(S.editing);
  } else {
    const u=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
    Object.assign(fields,{Reference:`DRH-${new Date().getFullYear()}-${u.slice(0,8).toUpperCase()}`,Demandeur:S.person.id,Statut:"EN_ATTENTE",Date_Demande:Math.floor(Date.now()/1000),UUID_Demande:u,Version_Sync:1});
    const created=await tab.create({fields});
    const newId=Number(created?.id||created)||0;
    if(newId)await syncRequestToCockpit(newId);
  }
  reset();await load();
}
async function cancelReq(id){const r=S.myRequests.find(x=>x.id===id);if(!r||st(r)!=="EN_ATTENTE"||!confirm("Annuler cette demande ?"))return;await grist.getTable(T.requests).update({id,fields:{Statut:"ANNULEE",Date_Modification:Math.floor(Date.now()/1000)}});await syncRequestToCockpit(id);await load()}
function msg(t){$("msg").textContent=t;$("msg").classList.remove("hidden")}
function fatal(e){$("fatal").textContent=e?.message||String(e);$("fatal").classList.remove("hidden");$("app").classList.add("hidden")}
async function boot(){
  grist.ready({requiredAccess:"full"});
  bindNav();
  $("auditAcl").onclick=auditAcl;
  $("newMotifBtn").onclick=()=>openMotifEditor();
  $("closeMotif").onclick=closeMotifEditor;
  $("cancelMotif").onclick=closeMotifEditor;
  $("saveMotif").onclick=()=>saveAdminMotif().catch(fatal);
  $("syncResourcesBtn").onclick=adminSyncResources;
  $("applyAcl").onclick=()=>{};
  $("initLabelsBtn").onclick=()=>initLabelsTable().catch(fatal);
  $("refreshManagersBtn").onclick=()=>refreshManagersAdmin();
  $("addManagerLink").onclick=()=>addManagerLink().catch(managerAdminError);
  $("labelsSearch").oninput=e=>renderLabelsManager(e.target.value);
  $("resetAllLabels").onclick=()=>resetAllLabels().catch(fatal);
  $("save").onclick=()=>save().catch(fatal);
  $("newBtn").onclick=()=>{reset();showView("new")};
  $("cancelEdit").onclick=()=>{reset();showView("mine")};
  $("refresh").onclick=async()=>{await syncAll("manual");await load();await loadManagerContext()};
  $("syncNow").onclick=async()=>{await syncAll("manual");await load();await loadManagerContext()};
  $("viewAsSelect").onchange=e=>setViewAs(e.target.value);
  await detectOwner();
  await syncAll("startup")
  await identify();await load();await loadLabels();showView(S.isOwner&&!S.person?"acl":"home");
  setTimeout(()=>loadManagerContext().catch(e=>console.warn("Mode manager:",e)),0);
}
boot().catch(fatal);

// V1.25 — rubriques exclusives de la sidebar
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  const heads = [...sidebar.querySelectorAll(".nav-title[data-accordion]")];
  const setOpen = (name) => {
    sidebar.dataset.openSection = name;
    heads.forEach(h => {
      const open = h.dataset.accordion === name;
      h.classList.toggle("open", open);
      h.setAttribute("aria-expanded", open ? "true" : "false");
    });
  };
  heads.forEach(h => {
    h.setAttribute("role","button");
    h.setAttribute("tabindex","0");
    const activate = () => setOpen(h.dataset.accordion);
    h.addEventListener("click", activate);
    h.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });
  setOpen("space");
});


// V1.27 — regroupement accordéon robuste par data-view
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const groups = {
    space: ["home","new","mine","all"],
    admin: ["resources","managers","motifs","acl","labels","sync"]
  };

  const applyAccordion = (open) => {
    sidebar.dataset.openSection = open;
    Object.entries(groups).forEach(([group, views]) => {
      const visible = group === open;
      views.forEach(view => {
        sidebar.querySelectorAll(`[data-view="${view}"]`).forEach(el => {
          el.style.setProperty("display", visible ? "flex" : "none", "important");
        });
      });
    });

    // Le bloc d'état de synchronisation appartient à ADMINISTRATION.
    sidebar.querySelectorAll(".syncbox").forEach(el => {
      el.style.setProperty("display", open === "admin" ? "flex" : "none", "important");
    });

    sidebar.querySelectorAll(".nav-title[data-accordion]").forEach(h => {
      const active = h.dataset.accordion === open;
      h.classList.toggle("open", active);
      h.setAttribute("aria-expanded", active ? "true" : "false");
    });
  };

  sidebar.querySelectorAll(".nav-title[data-accordion]").forEach(h => {
    const activate = () => applyAccordion(h.dataset.accordion);
    h.onclick = activate;
    h.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    };
  });

  applyAccordion("space");
});
