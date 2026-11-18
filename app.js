const VERSION="V1.59";
const T={requests:"Demandes_RH",resources:"Ressources",motifs:"Motifs_RH",admins:"ADMIN_PORTAIL",labels:"PARAM_LIBELLES",managerResources:"Managers_Ressources",identity:"SESSION_IDENTITE",presenceMap:"PARAM_MOTIFS_PRESENCE",planning:"PLANNING_PRESENCE",menuOrder:"PARAM_MENU_ORDRE"};
const S={user:null,person:null,requests:[],myRequests:[],allRequests:[],motifs:[],resources:[],editing:null,motifEditing:null,isOwner:false,isAdmin:false,accessLevel:"",labels:[],labelsReady:false,managerLinks:[],managedResources:[],viewAs:null,debugEnabled:false,debugLog:[],presenceMappings:[],presenceMapReady:false,planningRows:[],planningReady:false,planningStart:null,menuOrder:[],menuOrderReady:false};
const SYNC={host:"",cockpitDocId:"",apiKey:""};
const DEBUG_KEY="rh_debug_enabled";
function debugIsEnabled(){
  try{
    const q=new URLSearchParams(location.search);
    return q.get("debug")==="1" || localStorage.getItem(DEBUG_KEY)==="1";
  }catch{return false}
}
function debugSafe(v){
  try{
    if(v===undefined)return null;
    return JSON.parse(JSON.stringify(v,(k,x)=>{
      if(/api.?key|token|authorization|password|secret/i.test(k))return "[masqué]";
      return x;
    }));
  }catch{return String(v)}
}
function dlog(step,data={}){
  const entry={time:new Date().toISOString(),step,data:debugSafe(data)};
  S.debugLog.push(entry);
  if(S.debugLog.length>200)S.debugLog.shift();
  if(S.debugEnabled)console.info("[RH DEBUG]",step,entry.data);
  renderDebug();
}
function setDebugEnabled(enabled){
  S.debugEnabled=!!enabled;
  try{localStorage.setItem(DEBUG_KEY,enabled?"1":"0")}catch{}
  dlog("debug.toggle",{enabled:S.debugEnabled,version:VERSION});
  renderDebug();
}
function resourceSummary(r){return r?{id:r.id,email:email(F(r,"Email","email")),nom:norm(F(r,"Nom","nom")),profil:norm(F(r,"Profil","profil")),actif:F(r,"Actif","actif")}:null}
function renderDebug(){
  const pre=$("debugOutput"), chk=$("debugToggle"), status=$("debugStatus");
  if(chk)chk.checked=!!S.debugEnabled;
  if(status)status.textContent=S.debugEnabled?`Actif · ${VERSION}`:`Inactif · ${VERSION}`;
  const fatalPre=$("fatalDebugOutput");
  if(!pre&&!fatalPre)return;
  const snapshot={
    version:VERSION,
    url:location.href,
    debugEnabled:S.debugEnabled,
    user:S.user,
    person:resourceSummary(S.person),
    isOwner:S.isOwner,
    isAdmin:S.isAdmin,
    ownerBootstrap:S.ownerBootstrap,
    accessLevel:S.accessLevel,
    visibleResources:(S.resources||[]).map(resourceSummary),
    log:S.debugLog
  };
  const txt=JSON.stringify(snapshot,null,2);
  if(pre)pre.textContent=txt;
  if(fatalPre)fatalPre.textContent=txt;
}
function showDebugFromFatal(){
  const box=$("fatalDebug"); if(box)box.classList.remove("hidden");
  renderDebug();
}
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
  const fields={Reference:F(localReq,"Reference"),Demandeur:person.id,Type:F(localReq,"Type"),Date_Debut:F(localReq,"Date_Debut"),Date_Fin:F(localReq,"Date_Fin"),Motif:motif.id,Commentaire_Demandeur:F(localReq,"Commentaire_Demandeur"),Date_Demande:F(localReq,"Date_Demande"),UUID_Demande:uuid,Statut:F(localReq,"Statut")||"EN_ATTENTE"};
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
const todayStart=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()};
const canCancel=r=>{
  const status=st(r);
  if(status==="ANNULEE"||status==="REFUSEE")return false;
  const start=Number(F(r,"Date_Debut")||0)*1000;
  return Boolean(start)&&start>=todayStart();
};
function rows(t){const ids=t.id||[];return ids.map((id,i)=>{const r={id};for(const k of Object.keys(t))if(k!=="id")r[k]=t[k]?.[i];return r})}
async function table(name){return rows(await grist.docApi.fetchTable(name))}
async function ensureIdentityTable(){
  dlog("identity.table.ensure.start",{table:T.identity});
  // V1.50 — Grist n'expose pas directement l'utilisateur réel au Custom Widget.
  // On utilise donc une table technique dont les trigger formulas sont évaluées
  // par Grist avec le vrai `user` qui exécute l'action.
  try{
    await grist.docApi.fetchTable(T.identity);
    dlog("identity.table.ensure.exists",{table:T.identity});
    return true;
  }catch(_e){
    try{
      await grist.docApi.applyUserActions([["AddTable",T.identity,[
        {id:"Nonce",type:"Text",label:"Nonce"},
        {id:"Email",type:"Text",label:"Email Grist",isFormula:false,formula:"user.Email",recalcWhen:0},
        {id:"Nom",type:"Text",label:"Nom Grist",isFormula:false,formula:"user.Name",recalcWhen:0},
        {id:"CreeLe",type:"DateTime:UTC",label:"Créé le",isFormula:false,formula:"NOW()",recalcWhen:0}
      ]]]);
      dlog("identity.table.ensure.created",{table:T.identity});
      return true;
    }catch(e){
      dlog("identity.table.ensure.error",{message:e?.message||String(e)});
      console.warn("Création de SESSION_IDENTITE impossible:",e);
      return false;
    }
  }
}
async function currentGristIdentity(){
  dlog("identity.probe.start",{version:VERSION});
  // La seule source d'identité autorisée est l'e-mail du vrai utilisateur Grist.
  // Le token REST du widget peut être `anon@getgrist.com`; il n'est jamais utilisé.
  const ok=await ensureIdentityTable();
  if(!ok){
    throw new Error("La table technique SESSION_IDENTITE est absente et ne peut pas être créée avec vos droits. Un administrateur doit ouvrir le module une fois ou créer cette table avec les trigger formulas user.Email et user.Name.");
  }
  const nonce=`rh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let rowId=null;
  try{
    const ret=await grist.docApi.applyUserActions([["AddRecord",T.identity,null,{Nonce:nonce}]]);
    dlog("identity.probe.addRecord",{nonce,retValues:ret?.retValues||null});
    // retValues contient normalement l'id créé, mais on recherche aussi par nonce
    // pour rester compatible avec les différentes versions de Grist.
    rowId=Number(ret?.retValues?.[0]||0)||null;
    const rowsIdentity=rows(await grist.docApi.fetchTable(T.identity));
    dlog("identity.probe.rows",{count:rowsIdentity.length,rows:rowsIdentity.map(r=>({id:r.id,Nonce:F(r,"Nonce"),Email:F(r,"Email"),Nom:F(r,"Nom")}))});
    const rec=(rowId?rowsIdentity.find(r=>Number(r.id)===rowId):null)||rowsIdentity.find(r=>norm(F(r,"Nonce"))===nonce);
    if(!rec)throw new Error("Grist n'a pas renvoyé la ligne d'identité créée.");
    rowId=Number(rec.id)||rowId;
    const e=email(F(rec,"Email"));
    const n=norm(F(rec,"Nom"));
    if(!e)throw new Error("La trigger formula user.Email de SESSION_IDENTITE n'a retourné aucun e-mail.");
    dlog("identity.probe.result",{email:e,name:n,rowId});
    if(e==="anon@getgrist.com"||e==="anonymous@getgrist.com"||e.startsWith("anon@")){
      throw new Error(`Grist a fourni l'identité technique ${e} au lieu de l'utilisateur connecté. Vérifiez que Email est bien une trigger formula \`user.Email\` appliquée aux nouveaux enregistrements.`);
    }
    return {email:e,name:n,source:"trigger:user.Email"};
  }finally{
    if(rowId){
      try{await grist.docApi.applyUserActions([["RemoveRecord",T.identity,rowId]]);dlog("identity.probe.cleanup",{rowId})}catch(e){dlog("identity.probe.cleanup.error",{rowId,message:e?.message||String(e)});console.warn("Nettoyage SESSION_IDENTITE impossible:",e)}
    }
  }
}
async function identify(){
  dlog("identify.start",{});
  const allResources=await table(T.resources);
  S.resources=allResources;
  const rr=allResources.filter(r=>F(r,"Actif","actif")!==false);
  dlog("identify.resources",{total:allResources.length,active:rr.length,rows:rr.map(resourceSummary)});
  if(rr.length===0)throw new Error("Aucune ressource autorisée pour cet utilisateur.");

  S.person=null;
  const ident=await currentGristIdentity();
  dlog("identify.gristIdentity",ident);
  const connectedEmail=email(ident?.email);
  if(!connectedEmail)throw new Error("Impossible de lire l'e-mail du compte Grist connecté.");

  S.person=rr.find(r=>email(F(r,"Email","email"))===connectedEmail)||null;
  dlog("identify.match",{connectedEmail,matched:resourceSummary(S.person)});
  if(!S.person){
    throw new Error(`Le compte Grist ${connectedEmail} est connecté, mais aucune Ressource visible ne porte cet e-mail.`);
  }

  S.user={email:connectedEmail,name:ident.name||norm(F(S.person,"Nom","nom"))||connectedEmail};
  S.accessLevel="identity:trigger:user.Email";
  dlog("identify.success",{user:S.user,person:resourceSummary(S.person)});
}
async function load(){
  const [q,m,res]=await Promise.all([table(T.requests),table(T.motifs),table(T.resources)]);
  S.motifs=m; S.resources=res;
  S.isAdmin=norm(F(S.person,"Profil","profil")).toUpperCase()==="ADMIN";
  $("adminNav")?.classList.toggle("hidden",!(S.isAdmin||S.isOwner));
  document.querySelectorAll(".owner-only").forEach(el=>el.classList.toggle("hidden",!S.isOwner));
  document.querySelectorAll(".manager-admin-only").forEach(el=>el.classList.toggle("hidden",!(S.isAdmin||S.isOwner)));
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
 ["nav.home","Menu","Accueil"],["nav.new","Menu","Nouvelle demande"],["nav.mine","Menu","Mes demandes"],["nav.planning","Menu","Planning présence"],["nav.all","Menu","Autres demandes"],
 ["nav.resources","Menu","Ressources"],["nav.debug","Menu","Diagnostic"],["nav.motifs","Menu","Motifs RH"],["nav.presenceMap","Menu","Correspondance présence"],["nav.acl","Menu","ACL & Permissions"],["nav.labels","Menu","Libellés de l’application"],
 ["section.space","Menu","MON ESPACE"],["section.admin","Menu","ADMINISTRATION"],
 ["brand.title","En-tête","Demandes RH"],["brand.subtitle","En-tête","Portail collaborateur"],["header.eyebrow","En-tête","ESPACE RH"],
 ["page.home","Pages","Bonjour"],["page.new","Pages","Nouvelle demande"],["page.mine","Pages","Mes demandes"],["page.planning","Pages","Planning présence"],["page.all","Pages","Autres demandes"],
 ["page.resources","Pages","Ressources"],["page.debug","Pages","Diagnostic"],["page.motifs","Pages","Motifs RH"],["page.presenceMap","Pages","Correspondance présence"],["page.acl","Pages","ACL & Permissions"],["page.sync","Pages","Synchronisation"],["page.labels","Pages","Libellés de l’application"],
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
 ["nav.managers","Menu","Managers & Ressources"],["page.managers","Pages","Managers & Ressources"],["nav.menuOrder","Menu","Ordre des menus"],["page.menuOrder","Pages","Ordre des menus"],];
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
  const navKeys={home:"nav.home",new:"nav.new",mine:"nav.mine",planning:"nav.planning",all:"nav.all",resources:"nav.resources",managers:"nav.managers",debug:"nav.debug",motifs:"nav.motifs",presenceMap:"nav.presenceMap",acl:"nav.acl",labels:"nav.labels",menuOrder:"nav.menuOrder"};
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
  if(!(S.isAdmin||S.isOwner))return;
  try{await renderManagersAdmin()}catch(e){managerAdminError(e)}
}
function managerAdminError(e){
  const el=$("managerAdminMsg");if(!el)return;
  el.textContent=e?.message||String(e);el.className="alert danger";
}
function resLabel(r){return `${norm(F(r,"Nom","nom"))||"Ressource"}${norm(F(r,"Email","email"))?` · ${norm(F(r,"Email","email"))}`:""}`}
async function renderManagersAdmin(){
  if(!(S.isAdmin||S.isOwner))return;
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
    return `<tr><td>${esc(m?resLabel(m):"—")}</td><td>${esc(rr?resLabel(rr):"—")}</td><td>Actif</td><td><button class="table-action manager-remove" type="button" data-manager-off="${x.id}">Retirer</button></td></tr>`;
  }).join("")||'<tr><td colspan="4">Aucune affectation.</td></tr>';
  document.querySelectorAll("[data-manager-off]").forEach(b=>b.onclick=()=>removeManagerLink(+b.dataset.managerOff).catch(managerAdminError));
}
async function addManagerLink(){
  if(!(S.isAdmin||S.isOwner))return;
  const m=+$("managerSelect").value,r=+$("managedResourceSelect").value;
  if(!m||!r)return managerAdminError(new Error("Sélectionnez un manager et une ressource."));
  if(m===r)return managerAdminError(new Error("Le manager et la ressource doivent être différents."));
  const raw=await grist.docApi.fetchTable(T.managerResources), links=rowsFromFetch(raw);
  const old=links.find(x=>rid(F(x,"Manager"))===m&&rid(F(x,"Ressource"))===r);
  if(old)await grist.getTable(T.managerResources).update({id:old.id,fields:{Actif:true}});
  else await grist.getTable(T.managerResources).create({fields:{Manager:m,Ressource:r,Actif:true}});
  await renderManagersAdmin();
}
async function removeManagerLink(id){
  if(!(S.isAdmin||S.isOwner))return;
  if(!id)throw new Error("Affectation invalide.");
  await grist.docApi.applyUserActions([["RemoveRecord",T.managerResources,id]]);
  if(S.viewAs && !S.managerLinks.some(x=>Number(x.id)!==Number(id) && Number(rid(F(x,"Ressource")))===Number(S.viewAs.id))){
    S.viewAs=null;
  }
  await renderManagersAdmin();
  await loadManagerContext();
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
  if(["resources","motifs","presenceMap","acl","sync"].includes(name)&&!S.isOwner)return;
  if(name==="managers"&&!(S.isAdmin||S.isOwner))return;
  if(name==="labels"&&!(S.isAdmin||S.isOwner))return;
  if(name==="menuOrder"&&!(S.isAdmin||S.isOwner))return;
  if(name==="all"&&!(S.isAdmin||S.isOwner))return;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(v=>v.classList.remove("active"));
  document.getElementById(`view-${name}`)?.classList.add("active");
  document.querySelector(`.nav[data-view="${name}"]`)?.classList.add("active");
  const titles={home:["page.home","Bonjour"],new:["page.new","Nouvelle demande"],mine:["page.mine","Mes demandes"],planning:["page.planning","Planning présence"],all:["page.all","Autres demandes"],resources:["page.resources","Ressources"],motifs:["page.motifs","Motifs RH"],presenceMap:["page.presenceMap","Correspondance présence"],acl:["page.acl","ACL & Permissions"],sync:["page.sync","Synchronisation"],managers:["page.managers","Managers & Ressources"],labels:["page.labels","Libellés de l’application"],menuOrder:["page.menuOrder","Ordre des menus"]};
  if(name==="presenceMap")setTimeout(()=>renderPresenceMapAdmin().catch(showPresenceMapError),0);
  if(name==="planning")setTimeout(()=>loadPlanning().catch(showPlanningError),0);
  const t=titles[name];
  const pageTitle=$("pageTitle");
  if(pageTitle){
    pageTitle.dataset.labelKey=t?t[0]:"brand.title";
    pageTitle.textContent=t?L(t[0],t[1]):L("brand.title","Demandes RH");
  }
}
async function detectOwner(){
  dlog("owner.detect.start",{user:S.user,person:resourceSummary(S.person)});
  // V1.48 — un OWNER n'est reconnu que si l'e-mail de l'identité réellement
  // connectée correspond à une ligne OWNER active. Un OWNER unique dans la
  // table ne suffit plus : cela évite qu'une PMO hérite de l'identité Owner.
  S.isOwner=false;
  S.ownerBootstrap=null;
  try{
    const admins=await table(T.admins);
    const active=admins.filter(r=>F(r,"Actif")!==false&&norm(F(r,"Role")).toUpperCase()==="OWNER");
    const me=email(S.user?.email);
    const admin=me?active.find(r=>email(F(r,"Email"))===me):null;
    if(admin){
      S.isOwner=true;
      S.accessLevel="owner";
      S.ownerBootstrap={email:norm(F(admin,"Email")),name:norm(F(admin,"Nom"))||norm(F(admin,"Email"))};
      dlog("owner.detect.match",{admin:{id:admin.id,email:S.ownerBootstrap.email,name:S.ownerBootstrap.name}});
    }
  }catch(e){console.warn("Détection Owner indisponible:",e)}
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

// V1.54 — planning présence restitué via PARAM_MOTIFS_PRESENCE
function planningIsoDate(v){
  if(!v)return "";
  const d=new Date(Number(v)*1000);
  return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10);
}
function localIsoToday(){
  const d=new Date(), y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function addDaysIso(iso,n){
  const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function frenchDateShort(iso){return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}).replace(".","")}
