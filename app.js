const VERSION="V1.23";
const T={requests:"Demandes_RH",resources:"Ressources",motifs:"Motifs_RH",admins:"ADMIN_PORTAIL"};
const S={user:null,person:null,requests:[],myRequests:[],allRequests:[],motifs:[],resources:[],editing:null,motifEditing:null,isOwner:false,isAdmin:false,accessLevel:""};
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
  if(S.isOwner && rr.length!==1){
    S.person=null;
    S.user={email:S.ownerBootstrap?.email||"",name:S.ownerBootstrap?.name||"Owner"};
    return;
  }
  if(rr.length===0)throw new Error("Aucune ressource autorisée pour cet utilisateur. Vérifiez la règle Ressources : user.Email == rec.Email.");
  if(rr.length>1)throw new Error("Plusieurs ressources sont visibles. Les règles d’accès doivent limiter Ressources à la ligne de l’utilisateur connecté.");
  S.person=rr[0];
  const mail=norm(F(S.person,"Email","email"));
  S.user={email:mail,name:norm(F(S.person,"Nom"))||mail||"Collaborateur"};
}
async function load(){
  const [q,m,res]=await Promise.all([table(T.requests),table(T.motifs),table(T.resources)]);
  S.motifs=m; S.resources=res;
  S.isAdmin=norm(F(S.person,"Profil","profil")).toUpperCase()==="ADMIN";
  S.allRequests=q;
  S.myRequests=S.person?q.filter(r=>rid(F(r,"Demandeur"))===Number(S.person.id)):[];
  // Sécurité : q ne contient que ce que les ACL Grist autorisent réellement.
  // ADMIN voit tout q ; tous les autres profils restent limités à leurs propres demandes.
  S.requests=S.isAdmin?q:S.myRequests;
  $("allRequestsNav")?.classList.toggle("hidden",!(S.isAdmin||S.isOwner));
  render();
}
function motifName(id){const r=S.motifs.find(x=>x.id===id);return r?norm(F(r,"Libelle","Nom","Code")||`Motif ${id}`):"—"}
function motifCode(id){const r=S.motifs.find(x=>x.id===id);return r?norm(F(r,"Code")):""}
function showView(name){
  if(["resources","motifs","acl","sync"].includes(name)&&!S.isOwner)return;
  if(name==="all"&&!(S.isAdmin||S.isOwner))return;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(v=>v.classList.remove("active"));
  document.getElementById(`view-${name}`)?.classList.add("active");
  document.querySelector(`.nav[data-view="${name}"]`)?.classList.add("active");
  const titles={home:"Bonjour",new:"Nouvelle demande",mine:"Mes demandes",all:"Autres demandes",resources:"Ressources",motifs:"Motifs RH",acl:"ACL & Permissions",sync:"Synchronisation"};
  $("pageTitle").textContent=titles[name]||"Demandes RH";
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
  $("identity").textContent=`${S.user.name||S.user.email}${S.user.email?` · ${S.user.email}`:""}`;
  $("setup").classList.add("hidden");$("app").classList.remove("hidden");$("fatal").classList.add("hidden");
  $("motif").innerHTML='<option value="">— Choisir —</option>'+S.motifs.filter(r=>F(r,"Actif","actif")!==false).map(r=>`<option value="${r.id}">${esc(motifName(r.id))}</option>`).join("");
  $("kw").textContent=S.myRequests.filter(r=>st(r)==="EN_ATTENTE").length;
  $("kv").textContent=S.myRequests.filter(r=>st(r)==="VALIDEE").length;
  $("kr").textContent=S.myRequests.filter(r=>st(r)==="REFUSEE").length;
  const makeRows=(items,actions=true)=>items.length?items.map(r=>{const e=st(r)==="EN_ATTENTE";return `<tr><td><strong>${esc(F(r,"Reference")||"#"+r.id)}</strong></td><td>${esc(F(r,"Type")||"—")}</td><td>${dt(F(r,"Date_Debut"))} → ${dt(F(r,"Date_Fin"))}</td><td>${esc(motifName(rid(F(r,"Motif"))))}</td><td><span class="badge">${esc(st(r))}</span></td><td>${actions&&e?`<div class="rowactions"><button class="secondary" data-e="${r.id}">Modifier</button><button class="secondary" data-c="${r.id}">Annuler</button></div>`:""}</td></tr>`}).join(""):'<tr><td colspan="6">Aucune demande.</td></tr>';
  $("rows").innerHTML=makeRows(S.myRequests.slice().reverse(),true);
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
  $("save").onclick=()=>save().catch(fatal);
  $("newBtn").onclick=()=>{reset();showView("new")};
  $("cancelEdit").onclick=()=>{reset();showView("mine")};
  $("refresh").onclick=async()=>{await syncAll("manual");await load()};
  $("syncNow").onclick=async()=>{await syncAll("manual");await load()};
  await detectOwner();
  await syncAll("startup")
  await identify();await load();showView(S.isOwner&&!S.person?"acl":"home");
}
boot().catch(fatal);