function frenchDayHeader(iso){
  const d=new Date(`${iso}T12:00:00`);
  return {dow:d.toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","").toUpperCase(),day:d.getDate(),weekend:[0,6].includes(d.getDay())};
}
function planningStatus(v){
  const x=norm(v).toUpperCase().replace(/[ÉÈÊË]/g,"E");
  if(["P","PRESENCE","PRESENT","JOUR_TRAVAILLE","TRAVAILLE"].includes(x))return "P";
  if(["TL","TT","TELETRAVAIL","TELE-TRAVAIL"].includes(x))return "TL";
  if(["A","ABSENCE","ABSENT"].includes(x))return "A";
  if(["WE","WEEKEND","WEEK-END"].includes(x))return "WE";
  return norm(v).slice(0,4).toUpperCase();
}
function planningStatusLabel(code){return ({P:"Jour travaillé",A:"Absence"})[code]||code||"Non renseigné"}
function presenceTypeForMotifCode(code){
  const wanted=norm(code).toUpperCase();
  if(!wanted)return "";
  const motif=(S.motifs||[]).find(m=>norm(F(m,"Code")).toUpperCase()===wanted);
  return motif?presenceTypeForMotif(motif.id):"";
}
function planningDisplayForRow(row){
  if(!row)return {code:"",type:"",reason:"Aucune donnée synchronisée"};
  const motifCode=norm(F(row,"Motif_Code"));
  const type=presenceTypeForMotifCode(motifCode);
  if(type==="JOUR_TRAVAILLE")return {code:"P",type,reason:"Jour travaillé"};
  if(type==="ABSENCE")return {code:"A",type,reason:"Absence"};
  if(type==="AUCUN_IMPACT")return {code:"",type,reason:"Aucun impact sur la présence"};
  return {code:"",type:"",reason:motifCode?`Motif ${motifCode} non configuré dans ${T.presenceMap}`:`Aucun motif synchronisé`};
}
function resourceById(id){return (S.resources||[]).find(r=>Number(r.id)===Number(id))||null}
async function planningTableExists(){try{await grist.docApi.fetchTable(T.planning);return true}catch{return false}}
async function ensurePlanningTable(){
  if(await planningTableExists())return true;
  if(!S.isOwner)throw new Error(`La table ${T.planning} est absente. Un Owner doit l'initialiser.`);
  await grist.docApi.applyUserActions([["AddTable",T.planning,[
    {id:"Ressource",type:"Ref:Ressources",label:"Ressource"},
    {id:"Date",type:"Date",label:"Date"},
    {id:"Statut",type:"Text",label:"Statut"},
    {id:"Libelle",type:"Text",label:"Libellé"},
    {id:"Motif_Code",type:"Text",label:"Code motif"},
    {id:"Equipe_Code",type:"Text",label:"Équipe"},
    {id:"Source_Feuille_ID",type:"Int",label:"ID source Cockpit"},
    {id:"Derniere_Sync",type:"DateTime",label:"Dernière synchro"},
    {id:"Erreur_Sync",type:"Text",label:"Erreur de synchro"}
  ]]]);
  return true;
}
async function loadPlanning(){
  const exists=await planningTableExists();
  S.planningReady=exists;
  S.planningRows=exists?await table(T.planning):[];
  await loadPresenceMappings();
  if(!S.planningStart)S.planningStart=localIsoToday();
  renderPlanning();
}
function showPlanningError(e){
  const el=$("planningMsg");if(!el)return;el.textContent=e?.message||String(e);el.className="alert danger";el.classList.remove("hidden");
}
async function initPlanningTable(){await ensurePlanningTable();await loadPlanning();const el=$("planningMsg");if(el){el.textContent=`Table ${T.planning} initialisée.`;el.className="alert success";el.classList.remove("hidden")}}
function renderPlanning(){
  const setup=$("planningSetup"),grid=$("planningGrid"),init=$("initPlanningBtn");
  if(setup)setup.classList.toggle("hidden",S.planningReady);
  if(grid)grid.classList.toggle("hidden",!S.planningReady);
  if(init)init.classList.toggle("hidden",!S.isOwner);
  if(!S.planningReady){const st=$("planningSetupText");if(st)st.innerHTML=`La table <strong>${esc(T.planning)}</strong> n'existe pas encore dans le document Demande RH.`;return}
  const start=S.planningStart||localIsoToday(), dates=Array.from({length:15},(_,i)=>addDaysIso(start,i)), end=dates[14];
  const range=$("planningRange");if(range)range.textContent=`${frenchDateShort(start)} – ${frenchDateShort(end)} ${end.slice(0,4)}`;
  const q=norm($("planningSearch")?.value).toLowerCase();
  const canSeeAllTeams=!!(S.isAdmin||S.isOwner);
  const ownTeam=norm(F(S.person||{},"Equipe_Code","Equipe","equipe"));
  const teamSet=new Set((S.resources||[]).filter(r=>F(r,"Actif","actif")!==false).map(r=>norm(F(r,"Equipe_Code","Equipe","equipe"))).filter(Boolean));
  const sel=$("planningTeam");
  let team="";
  if(sel){
    const current=norm(sel.value);
    if(canSeeAllTeams){
      sel.disabled=false;
      sel.innerHTML='<option value="">Toutes les équipes</option>'+[...teamSet].sort((a,b)=>a.localeCompare(b,"fr")).map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
      if([...teamSet].includes(current))sel.value=current;
      team=norm(sel.value);
    }else{
      sel.disabled=true;
      if(ownTeam){sel.innerHTML=`<option value="${esc(ownTeam)}">${esc(ownTeam)}</option>`;sel.value=ownTeam;team=ownTeam;}
      else{sel.innerHTML='<option value="">Mon équipe</option>';sel.value="";team="";}
    }
  }else if(!canSeeAllTeams){team=ownTeam;}
  const byResource=new Map();
  for(const row of S.planningRows){
    const id=rid(F(row,"Ressource")); if(!id)continue;
    const iso=planningIsoDate(F(row,"Date")); if(!dates.includes(iso))continue;
    if(!byResource.has(id))byResource.set(id,new Map());byResource.get(id).set(iso,row);
  }
  let resources=(S.resources||[]).filter(r=>F(r,"Actif","actif")!==false);
  resources=resources.filter(r=>{
    const t=norm(F(r,"Equipe_Code","Equipe","equipe"));const name=norm(F(r,"Nom","nom"));const mail=email(F(r,"Email","email"));
    const allowedTeam=canSeeAllTeams?(!team||t===team):(ownTeam?t===ownTeam:Number(r.id)===Number(S.person?.id||0));
    return allowedTeam&&(!q||`${name} ${mail} ${t}`.toLowerCase().includes(q));
  }).sort((a,b)=>norm(F(a,"Nom")).localeCompare(norm(F(b,"Nom"),"fr")));
  const count=$("planningCount");if(count)count.textContent=`${resources.length} ressource${resources.length>1?"s":""} affichée${resources.length>1?"s":""}`;
  const head=$("planningHead");if(head)head.innerHTML='<th class="sticky-col resource-col">Ressource</th><th class="sticky-col team-col">Équipe</th>'+dates.map(d=>{const h=frenchDayHeader(d);return `<th class="planning-day ${h.weekend?"weekend":""}"><span>${h.dow}</span><strong>${h.day}</strong></th>`}).join("");
  const body=$("planningBody");if(body)body.innerHTML=resources.length?resources.map(r=>{
    const id=Number(r.id),name=norm(F(r,"Nom"))||email(F(r,"Email"))||`Ressource ${id}`,teamName=norm(F(r,"Equipe_Code","Equipe"))||"—";
    const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
    const isOwnRow=Number(id)===Number(S.person?.id||0);
    const cells=dates.map(d=>{
      const row=byResource.get(id)?.get(d);const h=frenchDayHeader(d);const display=planningDisplayForRow(row);const code=display.code;
      let title="Aucune donnée synchronisée";
      if(row){
        if(isOwnRow){
          const motifCode=norm(F(row,"Motif_Code"));
          const original=[norm(F(row,"Libelle")),motifCode,norm(F(row,"Statut")),norm(F(row,"Commentaire"))].filter(Boolean);
          title=[display.reason,...original].filter(Boolean).join(" · ")||"Donnée synchronisée";
        }else{
          title=code?display.reason:"Aucune information de présence affichable";
        }
      }
      return `<td class="planning-cell ${h.weekend?"weekend":""}" title="${esc(title)}">${code?`<span class="presence-chip status-${esc(code.toLowerCase())}">${esc(code)}</span>`:'<span class="presence-empty">—</span>'}</td>`;
    }).join("");
    return `<tr><td class="sticky-col resource-col"><div class="resource-name"><span class="resource-avatar">${esc(initials||"R")}</span><strong>${esc(name)}</strong></div></td><td class="sticky-col team-col" title="${esc(teamName)}">${esc(teamName)}</td>${cells}</tr>`;
  }).join(""):`<tr><td colspan="17" class="planning-empty">Aucune présence synchronisée sur cette période.</td></tr>`;
  const latest=(S.planningRows||[]).map(r=>Number(F(r,"Derniere_Sync")||0)).filter(Boolean).sort((a,b)=>b-a)[0];
  const sync=$("planningSync");if(sync)sync.textContent=latest?`Synchronisé · ${new Date(latest*1000).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`:"En attente de synchronisation";
}
function shiftPlanning(days){S.planningStart=addDaysIso(S.planningStart||localIsoToday(),days);renderPlanning()}
function resetPlanningToday(){S.planningStart=localIsoToday();renderPlanning()}

// V1.52 — correspondance Motifs RH -> impact feuille de présence
async function presenceMapTableExists(){
  try{await grist.docApi.fetchTable(T.presenceMap);return true}catch{return false}
}
async function ensurePresenceMapTable(){
  if(await presenceMapTableExists())return true;
  if(!S.isOwner)throw new Error("Seul l’Owner peut initialiser la table de correspondance présence.");
  await grist.docApi.applyUserActions([["AddTable",T.presenceMap,[
    {id:"Motif",type:"Ref:Motifs_RH",label:"Motif RH"},
    {id:"Type_Presence",type:"Text",label:"Type de présence"},
    {id:"Actif",type:"Bool",label:"Actif"},
    {id:"Commentaire",type:"Text",label:"Commentaire"}
  ]]]);
  return true;
}
async function loadPresenceMappings(){
  if(!(await presenceMapTableExists())){
    S.presenceMappings=[];S.presenceMapReady=false;return false;
  }
  S.presenceMappings=rows(await grist.docApi.fetchTable(T.presenceMap));
  S.presenceMapReady=true;return true;
}
function presenceTypeLabel(v){
  return ({JOUR_TRAVAILLE:"Jour travaillé",ABSENCE:"Absence",AUCUN_IMPACT:"Aucun impact"})[norm(v).toUpperCase()]||"Non configuré";
}
async function renderPresenceMapAdmin(){
  if(!S.isOwner)return;
  const exists=await loadPresenceMappings();
  const setup=$("presenceMapSetup"), manager=$("presenceMapManager"), state=$("presenceMapSetupText");
  if(setup)setup.classList.toggle("hidden",exists);
  if(manager)manager.classList.toggle("hidden",!exists);
  if(state)state.innerHTML=exists?`<strong>${esc(T.presenceMap)}</strong> est disponible · ${S.presenceMappings.length} correspondance(s).`:`<strong>${esc(T.presenceMap)}</strong> n’existe pas encore.`;
  if(!exists)return;
  const byMotif=new Map(S.presenceMappings.map(r=>[rid(F(r,"Motif")),r]));
  const body=$("presenceMapRows"); if(!body)return;
  body.innerHTML=(S.motifs||[]).map(m=>{
    const r=byMotif.get(Number(m.id));
    const type=norm(F(r,"Type_Presence")).toUpperCase();
    const actif=r?F(r,"Actif")!==false:true;
    const comment=r?norm(F(r,"Commentaire")):"";
    const opts=[["","— Non configuré —"],["JOUR_TRAVAILLE","Jour travaillé"],["ABSENCE","Absence"],["AUCUN_IMPACT","Aucun impact"]]
      .map(([v,l])=>`<option value="${v}" ${type===v?"selected":""}>${l}</option>`).join("");
    return `<tr><td><span class="codechip">${esc(F(m,"Code")||"—")}</span></td><td><strong>${esc(F(m,"Libelle")||"—")}</strong></td><td><select data-presence-type="${m.id}">${opts}</select></td><td><label class="toggleline"><input type="checkbox" data-presence-active="${m.id}" ${actif?"checked":""}> Actif</label></td><td><input data-presence-comment="${m.id}" value="${esc(comment)}" placeholder="Optionnel"></td><td><button class="table-action" data-presence-save="${m.id}">Enregistrer</button></td></tr>`;
  }).join("")||'<tr><td colspan="6">Aucun motif RH à paramétrer.</td></tr>';
  document.querySelectorAll("[data-presence-save]").forEach(b=>b.onclick=()=>savePresenceMapping(Number(b.dataset.presenceSave)).catch(showPresenceMapError));
}
function showPresenceMapError(e){
  const el=$("presenceMapMsg");if(!el)return;el.textContent=e?.message||String(e);el.className="alert danger";el.classList.remove("hidden");
}
function showPresenceMapSuccess(text){
  const el=$("presenceMapMsg");if(!el)return;el.textContent=text;el.className="alert success";el.classList.remove("hidden");setTimeout(()=>el.classList.add("hidden"),2200);
}
async function initPresenceMapTable(){
  await ensurePresenceMapTable();await renderPresenceMapAdmin();showPresenceMapSuccess("Table de correspondance initialisée.");
}
async function savePresenceMapping(motifId){
  if(!S.isOwner)return;
  const type=norm(document.querySelector(`[data-presence-type="${motifId}"]`)?.value).toUpperCase();
  if(!["JOUR_TRAVAILLE","ABSENCE","AUCUN_IMPACT"].includes(type))throw new Error("Choisissez Jour travaillé, Absence ou Aucun impact.");
  const actif=!!document.querySelector(`[data-presence-active="${motifId}"]`)?.checked;
  const commentaire=norm(document.querySelector(`[data-presence-comment="${motifId}"]`)?.value);
  await ensurePresenceMapTable();await loadPresenceMappings();
  const old=S.presenceMappings.find(r=>rid(F(r,"Motif"))===Number(motifId));
  const fields={Motif:Number(motifId),Type_Presence:type,Actif:actif,Commentaire:commentaire};
  if(old)await grist.getTable(T.presenceMap).update({id:old.id,fields});
  else await grist.getTable(T.presenceMap).create({fields});
  await renderPresenceMapAdmin();showPresenceMapSuccess(`Correspondance enregistrée : ${presenceTypeLabel(type)}.`);
}
function presenceTypeForMotif(motifId){
  const r=(S.presenceMappings||[]).find(x=>rid(F(x,"Motif"))===Number(motifId)&&F(x,"Actif")!==false);
  return r?norm(F(r,"Type_Presence")).toUpperCase():"";
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
  const resourceById=id=>(S.resources||[]).find(x=>Number(x.id)===Number(id));
  const makeRows=(items,actions=true,showResource=false)=>items.length?items.map(r=>{
    const editable=st(r)==="EN_ATTENTE";
    const cancellable=canCancel(r);
    const resource=resourceById(rid(F(r,"Demandeur")));
    const resourceCell=showResource?`<td><strong>${esc(resource?resLabel(resource):"Ressource #"+rid(F(r,"Demandeur")))}</strong></td>`:"";
    const actionButtons=[];
    if(actions&&editable)actionButtons.push(`<button class="secondary" data-e="${r.id}">Modifier</button>`);
    if(actions&&cancellable)actionButtons.push(`<button class="secondary" data-c="${r.id}">Annuler</button>`);
    const actionsCell=actionButtons.length?`<div class="rowactions">${actionButtons.join("")}</div>`:"";
    return `<tr>${resourceCell}<td><strong>${esc(F(r,"Reference")||"#"+r.id)}</strong></td><td>${esc(F(r,"Type")||"—")}</td><td>${dt(F(r,"Date_Debut"))}</td><td>${dt(F(r,"Date_Fin"))}</td><td>${esc(motifName(rid(F(r,"Motif"))))}</td><td><span class="badge">${esc(st(r))}</span></td><td>${actionsCell}</td></tr>`
  }).join(""):`<tr><td colspan="${showResource?8:7}">Aucune demande.</td></tr>`;
  $("rows").innerHTML=makeRows(S.myRequests.slice().reverse(),!S.viewAs);
  $("rowsHome").innerHTML=makeRows(S.myRequests.slice().reverse().slice(0,5),false);
  if($("rowsAll")){
    const allOther=(S.isAdmin||S.isOwner)?S.allRequests.filter(r=>!S.person||rid(F(r,"Demandeur"))!==Number(S.person.id)):[];
    const teamFilter=$("allTeamFilter");
    const resourceFilter=$("allResourceFilter");
    const selectedTeam=teamFilter?.value||"";
    const selectedResource=resourceFilter?.value||"";
    const involvedIds=[...new Set(allOther.map(r=>Number(rid(F(r,"Demandeur")))).filter(Boolean))];
    const involvedResources=involvedIds.map(id=>resourceById(id)).filter(Boolean);
    const teamNames=[...new Set(involvedResources.map(r=>norm(F(r,"Equipe_Code","Equipe","equipe"))).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
    if(teamFilter){
      teamFilter.innerHTML='<option value="">Toutes les équipes</option>'+teamNames.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
      if(selectedTeam&&teamNames.includes(selectedTeam))teamFilter.value=selectedTeam;
    }
    const activeTeam=teamFilter?.value||"";
    const resourcesForTeam=involvedResources.filter(r=>!activeTeam||norm(F(r,"Equipe_Code","Equipe","equipe"))===activeTeam).sort((a,b)=>resLabel(a).localeCompare(resLabel(b),"fr"));
    const allowedResourceIds=resourcesForTeam.map(r=>Number(r.id));
    if(resourceFilter){
      resourceFilter.innerHTML='<option value="">Toutes les ressources</option>'+resourcesForTeam.map(r=>`<option value="${r.id}">${esc(resLabel(r))}</option>`).join("");
      if(selectedResource&&allowedResourceIds.includes(Number(selectedResource)))resourceFilter.value=selectedResource;
    }
    const activeResource=resourceFilter?.value||"";
    const visible=allOther.filter(r=>{
      const resource=resourceById(rid(F(r,"Demandeur")));
      if(!resource)return false;
      if(activeTeam&&norm(F(resource,"Equipe_Code","Equipe","equipe"))!==activeTeam)return false;
      if(activeResource&&Number(resource.id)!==Number(activeResource))return false;
      return true;
    });
    $("rowsAll").innerHTML=makeRows(visible.slice().reverse(),false,true);
    if($("allRequestsCount")) $("allRequestsCount").textContent=`${visible.length} demande${visible.length>1?"s":""} affichée${visible.length>1?"s":""}`;
  }
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
    if(!S.person){
      throw new Error(`Aucune ressource associée à ${S.user?.email||"l'utilisateur connecté"}. Vérifiez que l'adresse e-mail existe dans Ressources.`);
    }
    const u=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
    Object.assign(fields,{Reference:`DRH-${new Date().getFullYear()}-${u.slice(0,8).toUpperCase()}`,Demandeur:S.person.id,Statut:"EN_ATTENTE",Date_Demande:Math.floor(Date.now()/1000),UUID_Demande:u,Version_Sync:1});
    const created=await tab.create({fields});
    const newId=Number(created?.id||created)||0;
    if(newId)await syncRequestToCockpit(newId);
  }
  reset();await load();
}
async function cancelReq(id){
  const r=S.myRequests.find(x=>x.id===id);
  if(!r)return;
  if(!canCancel(r)){
    alert("Cette demande ne peut plus être annulée : sa date de début est passée ou son statut est clôturé.");
    return;
  }
  const period=dt(F(r,"Date_Debut"))===dt(F(r,"Date_Fin"))?dt(F(r,"Date_Debut")):`du ${dt(F(r,"Date_Debut"))} au ${dt(F(r,"Date_Fin"))}`;
  if(!confirm(`Annuler cette demande ?\n\n${motifName(rid(F(r,"Motif")))} — ${period}\n\nL'annulation sera transmise au Cockpit RH.`))return;
  await grist.getTable(T.requests).update({id,fields:{Statut:"ANNULEE",Date_Modification:Math.floor(Date.now()/1000)}});
  await syncRequestToCockpit(id);
  await load();
}
function msg(t){$("msg").textContent=t;$("msg").classList.remove("hidden")}
function fatal(e){
  const message=e?.message||String(e);
  dlog("fatal",{message,stack:e?.stack||""});
  $("fatal").textContent=`${message} · ${VERSION}`;$("fatal").classList.remove("hidden");$("app").classList.add("hidden");
  const btn=$("fatalDebugBtn"); if(btn)btn.classList.remove("hidden");
  if(S.debugEnabled)showDebugFromFatal();
}
async function boot(){
  S.debugEnabled=debugIsEnabled();
  dlog("boot.start",{version:VERSION,debugEnabled:S.debugEnabled,userAgent:navigator.userAgent});
  grist.ready({requiredAccess:"full"});
  bindNav();
  $("auditAcl").onclick=auditAcl;
  if($("debugToggle")) $("debugToggle").onchange=e=>setDebugEnabled(e.target.checked);
  if($("copyDebugBtn")) $("copyDebugBtn").onclick=async()=>{try{await navigator.clipboard.writeText($("debugOutput")?.textContent||"");$("copyDebugBtn").textContent="Copié ✓";setTimeout(()=>$("copyDebugBtn").textContent="Copier le diagnostic",1200)}catch(e){dlog("debug.copy.error",{message:e?.message||String(e)})}};
  if($("fatalDebugBtn")) $("fatalDebugBtn").onclick=()=>{setDebugEnabled(true);showDebugFromFatal()};
  $("newMotifBtn").onclick=()=>openMotifEditor();
  if($("initPresenceMapBtn")) $("initPresenceMapBtn").onclick=()=>initPresenceMapTable().catch(showPresenceMapError);
  if($("refreshPresenceMapBtn")) $("refreshPresenceMapBtn").onclick=()=>renderPresenceMapAdmin().catch(showPresenceMapError);
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
  if($("initMenuOrderBtn")) $("initMenuOrderBtn").onclick=()=>initMenuOrderTable().catch(fatal);
  $("save").onclick=()=>save().catch(fatal);
  $("newBtn").onclick=()=>{reset();showView("new")};
  $("cancelEdit").onclick=()=>{reset();showView("mine")};
  $("refresh").onclick=async()=>{await syncAll("manual");await load();await loadManagerContext()};
  $("syncNow").onclick=async()=>{await syncAll("manual");await load();await loadManagerContext()};
  $("viewAsSelect").onchange=e=>setViewAs(e.target.value);
  if($("initPlanningBtn")) $("initPlanningBtn").onclick=()=>initPlanningTable().catch(showPlanningError);
  if($("planningSearch")) $("planningSearch").oninput=()=>renderPlanning();
  if($("planningTeam")) $("planningTeam").onchange=()=>renderPlanning();
  if($("planningPrev")) $("planningPrev").onclick=()=>shiftPlanning(-15);
  if($("planningNext")) $("planningNext").onclick=()=>shiftPlanning(15);
  if($("planningToday")) $("planningToday").onclick=()=>resetPlanningToday();
  if($("planningRefresh")) $("planningRefresh").onclick=()=>loadPlanning().catch(showPlanningError);
  if($("allTeamFilter")) $("allTeamFilter").onchange=()=>render();
  if($("allResourceFilter")) $("allResourceFilter").onchange=()=>render();
  renderDebug();
  await syncAll("startup")
  await identify();
  await detectOwner();
  await load();await loadLabels();await loadMenuOrder();showView("home");
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
    space: ["home","new","mine","planning","all"],
    admin: ["resources","managers","motifs","presenceMap","acl","labels","debug","menuOrder","sync"]
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
