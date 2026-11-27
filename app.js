const VERSION="V2.08";
const T={requests:"Demandes_RH",resources:"Ressources",motifs:"Motifs_RH",admins:"ADMIN_PORTAIL",labels:"PARAM_LIBELLES",managerResources:"Managers_Ressources",identity:"SESSION_IDENTITE",presenceMap:"PARAM_MOTIFS_PRESENCE",planning:"PLANNING_PRESENCE",menuOrder:"PARAM_MENU_ORDRE",syncParams:"PARAM_SYNCHRO",syncRequests:"DEMANDES_SYNCHRO",planningParams:"PARAM_PLANNING",planningKpis:"PARAM_PLANNING_INDICATEURS",importConfig:"PARAM_IMPORT_CONGES",importRuns:"IMPORT_CONGES",importLines:"IMPORT_CONGES_LIGNES"};
const S={user:null,person:null,requests:[],myRequests:[],allRequests:[],motifs:[],resources:[],editing:null,motifEditing:null,isOwner:false,isAdmin:false,accessLevel:"",labels:[],labelsReady:false,managerLinks:[],managedResources:[],viewAs:null,debugEnabled:false,debugLog:[],presenceMappings:[],presenceMapReady:false,planningRows:[],planningReady:false,planningStart:null,menuOrder:[],menuOrderReady:false,syncParams:[],syncParamsReady:false,syncRequests:[],syncRequestsReady:false,planningParams:[],planningParamsReady:false,planningWeeks:null,planningSelectedResourceIds:[],planningKpiRules:[],planningKpiReady:false,planningAnnualTeam:"",planningAnnualYear:null,planningAnnualShowRealMotifs:false,annualPresenceShowRealMotifs:false,planningRequestStart:"",planningRequestEnd:"",importConfigRows:[],importDrafts:[],importOcrWords:[],importFileName:"",importDetectedCount:0};
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
  const fields={Reference:F(localReq,"Reference"),Demandeur:person.id,Type:F(localReq,"Type"),Date_Debut:F(localReq,"Date_Debut"),Date_Fin:F(localReq,"Date_Fin"),Motif:motif.id,Commentaire_Demandeur:F(localReq,"Commentaire_Demandeur"),Date_Demande:F(localReq,"Date_Demande"),UUID_Demande:uuid,Statut:F(localReq,"Statut")||"EN_ATTENTE",AutoValidation:F(localReq,"AutoValidation")===true};
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
const isCancellationRequest=r=>norm(F(r,"Type_Action")).toUpperCase()==="ANNULATION"||norm(F(r,"Type")).toUpperCase()==="ANNULATION";
const acceptedStatus=r=>["VALIDEE","ACCEPTEE","ACCEPTE","ACCEPTED"].includes(st(r));
const canCancel=r=>{
  // Annulation directe uniquement pour une demande encore en attente.
  if(st(r)!=="EN_ATTENTE")return false;
  const start=Number(F(r,"Date_Debut")||0)*1000;
  return Boolean(start)&&start>=todayStart();
};
const canRequestCancellation=r=>{
  if(!r||isCancellationRequest(r)||!acceptedStatus(r))return false;
  if(presenceTypeForMotif(rid(F(r,"Motif")))!=="ABSENCE")return false;
  const end=Number(F(r,"Date_Fin")||0)*1000;
  if(!end||end<todayStart())return false;
  const pending=(S.myRequests||[]).some(x=>isCancellationRequest(x)&&rid(F(x,"Demande_Origine"))===Number(r.id)&&st(x)==="EN_ATTENTE");
  return !pending;
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
  applyNavigationPermissions();
  S.allRequests=q;
  S.myRequests=S.person?q.filter(r=>rid(F(r,"Demandeur"))===Number(S.person.id)):[];
  // Sécurité : q ne contient que ce que les ACL Grist autorisent réellement.
  // ADMIN voit tout q ; tous les autres profils restent limités à leurs propres demandes.
  S.requests=S.isAdmin?q:S.myRequests;
  applyRequestMenuVisibility();
  render();
  applyLabels();
}
function motifName(id){const r=S.motifs.find(x=>x.id===id);return r?norm(F(r,"Libelle","Nom","Code")||`Motif ${id}`):"—"}
function motifCode(id){const r=S.motifs.find(x=>x.id===id);return r?norm(F(r,"Code")):""}

// V1.29 — libellés administrables localement dans Grist
const LABEL_DEFS=[
 ["nav.home","Menu","Accueil"],["nav.new","Menu","Nouvelle demande"],["nav.mine","Menu","Mes demandes"],["nav.planning","Menu","Planning présence"],["nav.importConges","Menu","Import congés"],["nav.all","Menu","Autres demandes"],
 ["nav.guides","Menu","Guides"],["nav.importConfig","Menu","Paramètres import congés"],["nav.resources","Menu","Ressources"],["nav.debug","Menu","Diagnostic"],["nav.planningParams","Menu","Paramètres planning"],["nav.motifs","Menu","Motifs RH"],["nav.presenceMap","Menu","Correspondance présence"],["nav.acl","Menu","ACL & Permissions"],["nav.labels","Menu","Libellés de l’application"],
 ["section.space","Menu","MON ESPACE"],["section.documentation","Menu","DOCUMENTATION"],["section.admin","Menu","ADMINISTRATION"],
 ["brand.title","En-tête","Demandes RH"],["brand.subtitle","En-tête","Portail collaborateur"],["header.eyebrow","En-tête","ESPACE RH"],
 ["page.home","Pages","Bonjour"],["page.new","Pages","Nouvelle demande"],["page.mine","Pages","Mes demandes"],["page.planning","Pages","Planning présence"],["page.all","Pages","Autres demandes"],
 ["page.guides","Pages","Documentation"],["page.importConges","Pages","Import congés"],["page.importConfig","Pages","Paramètres import congés"],["page.resources","Pages","Ressources"],["page.debug","Pages","Diagnostic"],["page.planningParams","Pages","Paramètres planning"],["page.motifs","Pages","Motifs RH"],["page.presenceMap","Pages","Correspondance présence"],["page.acl","Pages","ACL & Permissions"],["page.sync","Pages","Synchronisation"],["page.labels","Pages","Libellés de l’application"],
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
 ["planning.annual.title","Planning","Consultation annuelle par équipe"],["planning.annual.subtitle","Planning","Consultez les indicateurs annuels de présence et d’absence pour une équipe."],
 ["planning.demand.title","Planning","Planification à la demande"],["planning.demand.subtitle","Planning","Choisissez une équipe, des collaborateurs et une période à afficher."],
 ["planning.annual.byResource","Planning","Par ressources"],["planning.annual.availability","Planning","Disponibilité équipe"],
 ["nav.managers","Menu","Managers & Ressources"],["page.managers","Pages","Managers & Ressources"],["nav.menuOrder","Menu","Ordre des menus"],["page.menuOrder","Pages","Ordre des menus"],["nav.syncParams","Menu","Paramètres de synchro"],["page.syncParams","Pages","Paramètres de synchro"],["nav.syncRequests","Menu","Demandes de synchro"],["page.syncRequests","Pages","Demandes de synchro"],];
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
  const navKeys={home:"nav.home",new:"nav.new",mine:"nav.mine",planning:"nav.planning",all:"nav.all",guideUser:"nav.guides",guideManager:"nav.guides",guideAdmin:"nav.guides",importConges:"nav.importConges",importConfig:"nav.importConfig",resources:"nav.resources",managers:"nav.managers",debug:"nav.debug",motifs:"nav.motifs",presenceMap:"nav.presenceMap",acl:"nav.acl",labels:"nav.labels",menuOrder:"nav.menuOrder",syncParams:"nav.syncParams",syncRequests:"nav.syncRequests",planningParams:"nav.planningParams"};
  Object.entries(navKeys).forEach(([view,key])=>{
    const span=document.querySelector(`.nav[data-view="${view}"] span`); if(span)span.textContent=L(key,span.textContent);
  });
  const heads=[...document.querySelectorAll(".nav-title[data-accordion]")];
  heads.forEach(el=>{
    const chevron=el.querySelector(".acc-chevron");
    const section=el.dataset.accordion;
    const key=section==="space"?"section.space":section==="docs"?"section.documentation":"section.admin";
    const base=section==="space"?"MON ESPACE":section==="docs"?"DOCUMENTATION":"ADMINISTRATION";
    [...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.nodeValue="");
    el.insertBefore(document.createTextNode(L(key,base)+" "),chevron||null);
  });

}

// V1.61 — ordre administrable des menus Utilisateur / Mon espace + Administration
const MENU_ORDER_DEFS={
  space:[
    ["home","Accueil"],
    ["new","Nouvelle demande"],
    ["mine","Mes demandes"],
    ["planning","Planning présence"],
    ["all","Autres demandes"]
  ],
  admin:[
    ["resources","Ressources"],
    ["managers","Managers & Ressources"],
    ["motifs","Motifs RH"],
    ["presenceMap","Correspondance présence"],
    ["acl","ACL & Permissions"],
    ["debug","Diagnostic"],
    ["labels","Libellés de l’application"],
    ["menuOrder","Ordre des menus"],
    ["syncParams","Paramètres de synchro"],
    ["syncRequests","Demandes de synchro"],
    ["planningParams","Paramètres planning"]
  ]
};

async function menuOrderTableExists(){
  try{await grist.docApi.fetchTable(T.menuOrder);return true}catch{return false}
}
function menuOrderSection(r){
  const section=norm(F(r,"Section"));
  // Compatibilité V1.58-V1.60 : les anciennes lignes concernaient Administration.
  return section||"admin";
}
function effectiveMenuOrder(section="admin"){
  const defs=MENU_ORDER_DEFS[section]||[];
  const byView=Object.fromEntries((S.menuOrder||[])
    .filter(r=>menuOrderSection(r)===section)
    .map(r=>[norm(F(r,"View")),Number(F(r,"Ordre"))||9999]));
  return defs.map(([view,label],idx)=>({section,view,label,ordre:byView[view]??((idx+1)*10)}))
    .sort((a,b)=>a.ordre-b.ordre||a.label.localeCompare(b.label,"fr"));
}
function applyMenuOrder(){
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar)return;

  const spaceTitle=sidebar.querySelector('.nav-title[data-accordion="space"]');
  const admin=$('adminNav');

  const spaceRank=Object.fromEntries(effectiveMenuOrder('space').map((x,i)=>[x.view,i]));
  const spaceButtons=[...sidebar.querySelectorAll('.accordion-space.nav[data-view]')];
  spaceButtons.sort((a,b)=>(spaceRank[a.dataset.view]??9999)-(spaceRank[b.dataset.view]??9999));
  if(spaceTitle){
    // Tous les boutons "Mon espace" restent juste après le titre de section.
    let anchor=spaceTitle;
    spaceButtons.forEach(b=>{anchor.insertAdjacentElement('afterend',b);anchor=b;});
  }

  if(admin){
    const adminRank=Object.fromEntries(effectiveMenuOrder('admin').map((x,i)=>[x.view,i]));
    const adminButtons=[...admin.querySelectorAll('.accordion-admin.nav[data-view]')];
    adminButtons.sort((a,b)=>(adminRank[a.dataset.view]??9999)-(adminRank[b.dataset.view]??9999));
    adminButtons.forEach(b=>admin.appendChild(b));
  }
}
async function loadMenuOrder(){
  if(!(S.isAdmin||S.isOwner))return;
  const exists=await menuOrderTableExists();
  S.menuOrderReady=exists;
  S.menuOrder=exists?await table(T.menuOrder):[];
  applyMenuOrder();
  const setup=$('menuOrderSetupText');
  if(setup) setup.innerHTML=exists
    ? `<strong>PARAM_MENU_ORDRE</strong> est disponible · ${S.menuOrder.length} entrée(s) enregistrée(s).`
    : `<strong>PARAM_MENU_ORDRE</strong> n’existe pas encore. Cliquez sur « Initialiser / compléter la table ».`;
  const btn=$('initMenuOrderBtn');
  if(btn) btn.textContent=exists?'Compléter / vérifier la table':'Initialiser la table';
  $('menuOrderManager')?.classList.toggle('hidden',!exists);
  if(exists)renderMenuOrderManager();
}
async function ensureMenuOrderSectionColumn(){
  try{
    await grist.docApi.applyUserActions([["AddColumn",T.menuOrder,"Section",{type:"Text"}]]);
  }catch(e){
    // Colonne déjà présente : rien à faire.
  }
}
async function initMenuOrderTable(){
  if(!(S.isAdmin||S.isOwner))return;
  const btn=$('initMenuOrderBtn');
  const old=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent='Initialisation…';}
  try{
    if(!await menuOrderTableExists()){
      await grist.docApi.applyUserActions([["AddTable",T.menuOrder,[
        {id:"Section",type:"Text"},{id:"View",type:"Text"},{id:"Libelle",type:"Text"},{id:"Ordre",type:"Int"}
      ]]]);
    }else{
      await ensureMenuOrderSectionColumn();
    }

    let existing=await table(T.menuOrder);
    // Migration des lignes V1.58-V1.60 : elles appartiennent à Administration.
    const legacy=existing.filter(r=>!norm(F(r,"Section")));
    if(legacy.length){
      const t=grist.getTable(T.menuOrder);
      for(const r of legacy)await t.update({id:r.id,fields:{Section:"admin"}});
      existing=await table(T.menuOrder);
    }

    const keys=new Set(existing.map(r=>`${menuOrderSection(r)}:${norm(F(r,"View"))}`));
    const actions=[];
    Object.entries(MENU_ORDER_DEFS).forEach(([section,defs])=>{
      defs.forEach(([view,label],idx)=>{
        if(!keys.has(`${section}:${view}`)) actions.push(["AddRecord",T.menuOrder,null,{Section:section,View:view,Libelle:label,Ordre:(idx+1)*10}]);
      });
    });
    if(actions.length)await grist.docApi.applyUserActions(actions);
    await loadMenuOrder();
    showMenuOrderMsg('Ordre des menus Utilisateur et Administration initialisé et vérifié.','success');
  }catch(e){
    showMenuOrderMsg('Impossible d’initialiser PARAM_MENU_ORDRE : '+(e?.message||String(e)),'danger');
    throw e;
  }finally{
    if(btn){btn.disabled=false;if(btn.textContent==='Initialisation…')btn.textContent=old||'Initialiser / compléter la table';}
  }
}
function showMenuOrderMsg(text,type='success'){
  const el=$('menuOrderMsg');if(!el)return;
  el.textContent=text;el.classList.remove('hidden','success','danger');el.classList.add(type);
}
function renderMenuOrderSection(section,bodyId){
  const body=$(bodyId);if(!body||!S.menuOrderReady)return;
  const rows=effectiveMenuOrder(section);
  body.innerHTML=rows.map((x,i)=>`<tr><td><strong>${i+1}</strong></td><td>${esc(L('nav.'+x.view,x.label))}</td><td><span class="codechip">${esc(x.view)}</span></td><td><div class="label-actions"><button class="table-action" data-menu-section="${section}" data-menu-up="${esc(x.view)}" ${i===0?'disabled':''}>↑</button><button class="table-action" data-menu-section="${section}" data-menu-down="${esc(x.view)}" ${i===rows.length-1?'disabled':''}>↓</button></div></td></tr>`).join('');
  body.querySelectorAll('[data-menu-up]').forEach(b=>b.onclick=()=>moveMenuOrder(b.dataset.menuSection,b.dataset.menuUp,-1).catch(fatal));
  body.querySelectorAll('[data-menu-down]').forEach(b=>b.onclick=()=>moveMenuOrder(b.dataset.menuSection,b.dataset.menuDown,1).catch(fatal));
}
function renderMenuOrderManager(){
  renderMenuOrderSection('space','menuOrderSpaceRows');
  renderMenuOrderSection('admin','menuOrderAdminRows');
}
async function moveMenuOrder(section,view,delta){
  if(!(S.isAdmin||S.isOwner))return;
  if(!S.menuOrderReady){await initMenuOrderTable();}
  const ordered=effectiveMenuOrder(section);
  const i=ordered.findIndex(x=>x.view===view);
  const j=i+delta;
  if(i<0||j<0||j>=ordered.length)return;
  const byView=Object.fromEntries((S.menuOrder||[])
    .filter(r=>menuOrderSection(r)===section)
    .map(r=>[norm(F(r,"View")),r]));
  const a=byView[ordered[i].view], b=byView[ordered[j].view];
  if(!a||!b){await initMenuOrderTable();return moveMenuOrder(section,view,delta);}
  const ta=Number(F(a,"Ordre"))||((i+1)*10), tb=Number(F(b,"Ordre"))||((j+1)*10);
  const t=grist.getTable(T.menuOrder);
  await t.update({id:a.id,fields:{Ordre:tb}});
  await t.update({id:b.id,fields:{Ordre:ta}});
  await loadMenuOrder();
  showMenuOrderMsg('Ordre enregistré.','success');
}

// V1.66 — administration des paramètres et demandes de synchronisation
function showSyncAdminMsg(id,text,type='success'){
  const el=$(id);if(!el)return;el.textContent=text;el.classList.remove('hidden','success','danger');el.classList.add(type);
}
async function gristTableExists(name){try{await grist.docApi.fetchTable(name);return true}catch{return false}}
function frDateTime(v){if(!v)return '—';const d=new Date(Number(v)*1000);return Number.isNaN(d.getTime())?'—':d.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}
function frDate(v){if(!v)return '—';const d=new Date(Number(v)*1000);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('fr-FR')}
async function initSyncParamsTable(){
  if(!(S.isAdmin||S.isOwner))return;
  if(!await gristTableExists(T.syncParams)){
    await grist.docApi.applyUserActions([["AddTable",T.syncParams,[{id:"Cle",type:"Text"},{id:"Valeur",type:"Text"},{id:"Commentaire",type:"Text"}]]]);
  }
  const existing=await table(T.syncParams), keys=new Set(existing.map(r=>norm(F(r,'Cle'))));
  const defs=[
    ['SYNC_HEBDO_ACTIF','true','Active la synchronisation hebdomadaire'],
    ['SYNC_HEBDO_JOUR','DIMANCHE','Jour de la synchronisation complète'],
    ['SYNC_HEBDO_HEURE','22:00','Heure de lancement'],
    ['SYNC_HEBDO_PERIODE','ANNEE_EN_COURS','Période de la synchronisation complète'],
    ['SYNC_AUTO_VALIDATION_ACTIF','true','Met à jour le planning après validation d’une demande']
  ];
  const actions=defs.filter(x=>!keys.has(x[0])).map(x=>["AddRecord",T.syncParams,null,{Cle:x[0],Valeur:x[1],Commentaire:x[2]}]);
  if(actions.length)await grist.docApi.applyUserActions(actions);
  await loadSyncParams();showSyncAdminMsg('syncParamsMsg','PARAM_SYNCHRO initialisée / complétée.');
}
async function loadSyncParams(){
  if(!(S.isAdmin||S.isOwner))return;const exists=await gristTableExists(T.syncParams);S.syncParamsReady=exists;S.syncParams=exists?await table(T.syncParams):[];
  $('syncParamsSetupText').innerHTML=exists?`<strong>PARAM_SYNCHRO</strong> disponible · ${S.syncParams.length} paramètre(s).`:`<strong>PARAM_SYNCHRO</strong> absente.`;
  $('syncParamsManager')?.classList.toggle('hidden',!exists);if(exists)renderSyncParams();
}
function renderSyncParams(){
  const body=$('syncParamsRows');if(!body)return;body.innerHTML=(S.syncParams||[]).sort((a,b)=>norm(F(a,'Cle')).localeCompare(norm(F(b,'Cle')))).map(r=>`<tr><td><span class="codechip">${esc(F(r,'Cle')||'')}</span></td><td><input class="sync-param-input" data-sync-param="${r.id}" value="${esc(F(r,'Valeur')||'')}"></td><td>${esc(F(r,'Commentaire')||'')}</td><td><button class="table-action" data-save-sync-param="${r.id}">Enregistrer</button></td></tr>`).join('');
  body.querySelectorAll('[data-save-sync-param]').forEach(b=>b.onclick=()=>saveSyncParam(Number(b.dataset.saveSyncParam)).catch(e=>showSyncAdminMsg('syncParamsMsg',e?.message||String(e),'danger')));
}
async function saveSyncParam(id){
  const input=document.querySelector(`[data-sync-param="${id}"]`);if(!input)return;await grist.getTable(T.syncParams).update({id,fields:{Valeur:input.value.trim()}});await loadSyncParams();showSyncAdminMsg('syncParamsMsg','Paramètre enregistré.');
}

// V1.77 — paramétrage des durées du planning
function planningParamValue(key,fallback=""){
  const row=(S.planningParams||[]).find(r=>norm(F(r,"Cle"))===key);
  return row?norm(F(row,"Valeur")):fallback;
}
function planningWeekOptions(){
  const raw=planningParamValue("PLANNING_SEMAINES_DISPONIBLES","2,3,4");
  const vals=[...new Set(raw.split(/[,;\s]+/).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=8))].sort((a,b)=>a-b);
  return vals.length?vals:[2,3,4];
}
function planningDefaultWeeks(){
  const options=planningWeekOptions();
  const d=Number(planningParamValue("PLANNING_SEMAINES_DEFAUT","2"));
  return options.includes(d)?d:options[0];
}
async function initPlanningParamsTable(){
  if(!(S.isAdmin||S.isOwner))return;
  if(!await gristTableExists(T.planningParams)){
    await grist.docApi.applyUserActions([["AddTable",T.planningParams,[{id:"Cle",type:"Text"},{id:"Valeur",type:"Text"},{id:"Commentaire",type:"Text"}]]]);
  }
  const existing=await table(T.planningParams),keys=new Set(existing.map(r=>norm(F(r,"Cle"))));
  const defs=[
    ["PLANNING_SEMAINES_DISPONIBLES","2,3,4","Durées proposées dans le planning, en semaines (1 à 8)"],
    ["PLANNING_SEMAINES_DEFAUT","2","Durée sélectionnée par défaut dans le planning"],
    ["PLANNING_COULEUR_AP","#FFD54F","Couleur des absences prévisionnelles (AP)"],
    ["MASQUER_DEMANDES_INTERNES","true","Masquer les menus de demandes aux ressources internes, sauf Manager / PMO"]
  ];
  const actions=defs.filter(x=>!keys.has(x[0])).map(x=>["AddRecord",T.planningParams,null,{Cle:x[0],Valeur:x[1],Commentaire:x[2]}]);
  if(actions.length)await grist.docApi.applyUserActions(actions);
  await ensurePlanningKpiTable();await loadPlanningParams();await loadPlanningKpiRules();showSyncAdminMsg("planningParamsMsg","Paramètres planning initialisés / complétés.");
}
async function loadPlanningParams(){
  const exists=await gristTableExists(T.planningParams);
  S.planningParamsReady=exists;S.planningParams=exists?await table(T.planningParams):[];
  const opts=planningWeekOptions();
  if(!opts.includes(Number(S.planningWeeks)))S.planningWeeks=planningDefaultWeeks();
  const setup=$("planningParamsSetupText");if(setup)setup.innerHTML=exists?`<strong>PARAM_PLANNING</strong> disponible · ${S.planningParams.length} paramètre(s).`:`<strong>PARAM_PLANNING</strong> absente.`;
  $("planningParamsManager")?.classList.toggle("hidden",!exists);
  if(exists&&$("planningParamsManager"))renderPlanningParamsAdmin();
  applyForecastTheme();
  if(S.person)applyNavigationPermissions();
  if($("planningWeeks"))renderPlanningWeekSelect();
}
function renderPlanningParamsAdmin(){
  const allowed=new Set(planningWeekOptions()),def=planningDefaultWeeks();
  const box=$("planningWeekChoices");
  if(box)box.innerHTML=Array.from({length:8},(_,i)=>i+1).map(n=>`<label class="planning-week-choice"><input type="checkbox" value="${n}" ${allowed.has(n)?"checked":""}><span>${n} semaine${n>1?"s":""}</span></label>`).join("");
  const sel=$("planningDefaultWeeks");if(sel){sel.innerHTML=[...allowed].sort((a,b)=>a-b).map(n=>`<option value="${n}">${n} semaine${n>1?"s":""}</option>`).join("");sel.value=String(def);}
  const ap=validHexColor(planningParamValue("PLANNING_COULEUR_AP","#FFD54F"))||"#ffd54f";
  const picker=$("planningForecastColor"),hex=$("planningForecastColorHex"),preview=$("planningForecastColorPreview");
  if(picker)picker.value=ap;if(hex)hex.value=ap.toUpperCase();if(preview)preview.style.background=ap;
  const internalToggle=$("planningHideInternalRequests");
  if(internalToggle)internalToggle.checked=hideRequestsForInternalsEnabled();
}
async function savePlanningParams(){
  if(!(S.isAdmin||S.isOwner))return;
  const selected=[...document.querySelectorAll('#planningWeekChoices input[type="checkbox"]:checked')].map(x=>Number(x.value)).filter(Boolean).sort((a,b)=>a-b);
  if(!selected.length)throw new Error("Sélectionnez au moins une durée de planning.");
  const def=Number($("planningDefaultWeeks")?.value||selected[0]);
  const actualDefault=selected.includes(def)?def:selected[0];
  const tbl=grist.getTable(T.planningParams);
  const byKey=Object.fromEntries((S.planningParams||[]).map(r=>[norm(F(r,"Cle")),r]));
  const apColor=validHexColor($("planningForecastColorHex")?.value)||validHexColor($("planningForecastColor")?.value)||"#ffd54f";
  const hideInternal=$("planningHideInternalRequests")?.checked!==false;
  const values=[["PLANNING_SEMAINES_DISPONIBLES",selected.join(",")],["PLANNING_SEMAINES_DEFAUT",String(actualDefault)],["PLANNING_COULEUR_AP",apColor.toUpperCase()],["MASQUER_DEMANDES_INTERNES",hideInternal?"true":"false"]];
  const comments={PLANNING_SEMAINES_DISPONIBLES:"Durées proposées dans le planning, en semaines (1 à 8)",PLANNING_SEMAINES_DEFAUT:"Durée sélectionnée par défaut dans le planning",PLANNING_COULEUR_AP:"Couleur des absences prévisionnelles (AP)",MASQUER_DEMANDES_INTERNES:"Masquer les menus de demandes aux ressources internes, sauf Manager / PMO"};
  for(const [key,value] of values){
    if(byKey[key])await tbl.update({id:byKey[key].id,fields:{Valeur:value}});
    else await tbl.create({fields:{Cle:key,Valeur:value,Commentaire:comments[key]||""}});
  }
  await loadPlanningParams();S.planningWeeks=planningDefaultWeeks();applyForecastTheme();applyNavigationPermissions();renderPlanning();showSyncAdminMsg("planningParamsMsg","Paramètres du planning enregistrés.");
}
function renderPlanningWeekSelect(){
  const sel=$("planningWeeks");if(!sel)return;
  const opts=planningWeekOptions(),current=opts.includes(Number(S.planningWeeks))?Number(S.planningWeeks):planningDefaultWeeks();
  S.planningWeeks=current;
  sel.innerHTML=opts.map(n=>`<option value="${n}">${n} semaine${n>1?"s":""}</option>`).join("");
  sel.value=String(current);
}

function forecastColor(){
  return validHexColor(planningParamValue("PLANNING_COULEUR_AP","#FFD54F"))||"#ffd54f";
}
function applyForecastTheme(){
  const root=document.documentElement;if(!root)return;
  const solid=forecastColor();
  root.style.setProperty("--forecast-bg",rgbaFromHex(solid,.18)||solid);
  root.style.setProperty("--forecast-border",rgbaFromHex(solid,.52)||solid);
  root.style.setProperty("--forecast-text",darkenHex(solid,.5));
  root.style.setProperty("--forecast-solid-bg",solid);
  root.style.setProperty("--forecast-solid-border",solid);
  root.style.setProperty("--forecast-solid-text",contrastColor(solid));
}
function syncPlanningForecastColorUi(color){
  const c=validHexColor(color);if(!c)return false;
  const picker=$("planningForecastColor"),hex=$("planningForecastColorHex"),preview=$("planningForecastColorPreview");
  if(picker&&picker.value.toLowerCase()!==c)picker.value=c;
  if(hex&&hex.value.toLowerCase()!==c)hex.value=c.toUpperCase();
  if(preview)preview.style.background=c;
  return true;
}

function planningCurrentRole(){
  if(S.isOwner)return "OWNER";
  if(S.isAdmin)return "ADMIN";
  if(isPmo())return "PMO";
  if(currentProfile()==="MANAGER"||(S.managedResources||[]).length||(S.managerLinks||[]).some(x=>F(x,"Actif")!==false))return "MANAGER";
  return "COLLABORATEUR";
}
const PLANNING_KPI_DEFS=[
  ["RESSOURCES","Ressources affichées"],
  ["ABSENCES_PREVISIONNELLES","Absences prévisionnelles"],
  ["TAUX_PRESENCE_PERIODE","Taux de présence période"],
  ["PRESENCE_ANNUELLE","Présence annuelle"],
  ["ABSENCE_ANNUELLE","Absences annuelles"],
  ["TAUX_PRESENCE_ANNUEL","Taux de présence annuel"],
  ["PAR_RESSOURCES","Bouton Par ressources"]
];
const PLANNING_ROLE_DEFS=["COLLABORATEUR","MANAGER","PMO","ADMIN","OWNER"];
async function ensurePlanningKpiTable(){
  if(!(S.isAdmin||S.isOwner))return false;
  if(!await gristTableExists(T.planningKpis)){
    await grist.docApi.applyUserActions([["AddTable",T.planningKpis,[
      {id:"Indicateur",type:"Text"},{id:"Role",type:"Text"},{id:"Ressource",type:"Ref:Ressources"},{id:"Visible",type:"Bool"},{id:"Commentaire",type:"Text"}
    ]]]);
  }
  const existing=await table(T.planningKpis),keys=new Set(existing.map(r=>`${norm(F(r,"Indicateur")).toUpperCase()}|${norm(F(r,"Role")).toUpperCase()}|${Number(rid(F(r,"Ressource"))||0)}`));
  const actions=[];
  for(const [k,label] of PLANNING_KPI_DEFS){
    for(const role of PLANNING_ROLE_DEFS){
      const key=`${k}|${role}|0`;if(keys.has(key))continue;
      let visible=true;
      if(k==="ABSENCES_PREVISIONNELLES"&&!['PMO','ADMIN','OWNER'].includes(role))visible=false;
      if(k==="PAR_RESSOURCES"&&role==="COLLABORATEUR")visible=false;
      actions.push(["AddRecord",T.planningKpis,null,{Indicateur:k,Role:role,Ressource:0,Visible:visible,Commentaire:`${label} · règle par rôle`}]);
    }
  }
  if(actions.length)await grist.docApi.applyUserActions(actions);
  return true;
}
async function loadPlanningKpiRules(){
  const exists=await gristTableExists(T.planningKpis);
  S.planningKpiReady=exists;S.planningKpiRules=exists?await table(T.planningKpis):[];
  if($('planningKpiSetupText'))$('planningKpiSetupText').innerHTML=exists?`<strong>${T.planningKpis}</strong> disponible · ${S.planningKpiRules.length} règle(s).`:`<strong>${T.planningKpis}</strong> absente.`;
  $('planningKpiManager')?.classList.toggle('hidden',!exists);
  if(exists&&(S.isAdmin||S.isOwner))renderPlanningKpiAdmin();
}
function planningKpiVisible(indicator){
  const key=norm(indicator).toUpperCase(),role=planningCurrentRole(),resourceId=Number(S.person?.id||0);
  const rules=(S.planningKpiRules||[]).filter(r=>norm(F(r,"Indicateur")).toUpperCase()===key);
  const resourceRule=rules.find(r=>Number(rid(F(r,"Ressource"))||0)===resourceId && resourceId>0);
  if(resourceRule)return F(resourceRule,"Visible")!==false;
  const roleRule=rules.find(r=>!Number(rid(F(r,"Ressource"))||0)&&norm(F(r,"Role")).toUpperCase()===role);
  return roleRule?F(roleRule,"Visible")!==false:true;
}
function applyPlanningKpiVisibility(){
  const map={RESSOURCES:'planningCount',ABSENCES_PREVISIONNELLES:'planningForecastCount',TAUX_PRESENCE_PERIODE:'planningPresenceRate',PRESENCE_ANNUELLE:'planningAnnualWorked',ABSENCE_ANNUELLE:'planningAnnualAbsence',TAUX_PRESENCE_ANNUEL:'planningAnnualPresenceRate',PAR_RESSOURCES:'planningAnnualByResourceBtn'};
  for(const [k,id] of Object.entries(map)){const el=$(id);if(el)el.classList.toggle('kpi-hidden-by-rule',!planningKpiVisible(k));}
}
function renderPlanningKpiAdmin(){
  const body=$('planningKpiRoleRows');if(!body)return;
  const rows=[];
  for(const [k,label] of PLANNING_KPI_DEFS){
    const cells=PLANNING_ROLE_DEFS.map(role=>{const r=(S.planningKpiRules||[]).find(x=>norm(F(x,'Indicateur')).toUpperCase()===k&&norm(F(x,'Role')).toUpperCase()===role&&!Number(rid(F(x,'Ressource'))||0));return `<td><input type="checkbox" data-kpi-rule-id="${r?.id||''}" data-kpi="${k}" data-role="${role}" ${r&&F(r,'Visible')===false?'':'checked'}></td>`}).join('');
    rows.push(`<tr><td><strong>${esc(label)}</strong><small class="kpi-code">${esc(k)}</small></td>${cells}</tr>`);
  }
  body.innerHTML=rows.join('');
  const sel=$('planningKpiResourceSelect');if(sel)sel.innerHTML='<option value="">— Ressource —</option>'+(S.resources||[]).filter(r=>F(r,'Actif','actif')!==false).sort((a,b)=>resLabel(a).localeCompare(resLabel(b),'fr')).map(r=>`<option value="${r.id}">${esc(resLabel(r))}</option>`).join('');
  renderPlanningKpiOverrides();
}
function renderPlanningKpiOverrides(){
  const body=$('planningKpiOverrideRows');if(!body)return;
  const overrides=(S.planningKpiRules||[]).filter(r=>Number(rid(F(r,'Ressource'))||0)>0);
  body.innerHTML=overrides.map(r=>{const rr=resourceById(rid(F(r,'Ressource')));const def=PLANNING_KPI_DEFS.find(x=>x[0]===norm(F(r,'Indicateur')).toUpperCase());return `<tr><td>${esc(rr?resLabel(rr):'Ressource #'+rid(F(r,'Ressource')))}</td><td>${esc(def?.[1]||F(r,'Indicateur')||'')}</td><td>${F(r,'Visible')===false?'Masqué':'Visible'}</td><td><button type="button" class="table-action" data-kpi-override-remove="${r.id}">Retirer</button></td></tr>`}).join('')||'<tr><td colspan="4">Aucune dérogation par ressource.</td></tr>';
  body.querySelectorAll('[data-kpi-override-remove]').forEach(b=>b.onclick=()=>removePlanningKpiOverride(Number(b.dataset.kpiOverrideRemove)).catch(e=>showSyncAdminMsg('planningParamsMsg',e?.message||String(e),'danger')));
}
async function savePlanningKpiRoleRules(){
  if(!(S.isAdmin||S.isOwner))return;
  const tbl=grist.getTable(T.planningKpis);
  for(const cb of document.querySelectorAll('#planningKpiRoleRows input[type="checkbox"]')){
    const id=Number(cb.dataset.kpiRuleId||0),fields={Indicateur:cb.dataset.kpi,Role:cb.dataset.role,Ressource:0,Visible:cb.checked,Commentaire:'Règle par rôle'};
    if(id)await tbl.update({id,fields});else await tbl.create({fields});
  }
  await loadPlanningKpiRules();renderPlanning();showSyncAdminMsg('planningParamsMsg','Visibilité des indicateurs enregistrée.');
}
async function addPlanningKpiOverride(){
  if(!(S.isAdmin||S.isOwner))return;
  const resourceId=Number($('planningKpiResourceSelect')?.value||0),indicator=norm($('planningKpiIndicatorSelect')?.value).toUpperCase(),visible=$('planningKpiOverrideVisible')?.value!=='false';
  if(!resourceId||!indicator)throw new Error('Sélectionnez une ressource et un indicateur.');
  const tbl=grist.getTable(T.planningKpis),old=(S.planningKpiRules||[]).find(r=>Number(rid(F(r,'Ressource'))||0)===resourceId&&norm(F(r,'Indicateur')).toUpperCase()===indicator);
  const fields={Indicateur:indicator,Role:'',Ressource:resourceId,Visible:visible,Commentaire:'Dérogation ressource'};
  if(old)await tbl.update({id:old.id,fields});else await tbl.create({fields});
  await loadPlanningKpiRules();showSyncAdminMsg('planningParamsMsg','Dérogation ressource enregistrée.');
}
async function removePlanningKpiOverride(id){await grist.docApi.applyUserActions([["RemoveRecord",T.planningKpis,id]]);await loadPlanningKpiRules();renderPlanning();}

async function initSyncRequestsTable(){
  if(!(S.isAdmin||S.isOwner))return;
  if(!await gristTableExists(T.syncRequests)){await grist.docApi.applyUserActions([["AddTable",T.syncRequests,[
    {id:"Date_Debut",type:"Date"},{id:"Date_Fin",type:"Date"},{id:"Type_Synchro",type:"Text"},{id:"Statut",type:"Text"},{id:"Demandee_Par",type:"Text"},{id:"Date_Demande",type:"DateTime:UTC"},{id:"Date_Debut_Execution",type:"DateTime:UTC"},{id:"Date_Fin_Execution",type:"DateTime:UTC"},{id:"Nb_Lignes_Lues",type:"Int"},{id:"Nb_Lignes_Creees",type:"Int"},{id:"Nb_Lignes_MAJ",type:"Int"},{id:"Nb_Erreurs",type:"Int"},{id:"Message",type:"Text"},{id:"Force_Full",type:"Bool"}
  ]] ]);}
  await loadSyncRequests();showSyncAdminMsg('syncRequestsMsg','DEMANDES_SYNCHRO initialisée.');
}
async function loadSyncRequests(){
  if(!(S.isAdmin||S.isOwner))return;const exists=await gristTableExists(T.syncRequests);S.syncRequestsReady=exists;S.syncRequests=exists?await table(T.syncRequests):[];
  $('syncRequestsSetupText').innerHTML=exists?`<strong>DEMANDES_SYNCHRO</strong> disponible · ${S.syncRequests.length} demande(s).`:`<strong>DEMANDES_SYNCHRO</strong> absente.`;
  $('syncRequestsManager')?.classList.toggle('hidden',!exists);if(exists)renderSyncRequests();
}
function renderSyncRequests(){
  const body=$('syncRequestsRows');if(!body)return;const list=[...(S.syncRequests||[])].sort((a,b)=>Number(F(b,'Date_Demande')||0)-Number(F(a,'Date_Demande')||0)).slice(0,100);
  body.innerHTML=list.length?list.map(r=>{const stt=norm(F(r,'Statut'))||'—';const cls=stt==='TERMINEE'?'ok':stt==='ERREUR'?'err':stt==='EN_COURS'?'busy':'off';const result=[F(r,'Nb_Lignes_Lues')!=null?`Lues ${Number(F(r,'Nb_Lignes_Lues')||0)}`:'',F(r,'Nb_Lignes_Creees')!=null?`Créées ${Number(F(r,'Nb_Lignes_Creees')||0)}`:'',F(r,'Nb_Lignes_MAJ')!=null?`MAJ ${Number(F(r,'Nb_Lignes_MAJ')||0)}`:'',F(r,'Nb_Erreurs')!=null?`Erreurs ${Number(F(r,'Nb_Erreurs')||0)}`:'',norm(F(r,'Message'))].filter(Boolean).join(' · ');return `<tr><td>${esc(frDateTime(F(r,'Date_Demande')))}</td><td>${esc(frDate(F(r,'Date_Debut')))} → ${esc(frDate(F(r,'Date_Fin')))}</td><td>${esc(F(r,'Type_Synchro')||'—')}${F(r,'Force_Full')?' · FULL':''}</td><td><span class="state ${cls}">${esc(stt)}</span></td><td>${esc(F(r,'Demandee_Par')||'—')}</td><td>${esc(result||'—')}</td></tr>`}).join(''):'<tr><td colspan="6">Aucune demande de synchronisation.</td></tr>';
}
function setSyncCurrentYear(){const y=new Date().getFullYear();$('syncReqStart').value=`${y}-01-01`;$('syncReqEnd').value=`${y}-12-31`;$('syncReqFull').value='true'}
async function createSyncRequest(){
  if(!(S.isAdmin||S.isOwner))return;if(!S.syncRequestsReady)await initSyncRequestsTable();const a=$('syncReqStart').value,b=$('syncReqEnd').value;if(!a||!b)throw new Error('Renseignez les dates de début et de fin.');if(a>b)throw new Error('La date de fin doit être postérieure à la date de début.');
  const epoch=s=>Math.floor(new Date(`${s}T00:00:00`).getTime()/1000);const who=email(S.user?.email)||email(F(S.person,'Email'))||'ADMIN';await grist.getTable(T.syncRequests).create({fields:{Date_Debut:epoch(a),Date_Fin:epoch(b),Type_Synchro:'MANUELLE',Statut:'EN_ATTENTE',Demandee_Par:who,Date_Demande:Math.floor(Date.now()/1000),Force_Full:$('syncReqFull').value==='true'}});
  await loadSyncRequests();showSyncAdminMsg('syncRequestsMsg','Demande déposée. Elle sera traitée par RH-SYNC dès que le moteur backend sera configuré pour consommer DEMANDES_SYNCHRO.');
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
  const input=document.querySelector(`.label-input[data-label-key="${CSS.escape(key)}"]`), value=norm(input?.value);
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

    applyNavigationPermissions();
    applyViewAs();
    render();
    if(S.planningReady)renderPlanning();
  }catch(e){
    console.warn("Mode manager indisponible:",e);
    S.managerLinks=[];S.managedResources=[];S.viewAs=null;
    applyNavigationPermissions();
    applyViewAs();
    if(S.planningReady)renderPlanning();
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

function managerGuideAllowed(){
  return isPmo()||currentProfile()==="MANAGER"||(S.managedResources||[]).length>0;
}
function resourceInternalExternalProfile(resource){
  return norm(F(resource||{},"Profil_interne_externe","Type")).toUpperCase();
}
function internalExternalProfile(){
  return resourceInternalExternalProfile(S.person);
}
function autoValidationForResource(resource){
  return resourceInternalExternalProfile(resource)==="INTERNE";
}
function autoValidationForResourceId(resourceId){
  const resource=(S.resources||[]).find(r=>Number(r.id)===Number(resourceId));
  return autoValidationForResource(resource);
}
function hideRequestsForInternalsEnabled(){
  const raw=planningParamValue("MASQUER_DEMANDES_INTERNES","true").toLowerCase();
  return !["false","0","non","no","off","desactive","désactivé","desactivé"].includes(raw);
}
function requestMenusAllowed(){
  // Règle V1.92 : une ressource INTERNE standard peut être privée des menus de demandes,
  // mais ce comportement est désormais débrayable dans Administration > Paramètres planning.
  if(!hideRequestsForInternalsEnabled())return true;
  if(internalExternalProfile()!=="INTERNE")return true;
  return isPmo()||currentProfile()==="MANAGER"||(S.managedResources||[]).length>0||(S.managerLinks||[]).some(x=>F(x,"Actif")!==false);
}
function importCongesAllowed(){
  return internalExternalProfile()==="INTERNE"||isPmo()||currentProfile()==="MANAGER"||(S.managedResources||[]).length>0||(S.managerLinks||[]).some(x=>F(x,"Actif")!==false);
}
function importAccessibleResources(){
  if(!importCongesAllowed())return [];
  if(isPmo()||S.isAdmin||S.isOwner)return (S.resources||[]).filter(r=>F(r,"Actif")!==false);
  if(currentProfile()==="MANAGER"||(S.managedResources||[]).length){
    const ids=new Set([Number(S.person?.id||0),...(S.managedResources||[]).map(r=>Number(r.id))]);
    return (S.resources||[]).filter(r=>ids.has(Number(r.id))&&F(r,"Actif")!==false);
  }
  return S.person?[S.person]:[];
}
function applyRequestMenuVisibility(){
  const allowed=requestMenusAllowed();
  document.querySelectorAll('[data-request-menu="true"]').forEach(el=>el.classList.toggle("hidden",!allowed));
  // Autres demandes conserve en plus sa règle historique ADMIN/OWNER.
  const allNav=$("allRequestsNav");
  if(allNav)allNav.classList.toggle("hidden",!(allowed&&(S.isAdmin||S.isOwner)));
}
function applyNavigationPermissions(){
  applyRequestMenuVisibility();
  $("documentationNav")?.classList.remove("hidden");
  $("guideUserNav")?.classList.remove("hidden");
  $("guideManagerNav")?.classList.toggle("hidden",!managerGuideAllowed());
  $("guideAdminNav")?.classList.toggle("hidden",!S.isOwner);
  $("importCongesNav")?.classList.toggle("hidden",!importCongesAllowed());
  $("adminNav")?.classList.toggle("hidden",!(S.isAdmin||S.isOwner));
  document.querySelectorAll(".owner-only").forEach(el=>el.classList.toggle("hidden",!S.isOwner));
  document.querySelectorAll(".manager-admin-only").forEach(el=>el.classList.toggle("hidden",!(S.isAdmin||S.isOwner)));
  document.querySelectorAll(".admin-config-only").forEach(el=>el.classList.toggle("hidden",!(S.isAdmin||S.isOwner)));
}

function showView(name){
  if(name==="importConges"&&!importCongesAllowed())name="home";
  if(name==="importConfig"&&!(S.isAdmin||S.isOwner))name="home";
  if(["new","mine","all"].includes(name)&&!requestMenusAllowed()){
    name="home";
  }
  if(S.viewAs && name==="new")return;
  if(name==="guideManager"&&!managerGuideAllowed())return;
  if(name==="guideAdmin"&&!S.isOwner)return;
  if(["resources","motifs","presenceMap","acl","sync"].includes(name)&&!S.isOwner)return;
  if(name==="managers"&&!(S.isAdmin||S.isOwner))return;
  if(name==="labels"&&!(S.isAdmin||S.isOwner))return;
  if(name==="menuOrder"&&!(S.isAdmin||S.isOwner))return;
  if(["syncParams","syncRequests","planningParams"].includes(name)&&!(S.isAdmin||S.isOwner))return;
  if(name==="all"&&!(S.isAdmin||S.isOwner))return;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(v=>v.classList.remove("active"));
  document.getElementById(`view-${name}`)?.classList.add("active");
  document.querySelector(`.nav[data-view="${name}"]`)?.classList.add("active");
  const titles={home:["page.home","Bonjour"],new:["page.new","Nouvelle demande"],mine:["page.mine","Mes demandes"],planning:["page.planning","Planning présence"],all:["page.all","Autres demandes"],guideUser:["page.guides","Guide utilisateur"],guideManager:["page.guides","Guide manager"],guideAdmin:["page.guides","Guide administrateur"],resources:["page.resources","Ressources"],motifs:["page.motifs","Motifs RH"],presenceMap:["page.presenceMap","Correspondance présence"],acl:["page.acl","ACL & Permissions"],sync:["page.sync","Synchronisation"],managers:["page.managers","Managers & Ressources"],labels:["page.labels","Libellés de l’application"],menuOrder:["page.menuOrder","Ordre des menus"],syncParams:["page.syncParams","Paramètres de synchro"],syncRequests:["page.syncRequests","Demandes de synchro"],planningParams:["page.planningParams","Paramètres planning"]};
  if(name==="presenceMap")setTimeout(()=>renderPresenceMapAdmin().catch(showPresenceMapError),0);
  if(name==="importConges")setTimeout(()=>renderImportConges().catch(e=>showImportMsg(e?.message||String(e),"danger")),0);
  if(name==="importConfig")setTimeout(()=>renderImportConfigAdmin().catch(e=>showImportConfigMsg(e?.message||String(e),"danger")),0);
  if(name==="planning")setTimeout(()=>loadPlanning().catch(showPlanningError),0);
  if(name==="syncParams")setTimeout(()=>loadSyncParams().catch(e=>showSyncAdminMsg("syncParamsMsg",e?.message||String(e),"danger")),0);
  if(name==="syncRequests")setTimeout(()=>loadSyncRequests().catch(e=>showSyncAdminMsg("syncRequestsMsg",e?.message||String(e),"danger")),0);
  if(name==="planningParams")setTimeout(()=>loadPlanningParams().catch(e=>showSyncAdminMsg("planningParamsMsg",e?.message||String(e),"danger")),0);
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
  applyNavigationPermissions();
}
function bindNav(){
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
}

// V1.93 — Import annuel de congés depuis une image (OCR classique, sans IA générative)
async function importTableExists(name){return gristTableExists(name)}
async function ensureImportTables(){
  let importConfigCreated=false;
  if(!await importTableExists(T.importConfig)){await grist.docApi.applyUserActions([["AddTable",T.importConfig,[
    {id:"Code_Import",type:"Text",label:"Code import"},{id:"Motif",type:"Ref:"+T.motifs,label:"Motif RH"},{id:"Type_Demande",type:"Text",label:"Type demande"},{id:"Confiance_Min",type:"Int",label:"Confiance minimale"},{id:"Actif",type:"Bool",label:"Actif"},{id:"Couleur_Attendue",type:"Text",label:"Couleur attendue"},{id:"Tolerance_Couleur",type:"Int",label:"Tolérance couleur"},{id:"Creer_Demande",type:"Bool",label:"Créer une demande"},{id:"Commentaire",type:"Text",label:"Commentaire"}
  ]]]);importConfigCreated=true;}
  if(!importConfigCreated){
    let creerAjoute=false;
    for(const col of [
      {id:"Couleur_Attendue",type:"Text",label:"Couleur attendue"},
      {id:"Tolerance_Couleur",type:"Int",label:"Tolérance couleur"},
      {id:"Creer_Demande",type:"Bool",label:"Créer une demande"}
    ]){try{await grist.docApi.applyUserActions([["AddColumn",T.importConfig,col.id,{type:col.type,label:col.label}]]);if(col.id==="Creer_Demande")creerAjoute=true;}catch(e){}}
    if(creerAjoute){try{const existing=rows(await grist.docApi.fetchTable(T.importConfig));const t=grist.getTable(T.importConfig);for(const r of existing)await t.update({id:r.id,fields:{Creer_Demande:true}});}catch(e){}}
  }
  try{const cfgRows=rows(await grist.docApi.fetchTable(T.importConfig));if(!cfgRows.some(importIsDefaultRow))await grist.getTable(T.importConfig).create({fields:{Code_Import:IMPORT_DEFAULT_CODE,Type_Demande:"PRESENCE",Confiance_Min:70,Tolerance_Couleur:80,Creer_Demande:false,Actif:true,Commentaire:"Valeurs par défaut du module d’import"}});}catch(e){}
  if(!await importTableExists(T.importRuns))await grist.docApi.applyUserActions([["AddTable",T.importRuns,[
    {id:"Ressource",type:"Ref:"+T.resources,label:"Ressource"},{id:"Annee",type:"Int",label:"Année"},{id:"Fichier_Nom",type:"Text",label:"Fichier"},{id:"Date_Import",type:"DateTime:UTC",label:"Date import"},{id:"Importe_Par",type:"Text",label:"Importé par"},{id:"Statut",type:"Text",label:"Statut"},{id:"Nb_Codes_Detectes",type:"Int",label:"Codes détectés"},{id:"Nb_Demandes_Creees",type:"Int",label:"Demandes créées"},{id:"Nb_Erreurs",type:"Int",label:"Erreurs"},{id:"Message",type:"Text",label:"Message"}
  ]]]);
  if(!await importTableExists(T.importLines))await grist.docApi.applyUserActions([["AddTable",T.importLines,[
    {id:"Import",type:"Ref:"+T.importRuns,label:"Import"},{id:"Code_Import",type:"Text",label:"Code import"},{id:"Motif",type:"Ref:"+T.motifs,label:"Motif RH"},{id:"Date_Debut",type:"Date",label:"Date début"},{id:"Date_Fin",type:"Date",label:"Date fin"},{id:"Confiance",type:"Numeric",label:"Confiance"},{id:"Statut",type:"Text",label:"Statut"},{id:"Demande_Creee",type:"Ref:"+T.requests,label:"Demande créée"},{id:"Message",type:"Text",label:"Message"}
  ]]]);
}
async function loadImportConfig(){
  if(!await importTableExists(T.importConfig)){S.importConfigRows=[];return false}
  S.importConfigRows=rows(await grist.docApi.fetchTable(T.importConfig));return true;
}
function showImportMsg(t,kind=""){const e=$("importCongesMsg");if(!e)return;e.textContent=t;e.className=`alert ${kind}`;e.classList.remove("hidden")}
function showImportConfigMsg(t,kind=""){const e=$("importConfigMsg");if(!e)return;e.textContent=t;e.className=`alert ${kind}`;e.classList.remove("hidden")}
function importCode(v){return norm(v).toUpperCase().replace(/[^A-Z0-9]/g,"")}
const IMPORT_DEFAULT_CODE="__DEFAUT__";
function importIsDefaultRow(r){return norm(F(r,"Code_Import"))===IMPORT_DEFAULT_CODE}
function importDefaultRow(){return (S.importConfigRows||[]).find(importIsDefaultRow)||null}
function importDefaultMotifId(){const r=importDefaultRow();return r?rid(F(r,"Motif")):0}
function importDefaultType(){const r=importDefaultRow();return norm(r?F(r,"Type_Demande"):"")||"PRESENCE"}
function importActiveMappings(){const dm=importDefaultMotifId();return (S.importConfigRows||[]).filter(r=>!importIsDefaultRow(r)&&F(r,"Actif")!==false&&importCode(F(r,"Code_Import"))&&(rid(F(r,"Motif"))||dm))}
function validHexColor(v){const x=norm(v).toUpperCase();return /^#[0-9A-F]{6}$/.test(x)?x:""}
function hexRgb(hex){const x=validHexColor(hex);return x?{r:parseInt(x.slice(1,3),16),g:parseInt(x.slice(3,5),16),b:parseInt(x.slice(5,7),16)}:null}
function rgbDistance(a,b){if(!a||!b)return 0;return Math.sqrt((a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2)}
async function renderImportConfigAdmin(){
  if(!(S.isAdmin||S.isOwner))return;
  if(await importTableExists(T.importConfig))await ensureImportTables();
  const exists=await loadImportConfig();
  const mappingRows=(S.importConfigRows||[]).filter(r=>!importIsDefaultRow(r));
  $("importConfigSetupText").innerHTML=exists?`<strong>${T.importConfig}</strong> disponible · ${mappingRows.length} code(s).`:`<strong>${T.importConfig}</strong> absente.`;
  $("importConfigManager").classList.toggle("hidden",!exists);
  if(!exists)return;
  const body=$("importConfigRows");
  const opts='<option value="">— Choisir —</option>'+S.motifs.map(m=>`<option value="${m.id}">${esc(F(m,"Code")||"")} · ${esc(F(m,"Libelle")||"")}${F(m,"Actif")===false?' (inactif)':''}</option>`).join("");
  const def=importDefaultRow();
  const dm=$("importDefaultMotif"); if(dm){dm.innerHTML=opts;dm.value=String(importDefaultMotifId()||"");}
  const dt=$("importDefaultType"); if(dt)dt.value=importDefaultType();
  body.innerHTML=mappingRows.length?mappingRows.map(r=>`<tr>
    <td><input data-ic-code="${r.id}" value="${esc(F(r,"Code_Import")||"")}" maxlength="12"></td>
    <td><select data-ic-motif="${r.id}">${opts}</select></td>
    <td><select data-ic-type="${r.id}"><option value="CONGE">Congé</option><option value="ABSENCE">Absence</option><option value="PRESENCE">Présence</option><option value="AUCUN_IMPACT">Aucun impact</option></select></td>
    <td><input data-ic-conf="${r.id}" type="number" min="0" max="100" value="${Number(F(r,"Confiance_Min")??70)}"></td>
    <td>${(()=>{const c=validHexColor(F(r,"Couleur_Attendue"))||"";const picker=c||"#FFFFFF";return `<div class="import-color-control"><label class="import-color-picker" title="Choisir la couleur attendue"><span class="import-color-preview" data-ic-color-preview="${r.id}" style="background:${esc(picker)}"></span><input type="color" data-ic-color-picker="${r.id}" value="${esc(picker)}" aria-label="Choisir la couleur attendue pour ${esc(F(r,"Code_Import")||"ce code")}"></label><input data-ic-color="${r.id}" class="import-color-text" value="${esc(c)}" placeholder="#RRGGBB" maxlength="7" spellcheck="false"><button type="button" class="table-action small" data-ic-color-clear="${r.id}" title="Effacer la couleur">Effacer</button></div>`})()}</td>
    <td><input data-ic-tol="${r.id}" type="number" min="0" max="442" value="${Number(F(r,"Tolerance_Couleur")??80)}"></td>
    <td><input data-ic-create="${r.id}" type="checkbox" ${F(r,"Creer_Demande")!==false?'checked':''}></td>
    <td><input data-ic-active="${r.id}" type="checkbox" ${F(r,"Actif")!==false?'checked':''}></td>
    <td><input data-ic-comment="${r.id}" value="${esc(F(r,"Commentaire")||"")}"></td>
    <td><div class="row-actions"><button class="table-action" data-ic-save="${r.id}">Enregistrer</button><button class="table-action danger" data-ic-delete="${r.id}" type="button">Supprimer</button></div></td>
  </tr>`).join(""):'<tr><td colspan="10">Aucun code configuré.</td></tr>';
  for(const r of mappingRows){const m=document.querySelector(`[data-ic-motif="${r.id}"]`);if(m)m.value=String(rid(F(r,"Motif"))||"");const t=document.querySelector(`[data-ic-type="${r.id}"]`);if(t)t.value=norm(F(r,"Type_Demande"))||importDefaultType();}
  document.querySelectorAll('[data-ic-save]').forEach(b=>b.onclick=()=>saveImportConfigRow(Number(b.dataset.icSave)).catch(e=>showImportConfigMsg(e?.message||String(e),"danger")));
  document.querySelectorAll('[data-ic-delete]').forEach(b=>b.onclick=()=>deleteImportConfigRow(Number(b.dataset.icDelete)).catch(e=>showImportConfigMsg(e?.message||String(e),"danger")));
  document.querySelectorAll('[data-ic-color-picker]').forEach(p=>p.oninput=()=>{const id=p.dataset.icColorPicker,hex=document.querySelector(`[data-ic-color="${id}"]`),preview=document.querySelector(`[data-ic-color-preview="${id}"]`);if(hex)hex.value=String(p.value||"").toUpperCase();if(preview)preview.style.background=p.value||"#FFFFFF";});
  document.querySelectorAll('[data-ic-color]').forEach(h=>{h.oninput=()=>{const id=h.dataset.icColor,c=validHexColor(h.value),picker=document.querySelector(`[data-ic-color-picker="${id}"]`),preview=document.querySelector(`[data-ic-color-preview="${id}"]`);if(c){if(picker)picker.value=c;if(preview)preview.style.background=c;}};});
  document.querySelectorAll('[data-ic-color-clear]').forEach(b=>b.onclick=()=>{const id=b.dataset.icColorClear,hex=document.querySelector(`[data-ic-color="${id}"]`),picker=document.querySelector(`[data-ic-color-picker="${id}"]`),preview=document.querySelector(`[data-ic-color-preview="${id}"]`);if(hex)hex.value="";if(picker)picker.value="#FFFFFF";if(preview)preview.style.background="#FFFFFF";});
}

async function deleteImportConfigRow(id){
  const r=(S.importConfigRows||[]).find(x=>Number(x.id)===Number(id));
  if(!r)throw new Error("Correspondance OCR introuvable.");
  if(importIsDefaultRow(r))throw new Error("La ligne de valeurs par défaut ne peut pas être supprimée.");
  const code=importCode(F(r,"Code_Import"))||`#${id}`;
  if(!window.confirm(`Supprimer la correspondance OCR ${code} ?\n\nLes demandes et historiques déjà créés ne seront pas supprimés.`))return;
  await grist.docApi.applyUserActions([["RemoveRecord",T.importConfig,id]]);
  await renderImportConfigAdmin();
  showImportConfigMsg(`Code ${code} supprimé.`);
}
async function saveImportConfigRow(id){
  const code=importCode(document.querySelector(`[data-ic-code="${id}"]`)?.value),motif=Number(document.querySelector(`[data-ic-motif="${id}"]`)?.value||0);if(!code||!motif)throw new Error("Code import et motif RH obligatoires.");
  const colorRaw=norm(document.querySelector(`[data-ic-color="${id}"]`)?.value),color=colorRaw?validHexColor(colorRaw):"";if(colorRaw&&!color)throw new Error("La couleur attendue doit être au format #RRGGBB.");
  await grist.getTable(T.importConfig).update({id,fields:{Code_Import:code,Motif:motif,Type_Demande:document.querySelector(`[data-ic-type="${id}"]`)?.value||importDefaultType(),Confiance_Min:Number(document.querySelector(`[data-ic-conf="${id}"]`)?.value||70),Couleur_Attendue:color,Tolerance_Couleur:Number(document.querySelector(`[data-ic-tol="${id}"]`)?.value||80),Creer_Demande:!!document.querySelector(`[data-ic-create="${id}"]`)?.checked,Actif:!!document.querySelector(`[data-ic-active="${id}"]`)?.checked,Commentaire:norm(document.querySelector(`[data-ic-comment="${id}"]`)?.value)}});await renderImportConfigAdmin();showImportConfigMsg(`Code ${code} enregistré.`);
}
async function saveImportDefaults(){
  await ensureImportTables();await loadImportConfig();let r=importDefaultRow();
  const motif=Number($("importDefaultMotif")?.value||0),type=$("importDefaultType")?.value||"PRESENCE";
  if(!r){const id=await grist.getTable(T.importConfig).create({fields:{Code_Import:IMPORT_DEFAULT_CODE,Motif:motif||null,Type_Demande:type,Confiance_Min:70,Tolerance_Couleur:80,Creer_Demande:false,Actif:true,Commentaire:"Valeurs par défaut du module d’import"}});}
  else await grist.getTable(T.importConfig).update({id:r.id,fields:{Motif:motif||null,Type_Demande:type,Actif:true}});
  await renderImportConfigAdmin();showImportConfigMsg("Valeurs par défaut enregistrées.");
}
async function addImportConfigRow(){await ensureImportTables();await loadImportConfig();await grist.getTable(T.importConfig).create({fields:{Code_Import:"",Motif:importDefaultMotifId()||null,Type_Demande:importDefaultType(),Confiance_Min:70,Tolerance_Couleur:80,Creer_Demande:true,Actif:true}});await renderImportConfigAdmin()}
function fillImportResourceSelect(){
  const s=$("importResource");if(!s)return;const list=importAccessibleResources();s.innerHTML=list.map(r=>`<option value="${r.id}">${esc(F(r,"Nom")||F(r,"Email")||("#"+r.id))}</option>`).join("");if(S.person&&list.some(r=>r.id===S.person.id))s.value=String(S.person.id);s.disabled=list.length===1;
}
async function renderImportConges(){
  if(!importCongesAllowed())return;
  fillImportResourceSelect();await loadImportConfig();
  const year=$("importYear");if(year&&!year.value)year.value=String(new Date().getFullYear());
  const info=$("importConfigStatus");if(info)info.textContent=S.importConfigRows.length?`${importActiveMappings().length} code(s) OCR actif(s).`:`Table de paramétrage absente ou vide.`;
  renderImportDrafts();
}
function importNormalizeWord(w){return importCode(w?.text||w)}
function wordCenter(w){const b=w.bbox||{};return {x:((b.x0||0)+(b.x1||0))/2,y:((b.y0||0)+(b.y1||0))/2}}
const IMPORT_MONTHS={JANVIER:1,FEVRIER:2,FÉVRIER:2,MARS:3,AVRIL:4,MAI:5,JUIN:6,JUILLET:7,AOUT:8,AOÛT:8,SEPTEMBRE:9,OCTOBRE:10,NOVEMBRE:11,DECEMBRE:12,DÉCEMBRE:12};
function normMonthWord(v){return norm(v).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z]/g,'')}
function parseImportDayToken(v){
  const raw=norm(v).replace(/[^0-9]/g,"");
  if(!raw||raw.length>2)return null;
  const d=Number(raw);return d>=1&&d<=31?d:null;
}
function reconstructDayColumns(dayRow){
  const exact={};
  for(const w of dayRow){const d=parseImportDayToken(w.text);if(d&&!exact[d])exact[d]=wordCenter(w).x}
  const pts=Object.entries(exact).map(([d,x])=>({d:Number(d),x:Number(x)})).sort((a,b)=>a.d-b.d);
  if(pts.length<3)return exact;
  const n=pts.length,sd=pts.reduce((s,p)=>s+p.d,0),sx=pts.reduce((s,p)=>s+p.x,0),sdd=pts.reduce((s,p)=>s+p.d*p.d,0),sdx=pts.reduce((s,p)=>s+p.d*p.x,0),den=n*sdd-sd*sd;
  if(!den)return exact;
  const slope=(n*sdx-sd*sx)/den,intercept=(sx-slope*sd)/n;
  if(!(slope>2))return exact;
  const residual=Math.sqrt(pts.reduce((s,p)=>s+(p.x-(intercept+slope*p.d))**2,0)/n);
  if(residual>Math.max(8,slope*.65))return exact;
  const out={};for(let d=1;d<=31;d++)out[d]=exact[d]??(intercept+slope*d);
  return out;
}
function pixelRowVariance(ctx,x,ys){
  if(!ctx||!ys?.length)return 0;const vals=[];
  for(const y0 of ys){const x0=Math.max(0,Math.min(ctx.canvas.width-1,Math.round(x))),y=Math.max(0,Math.min(ctx.canvas.height-1,Math.round(y0))),d=ctx.getImageData(x0,Math.max(0,y-2),1,Math.min(5,ctx.canvas.height-Math.max(0,y-2))).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++}if(n)vals.push([r/n,g/n,b/n]);}
  if(vals.length<3)return 0;const mean=[0,1,2].map(c=>vals.reduce((s,v)=>s+v[c],0)/vals.length);return vals.reduce((s,v)=>s+((v[0]-mean[0])**2+(v[1]-mean[1])**2+(v[2]-mean[2])**2)/3,0)/vals.length;
}
function geometricDayColumns(ctx,monthWords,monthY){
  if(!ctx)return {};const width=ctx.canvas.width,ys=Object.values(monthY).filter(Number.isFinite);if(ys.length<6||width<320)return {};
  const monthBoxes=monthWords.map(w=>w.bbox||{}),maxMonthX1=Math.max(0,...monthBoxes.map(b=>Number(b.x1)||0));
  const centers=monthWords.map(w=>wordCenter(w).x).filter(Number.isFinite).sort((a,b)=>a-b),medianCenter=centers.length?centers[Math.floor(centers.length/2)]:width*.05;
  const minX=Math.max(Math.round(maxMonthX1+4),Math.round(width*.055)),maxX=Math.min(Math.round(width*.25),Math.round(width-31*6));let xStart=null;
  for(let x=minX;x<=maxX;x++){let ok=true;for(let k=0;k<4;k++){if(pixelRowVariance(ctx,x+k,ys)<180){ok=false;break}}if(ok){xStart=x;break}}
  if(xStart===null)xStart=Math.max(maxMonthX1+8,Math.min(width*.2,medianCenter*2.06));
  let xEnd=width;for(let x=width-1;x>Math.max(width*.72,xStart+31*6);x--){if(pixelRowVariance(ctx,x,ys)>120){xEnd=Math.min(width,x+1);break}}
  const usable=xEnd-xStart;if(!(usable>31*6))return {};const step=usable/31,out={};for(let d=1;d<=31;d++)out[d]=xStart+(d-.5)*step;return out;
}
function clusterYValues(values,tol){
  const ys=values.filter(Number.isFinite).sort((a,b)=>a-b),clusters=[];
  for(const y of ys){const c=clusters.at(-1);if(c&&Math.abs(y-c.mean)<=tol){c.values.push(y);c.mean=c.values.reduce((a,b)=>a+b,0)/c.values.length}else clusters.push({values:[y],mean:y})}
  return clusters.map(c=>c.mean);
}
function geometricMonthRowsFromTokens(words,ctx){
  const h=ctx?.canvas?.height||0;if(!h)return {};
  const activeCodes=new Set(importActiveMappings().map(r=>importCode(F(r,"Code_Import"))).filter(Boolean));
  const codeYs=words.filter(w=>activeCodes.has(importNormalizeWord(w))).map(w=>wordCenter(w).y);
  const genericYs=words.filter(w=>{const t=importNormalizeWord(w);const y=wordCenter(w).y;return y>h*.12&&y<h*.82&&t&&t.length<=3&&/[A-Z]/.test(t)}).map(w=>wordCenter(w).y);
  const raw=codeYs.length>=8?codeYs:genericYs;
  const clusters=clusterYValues(raw,Math.max(5,h/120));if(clusters.length<5)return {};
  let best=null;const minStep=Math.max(16,h/55),maxStep=Math.min(60,h/16);
  for(let step=minStep;step<=maxStep;step+=.5){
    for(const y of clusters){for(let k=0;k<12;k++){const y0=y-k*step;if(y0<h*.12||y0+11*step>h*.86)continue;let matches=0,error=0;for(const cy of clusters){const idx=Math.round((cy-y0)/step);if(idx<0||idx>11)continue;const d=Math.abs(cy-(y0+idx*step));if(d<=step*.34){matches++;error+=d}}const score=matches*100-error;if(!best||score>best.score)best={y0,step,matches,score}}}
  }
  if(!best||best.matches<5)return {};const out={};for(let m=1;m<=12;m++)out[m]=best.y0+(m-1)*best.step;return out;
}
function detectGridFromWords(words,ctx){
  const numeric=words.filter(w=>parseImportDayToken(w.text)!==null);
  const bins=new Map();for(const w of numeric){const y=wordCenter(w).y,k=Math.round(y/20)*20;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(w)}
  const scored=[...bins.values()].map(row=>{const vals=[...new Set(row.map(w=>parseImportDayToken(w.text)).filter(Boolean))];return {row,score:vals.length,span:vals.length?(Math.max(...vals)-Math.min(...vals)):0}}).sort((a,b)=>(b.score*10+b.span)-(a.score*10+a.span));
  const dayRow=scored[0]?.row||[];
  const exactDays=[...new Set(dayRow.map(w=>parseImportDayToken(w.text)).filter(Boolean))];
  const monthPoints=[];for(const w of words){const key=normMonthWord(w.text),m=IMPORT_MONTHS[key];if(m)monthPoints.push({m,y:wordCenter(w).y,w})}
  const uniq=new Map();for(const p of monthPoints)if(!uniq.has(p.m))uniq.set(p.m,p.y);
  const pts=[...uniq.entries()].map(([m,y])=>({m,y})).sort((a,b)=>a.m-b.m);
  let monthY={},monthDetectionMode="OCR";
  if(pts.length>=6){
    const n=pts.length,sm=pts.reduce((s,p)=>s+p.m,0),sy=pts.reduce((s,p)=>s+p.y,0),smm=pts.reduce((s,p)=>s+p.m*p.m,0),smy=pts.reduce((s,p)=>s+p.m*p.y,0),den=n*smm-sm*sm;
    const slope=den?(n*smy-sm*sy)/den:0,intercept=(sy-slope*sm)/n;for(let m=1;m<=12;m++)monthY[m]=uniq.get(m)??(intercept+slope*m);
  }else{monthY=geometricMonthRowsFromTokens(words,ctx);monthDetectionMode="GEOMETRIE";}
  if(Object.keys(monthY).length<12)throw new Error("Impossible de reconstruire les 12 lignes mensuelles à partir de l’image.");
  let dayX=reconstructDayColumns(dayRow),mode="OCR";
  if(exactDays.length<3||Object.keys(dayX).length<10){dayX=geometricDayColumns(ctx,monthPoints.map(p=>p.w),monthY);mode="GEOMETRIE";}
  if(Object.keys(dayX).length<31)throw new Error("Impossible de reconstruire les 31 colonnes de jours à partir de l’image.");
  return {dayX,monthY,detectedDays:exactDays.length,dayDetectionMode:mode,monthDetectionMode};
}
function nearestKey(map,value){let best=null,dist=Infinity;for(const [k,v] of Object.entries(map)){const d=Math.abs(v-value);if(d<dist){dist=d;best=Number(k)}}return {key:best,dist}}
function isoFromYMD(y,m,d){const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return "";return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function groupImportDetections(items){
  const sorted=items.slice().sort((a,b)=>a.date.localeCompare(b.date));const groups=[];
  for(const it of sorted){const last=groups.at(-1);if(last&&last.code===it.code&&last.motifId===it.motifId){const a=new Date(last.end+'T00:00:00Z'),b=new Date(it.date+'T00:00:00Z'),gap=Math.round((b-a)/86400000);let merge=gap===1;if(!merge&&gap<=4){merge=true;for(let i=1;i<gap;i++){const x=new Date(a.getTime()+i*86400000).toISOString().slice(0,10);if(isCountablePresenceDay(x)){merge=false;break}}}if(merge){last.end=it.date;last.conf.push(it.conf);continue}}
    groups.push({code:it.code,motifId:it.motifId,type:it.type,start:it.date,end:it.date,conf:[it.conf],minConf:it.minConf,createRequest:it.createRequest!==false,colorExpected:it.colorExpected||""});
  }
  return groups.map(g=>{const confidence=Math.round(g.conf.reduce((a,b)=>a+b,0)/g.conf.length);return {...g,confidence,selected:g.createRequest&&confidence>=g.minConf}});
}
async function importImageCanvas(file){
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("Image illisible."));i.src=URL.createObjectURL(file)});
  const c=document.createElement("canvas");c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(img,0,0,c.width,c.height);return {canvas:c,ctx};
}
function representativeWordColor(ctx,w){
  if(!ctx||!w?.bbox)return null;const b=w.bbox,x0=Math.max(0,Math.floor(b.x0-3)),y0=Math.max(0,Math.floor(b.y0-3)),x1=Math.min(ctx.canvas.width,Math.ceil(b.x1+3)),y1=Math.min(ctx.canvas.height,Math.ceil(b.y1+3));if(x1<=x0||y1<=y0)return null;
  const data=ctx.getImageData(x0,y0,x1-x0,y1-y0).data,px=[];for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],bb=data[i+2],max=Math.max(r,g,bb),min=Math.min(r,g,bb);if(max-min>24&&max>70)px.push({r,g,b:bb});}
  if(!px.length)return null;px.sort((a,b)=>(a.r+a.g+a.b)-(b.r+b.g+b.b));return px[Math.floor(px.length/2)];
}
function importPixelColorful(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx-mn>24&&mx>85&&mn<248}
function detectPlanningGridByPixels(ctx){
  const w=ctx?.canvas?.width||0,h=ctx?.canvas?.height||0;if(w<500||h<350)return null;
  const img=ctx.getImageData(0,0,w,h).data,rowCounts=new Array(h).fill(0),x0scan=Math.floor(w*.06),yMin=Math.floor(h*.15),yMax=Math.floor(h*.74);
  for(let y=yMin;y<yMax;y++){let n=0,off=(y*w+x0scan)*4;for(let x=x0scan;x<w;x++,off+=4)if(importPixelColorful(img[off],img[off+1],img[off+2]))n++;rowCounts[y]=n}
  const threshold=Math.max(70,Math.floor(w*.065)),segments=[];let sy=null;
  for(let y=yMin;y<yMax;y++){if(rowCounts[y]>=threshold){if(sy===null)sy=y}else if(sy!==null){if(y-sy>=Math.max(40,h*.08))segments.push({y0:sy,y1:y});sy=null}}
  if(sy!==null)segments.push({y0:sy,y1:yMax});
  let seg=segments.filter(a=>a.y1-a.y0>=h*.24&&a.y1-a.y0<=h*.58).sort((a,b)=>(b.y1-b.y0)-(a.y1-a.y0))[0]||null;
  let y0=seg?.y0??Math.round(h*.232),y1=seg?.y1??Math.round(h*.671);
  if(y1-y0<h*.20){y0=Math.round(h*.232);y1=Math.round(h*.671)}
  const colCounts=new Array(w).fill(0);for(let y=y0;y<y1;y++){let off=(y*w)*4;for(let x=0;x<w;x++,off+=4)if(importPixelColorful(img[off],img[off+1],img[off+2]))colCounts[x]++}
  const cth=Math.max(8,Math.floor((y1-y0)*.025));let x0=-1,x1=-1;for(let x=Math.floor(w*.05);x<w;x++)if(colCounts[x]>=cth){x0=x;break}for(let x=w-1;x>=0;x--)if(colCounts[x]>=cth){x1=x+1;break}
  if(x0<0||x1<=x0||x1-x0<w*.55){x0=Math.round(w*.097);x1=w}
  const stepX=(x1-x0)/31,stepY=(y1-y0)/12;if(stepX<10||stepY<10)return null;
  const dayX={},monthY={};for(let d=1;d<=31;d++)dayX[d]=x0+(d-.5)*stepX;for(let m=1;m<=12;m++)monthY[m]=y0+(m-.5)*stepY;
  return {x0,x1,y0,y1,stepX,stepY,dayX,monthY,dayDetectionMode:"CELLULES",monthDetectionMode:"CELLULES"};
}
function importCellBounds(grid,m,d){const x0=grid.x0+(d-1)*grid.stepX,y0=grid.y0+(m-1)*grid.stepY;return {x0,y0,x1:x0+grid.stepX,y1:y0+grid.stepY}}
function importCellColor(ctx,grid,m,d){const b=importCellBounds(grid,m,d),x0=Math.max(0,Math.floor(b.x0+2)),y0=Math.max(0,Math.floor(b.y0+2)),x1=Math.min(ctx.canvas.width,Math.ceil(b.x1-2)),y1=Math.min(ctx.canvas.height,Math.ceil(b.y1-2));if(x1<=x0||y1<=y0)return null;const a=ctx.getImageData(x0,y0,x1-x0,y1-y0).data,px=[];for(let i=0;i<a.length;i+=4){const r=a[i],g=a[i+1],bb=a[i+2];if(importPixelColorful(r,g,bb))px.push({r,g,b:bb})}if(!px.length)return null;px.sort((u,v)=>(u.r+u.g+u.b)-(v.r+v.g+v.b));return px[Math.floor(px.length/2)]}
function buildImportGridCanvas(ctx,grid,variant="MASK"){
  const slotW=112,slotH=76,padX=12,padY=10,c=document.createElement("canvas");c.width=31*slotW;c.height=12*slotH;const o=c.getContext("2d",{willReadFrequently:true});o.fillStyle="#fff";o.fillRect(0,0,c.width,c.height);o.imageSmoothingEnabled=false;
  const tmp=document.createElement("canvas"),t=tmp.getContext("2d",{willReadFrequently:true});
  for(let m=1;m<=12;m++)for(let d=1;d<=31;d++){
    const b=importCellBounds(grid,m,d),sx=Math.max(0,Math.floor(b.x0+1)),sy=Math.max(0,Math.floor(b.y0+1)),sw=Math.max(2,Math.floor(b.x1-b.x0-2)),sh=Math.max(2,Math.floor(b.y1-b.y0-2));
    tmp.width=sw;tmp.height=sh;t.clearRect(0,0,sw,sh);t.drawImage(ctx.canvas,sx,sy,sw,sh,0,0,sw,sh);
    if(variant==="MASK"){
      const id=t.getImageData(0,0,sw,sh),a=id.data;for(let i=0;i<a.length;i+=4){const r=a[i],g=a[i+1],bb=a[i+2],mx=Math.max(r,g,bb),mn=Math.min(r,g,bb),lum=.299*r+.587*g+.114*bb,ch=mx-mn;const ink=lum<185&&ch<58;a[i]=a[i+1]=a[i+2]=ink?0:255;a[i+3]=255}t.putImageData(id,0,0);
    }else if(variant==="GRAY"){
      const id=t.getImageData(0,0,sw,sh),a=id.data;for(let i=0;i<a.length;i+=4){const v=Math.round(.299*a[i]+.587*a[i+1]+.114*a[i+2]);a[i]=a[i+1]=a[i+2]=v;a[i+3]=255}t.putImageData(id,0,0);
    }
    o.drawImage(tmp,0,0,sw,sh,(d-1)*slotW+padX,(m-1)*slotH+padY,slotW-2*padX,slotH-2*padY);
  }
  return {canvas:c,slotW,slotH};
}
function importEditDistance(a,b){const dp=Array.from({length:a.length+1},()=>new Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)dp[i][0]=i;for(let j=0;j<=b.length;j++)dp[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return dp[a.length][b.length]}
function importTokenVariants(token){const out=new Set([token]),alts={"0":["O"],"1":["I","L"],"5":["S"],"7":["T"]};for(let i=0;i<token.length;i++)for(const r of (alts[token[i]]||[]))out.add(token.slice(0,i)+r+token.slice(i+1));return [...out]}
function matchConfiguredImportCode(token,codes){const t=importCode(token);if(!t)return null;for(const v of importTokenVariants(t))if(codes.has(v))return {code:v,corrected:v!==t};const near=[...codes].filter(c=>c.length===t.length&&importEditDistance(t,c)===1);return near.length===1?{code:near[0],corrected:true}:null}
async function recognizeImportGridCanvas(gridCanvas,maps,label,progressBase,progressSpan){
  const codes=new Set(maps.map(r=>importCode(F(r,"Code_Import"))).filter(Boolean));const out=[];
  const res=await Tesseract.recognize(gridCanvas.canvas,'fra',{tessedit_pageseg_mode:'11',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',logger:m=>{if(m.status==='recognizing text')showImportMsg(`${label} : ${Math.round(progressBase+(m.progress||0)*progressSpan)} %`)}});
  for(const w of (res?.data?.words||[])){const raw=importCode(w.text),match=matchConfiguredImportCode(raw,codes);if(!match)continue;const c=wordCenter(w),d=Math.floor(c.x/gridCanvas.slotW)+1,m=Math.floor(c.y/gridCanvas.slotH)+1;if(d<1||d>31||m<1||m>12)continue;let conf=Number(w.confidence||0);if(match.corrected)conf=Math.max(0,conf-10);out.push({m,d,code:match.code,conf,raw})}
  return out;
}
async function analyzeImportImage(){
  const file=$("importImage")?.files?.[0];if(!file)throw new Error("Sélectionnez une image à analyser.");if(!window.Tesseract)throw new Error("Le moteur OCR n’a pas pu être chargé. Vérifiez l’accès au CDN Tesseract.js.");
  if(await importTableExists(T.importConfig))await ensureImportTables();await loadImportConfig();const maps=importActiveMappings();if(!maps.length)throw new Error("Aucun code actif dans PARAM_IMPORT_CONGES.");
  const resourceId=Number($("importResource").value||0),year=Number($("importYear").value||0);if(!resourceId||!year)throw new Error("Ressource et année obligatoires.");
  S.importFileName=file.name;S.importDrafts=[];showImportMsg("Détection géométrique de la grille…");
  const {ctx}=await importImageCanvas(file),grid=detectPlanningGridByPixels(ctx);if(!grid)throw new Error("La zone planning 12 × 31 n’a pas pu être détectée dans cette image.");
  showImportMsg("Préparation des 372 cellules…");const maskGrid=buildImportGridCanvas(ctx,grid,"MASK"),grayGrid=buildImportGridCanvas(ctx,grid,"GRAY");
  const first=await recognizeImportGridCanvas(maskGrid,maps,"OCR cellules",0,55);let second=[];if(first.length<8)second=await recognizeImportGridCanvas(grayGrid,maps,"OCR secours",55,45);else showImportMsg("OCR cellules : 100 %");
  const byCode=new Map(maps.map(r=>[importCode(F(r,"Code_Import")),r])),detections=[],candidates=[...first,...second];
  for(const q of candidates){const map=byCode.get(q.code);if(!map)continue;const date=isoFromYMD(year,q.m,q.d);if(!date)continue;const expected=validHexColor(F(map,"Couleur_Attendue")),sample=expected?importCellColor(ctx,grid,q.m,q.d):null,tol=Math.max(0,Number(F(map,"Tolerance_Couleur")??80));if(expected&&sample&&rgbDistance(hexRgb(expected),sample)>tol)continue;detections.push({date,code:q.code,motifId:rid(F(map,"Motif"))||importDefaultMotifId(),type:norm(F(map,"Type_Demande"))||importDefaultType(),conf:q.conf,minConf:Number(F(map,"Confiance_Min")||70),createRequest:F(map,"Creer_Demande")!==false,colorExpected:expected});}
  const unique=new Map();for(const d of detections){const k=`${d.date}|${d.code}`;if(!unique.has(k)||unique.get(k).conf<d.conf)unique.set(k,d)}
  S.importDetectedCount=unique.size;S.importDrafts=groupImportDetections([...unique.values()]);renderImportDrafts();showImportMsg(`${unique.size} cellule(s) reconnue(s) · ${S.importDrafts.length} période(s) préparée(s) · moteur : grille 12×31 + OCR cellule par cellule.`);
}

function renderImportDrafts(){
  const body=$("importDraftRows"),btn=$("importCreateRequestsBtn");if(!body)return;const list=S.importDrafts||[];
  body.innerHTML=list.length?list.map((d,i)=>`<tr class="${d.createRequest?(d.selected?'':'import-low-confidence'):'import-no-request'}"><td><input type="checkbox" data-import-select="${i}" ${d.selected?'checked':''} ${d.createRequest?'':'disabled'}></td><td><strong>${esc(d.code)}</strong></td><td>${esc(motifName(d.motifId))}</td><td>${dt(ep(d.start))}</td><td>${dt(ep(d.end))}</td><td><span class="import-confidence ${d.confidence>=d.minConf?'ok':'warn'}">${d.confidence}%</span></td><td><span class="state ${d.createRequest?'ok':'off'}">${d.createRequest?'Demande':'Reconnu uniquement'}</span></td></tr>`).join(''):'<tr><td colspan="7">Aucun brouillon. Chargez une image puis lancez l’analyse.</td></tr>';
  document.querySelectorAll('[data-import-select]').forEach(c=>c.onchange=()=>{S.importDrafts[Number(c.dataset.importSelect)].selected=c.checked;updateImportCreateButton()});updateImportCreateButton();
}
function updateImportCreateButton(){const b=$("importCreateRequestsBtn");if(b)b.disabled=!(S.importDrafts||[]).some(x=>x.selected)}
function setAllImportDraftSelection(selected){
  (S.importDrafts||[]).forEach(d=>{if(d.createRequest)d.selected=!!selected});
  renderImportDrafts();
}
async function createImportedRequests(){
  const all=(S.importDrafts||[]),selected=all.filter(x=>x.createRequest&&x.selected);if(!all.length)throw new Error("Aucune période détectée.");const resourceId=Number($("importResource").value||0),resource=(S.resources||[]).find(r=>r.id===resourceId);if(!resource)throw new Error("Ressource introuvable.");
  await ensureImportTables();const now=Math.floor(Date.now()/1000),who=email(S.user?.email)||email(F(S.person||{},"Email"))||"";const runCreated=await grist.getTable(T.importRuns).create({fields:{Ressource:resourceId,Annee:Number($("importYear").value),Fichier_Nom:S.importFileName||"",Date_Import:now,Importe_Par:who,Statut:"EN_COURS",Nb_Codes_Detectes:Number(S.importDetectedCount||0),Nb_Demandes_Creees:0,Nb_Erreurs:0,Message:"Validation de l’import"}});const runId=Number(runCreated?.id||runCreated);let createdCount=0,errors=0;
  for(const d of all){if(!d.createRequest){await grist.getTable(T.importLines).create({fields:{Import:runId,Code_Import:d.code,Motif:d.motifId,Date_Debut:ep(d.start),Date_Fin:ep(d.end),Confiance:d.confidence,Statut:"RECONNU_SANS_DEMANDE",Message:"Code reconnu · aucune demande configurée"}});continue;}if(!d.selected){await grist.getTable(T.importLines).create({fields:{Import:runId,Code_Import:d.code,Motif:d.motifId,Date_Debut:ep(d.start),Date_Fin:ep(d.end),Confiance:d.confidence,Statut:"NON_SELECTIONNE",Message:"Période non sélectionnée pour création"}});continue;}try{const u=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,fields={Reference:`IMP-${new Date().getFullYear()}-${u.slice(0,8).toUpperCase()}`,Demandeur:resourceId,Type:d.type||"CONGE",Type_Action:"DEMANDE",Date_Debut:ep(d.start),Date_Fin:ep(d.end),Motif:d.motifId,Motif_Code:motifCode(d.motifId),Commentaire_Demandeur:`Import OCR ${S.importFileName||''} · code ${d.code}`,Statut:"EN_ATTENTE",Date_Demande:now,Date_Modification:now,UUID_Demande:u,Version_Sync:1,AutoValidation:autoValidationForResource(resource)};const cr=await grist.getTable(T.requests).create({fields}),requestId=Number(cr?.id||cr);await grist.getTable(T.importLines).create({fields:{Import:runId,Code_Import:d.code,Motif:d.motifId,Date_Debut:ep(d.start),Date_Fin:ep(d.end),Confiance:d.confidence,Statut:"CREEE",Demande_Creee:requestId,Message:"Demande EN_ATTENTE créée"}});createdCount++;}catch(e){errors++;await grist.getTable(T.importLines).create({fields:{Import:runId,Code_Import:d.code,Motif:d.motifId,Date_Debut:ep(d.start),Date_Fin:ep(d.end),Confiance:d.confidence,Statut:"ERREUR",Message:e?.message||String(e)}})}}
  await grist.getTable(T.importRuns).update({id:runId,fields:{Statut:errors?"TERMINE_AVEC_ERREURS":"TERMINE",Nb_Demandes_Creees:createdCount,Nb_Erreurs:errors,Message:`${createdCount} demande(s) créée(s), ${errors} erreur(s).`}});S.importDrafts=[];renderImportDrafts();showImportMsg(`${createdCount} demande(s) créée(s) dans Demandes_RH. Elles seront prises en charge par la synchronisation.`,errors?"warn":"success");await load();
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
function easterSundayIso(year){
  // Algorithme de Meeus/Jones/Butcher (calendrier grégorien).
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
const FRENCH_HOLIDAY_CACHE=new Map();
function frenchPublicHolidays(year){
  const y=Number(year);if(!Number.isFinite(y))return new Set();
  if(FRENCH_HOLIDAY_CACHE.has(y))return FRENCH_HOLIDAY_CACHE.get(y);
  const easter=easterSundayIso(y);
  const set=new Set([
    `${y}-01-01`, addDaysIso(easter,1), `${y}-05-01`, `${y}-05-08`,
    addDaysIso(easter,39), addDaysIso(easter,50), `${y}-07-14`, `${y}-08-15`,
    `${y}-11-01`, `${y}-11-11`, `${y}-12-25`
  ]);
  FRENCH_HOLIDAY_CACHE.set(y,set);return set;
}
function isWeekendIso(iso){
  const d=new Date(`${iso}T12:00:00`);return Number.isNaN(d.getTime())?false:[0,6].includes(d.getDay());
}
function isFrenchPublicHolidayIso(iso){
  if(!iso||iso.length<4)return false;return frenchPublicHolidays(Number(iso.slice(0,4))).has(iso);
}
function isCountablePresenceDay(iso){return !!iso&&!isWeekendIso(iso)&&!isFrenchPublicHolidayIso(iso);}
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
function planningOriginalMotifLabel(row){
  if(!row)return "";
  const direct=norm(F(row,"Libelle","Motif_Libelle","Motif"));if(direct)return direct;
  const code=norm(F(row,"Motif_Code")).toUpperCase();if(!code)return "";
  const motif=(S.motifs||[]).find(m=>norm(F(m,"Code")).toUpperCase()===code);
  return motif?norm(F(motif,"Libelle","Nom","Code")):code;
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
function currentProfile(){return norm(F(S.person||{},"Profil","profil")).toUpperCase()}
function planningRequestSelectionAllowed(){return !!S.person&&!S.viewAs&&requestMenusAllowed();}
function planningDateInRequestSelection(iso){
  const a=S.planningRequestStart,b=S.planningRequestEnd;if(!a||!b)return false;
  const lo=a<=b?a:b,hi=a<=b?b:a;return iso>=lo&&iso<=hi;
}
function clearPlanningRequestSelection(){S.planningRequestStart="";S.planningRequestEnd="";renderPlanning();}
function updatePlanningRequestBar(){
  const bar=$("planningRequestBar"),label=$("planningRequestLabel");if(!bar)return;
  const a=S.planningRequestStart,b=S.planningRequestEnd;
  const visible=planningRequestSelectionAllowed()&&!!a&&!!b;
  bar.classList.toggle("hidden",!visible);
  if(label&&visible)label.textContent=a===b?`Demande pour le ${frenchDateShort(a)}`:`Demande du ${frenchDateShort(a<=b?a:b)} au ${frenchDateShort(a<=b?b:a)}`;
}
function selectPlanningRequestDate(iso,extend=false,code=""){
  if(!planningRequestSelectionAllowed())return;
  const today=localIsoToday();
  if(!iso||iso<today||!isCountablePresenceDay(iso))return;
  if(code==="A"||code==="AP")return;
  if(extend&&S.planningRequestStart){S.planningRequestEnd=iso;}else{S.planningRequestStart=iso;S.planningRequestEnd=iso;}
  renderPlanning();
}
function openRequestFromPlanning(){
  if(!planningRequestSelectionAllowed())return;
  let a=S.planningRequestStart,b=S.planningRequestEnd;if(!a||!b)return;
  if(a>b)[a,b]=[b,a];
  showView("new");reset();
  $("start").value=a;$("end").value=b;
  const msg=$("msg");if(msg){msg.textContent=`Période préremplie depuis le planning : ${frenchDateShort(a)}${a===b?"":` → ${frenchDateShort(b)}`}. Choisissez le motif puis envoyez la demande.`;msg.classList.remove("hidden","danger");}
}

function isPmo(){return currentProfile()==="PMO"}
function isForecastAbsenceRequest(r){
  if(!r||st(r)!=="EN_ATTENTE"||isCancellationRequest(r))return false;
  const action=norm(F(r,"Type_Action")).toUpperCase();
  if(action&&action!=="DEMANDE")return false;
  const motifId=rid(F(r,"Motif"));
  const motifType=motifId?presenceTypeForMotif(motifId):presenceTypeForMotifCode(norm(F(r,"Motif_Code")));
  return motifType==="ABSENCE";
}
function requestIsoRange(r){
  const a=planningIsoDate(F(r,"Date_Debut")),b=planningIsoDate(F(r,"Date_Fin"));
  if(!a||!b)return null;
  return a<=b?[a,b]:[b,a];
}
function eachIsoDate(a,b,fn){
  let d=a,guard=0;
  while(d<=b&&guard<800){fn(d);d=addDaysIso(d,1);guard++;}
}
function forecastMapForDates(dates){
  const wanted=new Set(dates),today=localIsoToday(),out=new Map();
  for(const r of (S.allRequests||[])){
    if(!isForecastAbsenceRequest(r))continue;
    const resourceId=rid(F(r,"Demandeur"));if(!resourceId)continue;
    const range=requestIsoRange(r);if(!range)continue;
    let [a,b]=range;if(b<today)continue;if(a<today)a=today;
    eachIsoDate(a,b,d=>{
      if(!wanted.has(d))return;
      if(!out.has(resourceId))out.set(resourceId,new Map());
      if(!out.get(resourceId).has(d))out.get(resourceId).set(d,[]);
      out.get(resourceId).get(d).push(r);
    });
  }
  return out;
}
function annualConfirmedStats(resourceIds,year){
  const ids=new Set((resourceIds||[]).map(Number).filter(Boolean));
  const byKey=new Map();
  for(const row of (S.planningRows||[])){
    const resourceId=Number(rid(F(row,"Ressource"))||0);if(!resourceId||!ids.has(resourceId))continue;
    const iso=planningIsoDate(F(row,"Date"));if(!iso||iso.slice(0,4)!==String(year)||!isCountablePresenceDay(iso))continue;
    const display=planningDisplayForRow(row);if(!["P","A"].includes(display.code))continue;
    byKey.set(`${resourceId}|${iso}`,display.code);
  }
  let worked=0,absence=0;
  for(const code of byKey.values()){if(code==="P")worked++;else if(code==="A")absence++;}
  const denominator=worked+absence;
  return {worked,absence,total:denominator,rate:denominator?worked*100/denominator:null};
}

function periodConfirmedStats(resourceIds,dates){
  const ids=new Set((resourceIds||[]).map(Number).filter(Boolean)),wanted=new Set(dates||[]),byKey=new Map();
  for(const row of (S.planningRows||[])){
    const resourceId=Number(rid(F(row,"Ressource"))||0);if(!resourceId||!ids.has(resourceId))continue;
    const iso=planningIsoDate(F(row,"Date"));if(!iso||!wanted.has(iso)||!isCountablePresenceDay(iso))continue;
    const display=planningDisplayForRow(row);if(!["P","A"].includes(display.code))continue;
    byKey.set(`${resourceId}|${iso}`,display.code);
  }
  let worked=0,absence=0;for(const code of byKey.values()){if(code==="P")worked++;else if(code==="A")absence++;}
  const total=worked+absence;return {worked,absence,total,rate:total?worked*100/total:null};
}
function periodForecastCount(resourceIds,dates){
  const ids=new Set((resourceIds||[]).map(Number).filter(Boolean)),wanted=new Set(dates||[]),unique=new Set();
  const forecast=forecastMapForDates(dates||[]);
  for(const resourceId of ids){
    const byDate=forecast.get(resourceId);if(!byDate)continue;
    for(const [iso,requests] of byDate.entries())if(wanted.has(iso)&&requests?.length&&isCountablePresenceDay(iso))unique.add(`${resourceId}|${iso}`);
  }
  return unique.size;
}


function planningAnnualAvailableYears(){
  const years=new Set([Number(localIsoToday().slice(0,4))]);
  for(const row of (S.planningRows||[])){const iso=planningIsoDate(F(row,"Date"));if(iso)years.add(Number(iso.slice(0,4)));}
  return [...years].filter(Boolean).sort((a,b)=>b-a);
}
function renderPlanningAnnualConsultation(active,teamSet,canSeeAllTeams,ownTeam){
  const sel=$("planningAnnualTeam");
  let team=norm(S.planningAnnualTeam);
  if(sel){
    if(canSeeAllTeams){
      const teams=[...teamSet].sort((a,b)=>a.localeCompare(b,"fr"));
      sel.disabled=false;sel.innerHTML='<option value="">Toutes les équipes</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
      if(team&&teams.includes(team))sel.value=team;else{team="";sel.value="";}
    }else{
      sel.disabled=true;team=ownTeam||"";sel.innerHTML=team?`<option value="${esc(team)}">${esc(team)}</option>`:'<option value="">Mon équipe</option>';sel.value=team;
    }
  }
  S.planningAnnualTeam=team;
  const years=planningAnnualAvailableYears();
  if(!S.planningAnnualYear||!years.includes(Number(S.planningAnnualYear)))S.planningAnnualYear=Number(localIsoToday().slice(0,4));
  const yearSel=$("planningAnnualYear");if(yearSel){yearSel.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join("");yearSel.value=String(S.planningAnnualYear);}
  const annualYear=Number(S.planningAnnualYear);
  const resources=(active||[]).filter(r=>{const t=norm(F(r,"Equipe_Code","Equipe","equipe"));return canSeeAllTeams?(!team||t===team):(ownTeam?t===ownTeam:Number(r.id)===Number(S.person?.id||0));}).sort((a,b)=>norm(F(a,"Nom")).localeCompare(norm(F(b,"Nom"),"fr")));
  const ids=resources.map(r=>Number(r.id)),annualStats=annualConfirmedStats(ids,annualYear);
  const annualLabel=$("planningAnnualLabel");if(annualLabel){annualLabel.textContent=`Année ${annualYear}`;annualLabel.title=`Indicateurs calculés du 1er janvier au 31 décembre ${annualYear}`;}
  const annualWorked=$("planningAnnualWorked");if(annualWorked){annualWorked.textContent=`Présence : ${annualStats.worked} jour${annualStats.worked>1?"s":""}`;annualWorked.title=`Jours classés JOUR_TRAVAILLE sur l’année ${annualYear}, hors week-ends et jours fériés`;}
  const annualAbsence=$("planningAnnualAbsence");if(annualAbsence){annualAbsence.textContent=`Absences : ${annualStats.absence} jour${annualStats.absence>1?"s":""}`;annualAbsence.title=`Jours classés ABSENCE sur l’année ${annualYear}, hors week-ends et jours fériés`;}
  const annualRate=$("planningAnnualPresenceRate");if(annualRate){annualRate.textContent=annualStats.rate===null?"Taux annuel : —":`Taux annuel : ${annualStats.rate.toLocaleString("fr-FR",{maximumFractionDigits:1})} %`;annualRate.title=`${annualStats.worked} jour(s) travaillé(s) / ${annualStats.total} jour(s) classé(s) sur toute l’année ${annualYear}`;}
  renderPlanningAnnualByResource(resources,annualYear);
}

function renderPlanningAnnualByResource(resources,year){
  S.planningAnnualByResourceData={resources:[...(resources||[])],year};
}
function openPlanningAnnualByResource(){
  const data=S.planningAnnualByResourceData||{resources:[],year:new Date().getFullYear()};
  const resources=data.resources||[],year=data.year;
  const body=$("planningAnnualByResourceBody");
  const title=$("planningAnnualByResourceTitle");
  const subtitle=$("planningAnnualByResourceSubtitle");
  if(title)title.textContent=`Détail annuel par ressources · ${year}`;
  if(subtitle)subtitle.textContent=`${resources.length} ressource${resources.length>1?"s":""} dans l’équipe sélectionnée`;
  if(body){
    const rows=resources.map(r=>{
      const id=Number(r.id),name=norm(F(r,"Nom"))||email(F(r,"Email"))||`Ressource ${id}`,team=norm(F(r,"Equipe_Code","Equipe","equipe"))||"—";
      const stats=annualConfirmedStats([id],year);
      const rate=stats.rate===null?"—":`${stats.rate.toLocaleString("fr-FR",{maximumFractionDigits:1})} %`;
      return `<tr><td><strong>${esc(name)}</strong></td><td>${esc(team)}</td><td>${esc(rate)}</td><td>${stats.absence}</td></tr>`;
    }).join("");
    body.innerHTML=rows||'<tr><td colspan="4" class="planning-annual-by-resource-empty">Aucune ressource dans le périmètre filtré.</td></tr>';
  }
  $("planningAnnualByResourceModal")?.classList.remove("hidden");
}
function closePlanningAnnualByResource(){
  $("planningAnnualByResourceModal")?.classList.add("hidden");
}


function planningRealMotifInfo(row){
  if(!row)return {code:"",label:""};
  const sourceCode=norm(F(row,"Motif_Code"));
  if(!sourceCode)return {code:"",label:planningOriginalMotifLabel(row)};
  const motif=(S.motifs||[]).find(m=>norm(F(m,"Code")).toUpperCase()===sourceCode.toUpperCase());
  return motif?{code:norm(F(motif,"Code"))||sourceCode,label:norm(F(motif,"Libelle"))||planningOriginalMotifLabel(row)||sourceCode}:{code:sourceCode,label:planningOriginalMotifLabel(row)||sourceCode};
}


function isConnectedResource(resourceId){
  const id=Number(resourceId||0),person=S.person||null;if(!id||!person)return false;
  if(Number(person.id||0)===id)return true;
  const resource=resourceById(id);if(!resource)return false;
  const personUuid=norm(F(person,"UUID_Ressource")),resourceUuid=norm(F(resource,"UUID_Ressource"));
  if(personUuid&&resourceUuid&&personUuid===resourceUuid)return true;
  const personEmail=email(F(person,"Email","email")),resourceEmail=email(F(resource,"Email","email"));
  return !!personEmail&&personEmail===resourceEmail;
}
function canShowIndividualRealMotifToggle(resourceId){
  return S.isOwner || isConnectedResource(resourceId);
}
function canSeeTeamAvailabilityRealMotif(resourceId){
  const id=Number(resourceId||0);if(!id)return false;
  if(S.isOwner)return true;
  // La liste des ressources du calendrier annuel est déjà bornée par le périmètre du manager.
  // On réutilise donc le droit de détail du planning pour ne pas perdre les couleurs/motifs existants.
  return currentProfile()==="MANAGER"&&canSeePlanningMotifDetails(id);
}
function canShowTeamAvailabilityRealMotifToggle(resources){
  if(S.isOwner)return (resources||[]).length>0;
  if(currentProfile()!=="MANAGER")return false;
  return (resources||[]).some(r=>canSeeTeamAvailabilityRealMotif(r.id));
}

function annualTeamAvailabilityData(){
  const data=S.planningAnnualByResourceData||{resources:[],year:Number(localIsoToday().slice(0,4))};
  return {resources:[...(data.resources||[])],year:Number(data.year||localIsoToday().slice(0,4))};
}
function annualYearDates(year){
  const out=[];let d=`${year}-01-01`,end=`${year}-12-31`,guard=0;
  while(d<=end&&guard<370){out.push(d);d=addDaysIso(d,1);guard++;}
  return out;
}
function monthLabelFr(month){
  return new Intl.DateTimeFormat("fr-FR",{month:"long"}).format(new Date(Date.UTC(2024,month-1,1))).replace(/^./,x=>x.toUpperCase());
}
function annualTeamMonthGroups(dates){
  const groups=[];
  for(const iso of dates){
    const month=Number(iso.slice(5,7));
    const prev=groups[groups.length-1];
    if(prev&&prev.month===month)prev.count++;else groups.push({month,count:1});
  }
  return groups;
}
function annualConfirmedMapForResources(resources,year){
  const ids=new Set((resources||[]).map(r=>Number(r.id)).filter(Boolean)),out=new Map();
  for(const row of (S.planningRows||[])){
    const resourceId=Number(rid(F(row,"Ressource"))||0);if(!resourceId||!ids.has(resourceId))continue;
    const iso=planningIsoDate(F(row,"Date"));if(!iso||iso.slice(0,4)!==String(year))continue;
    if(!out.has(resourceId))out.set(resourceId,new Map());
    out.get(resourceId).set(iso,row);
  }
  return out;
}
function closePlanningAnnualTeamAvailability(){
  $("planningAnnualTeamAvailabilityModal")?.classList.add("hidden");
}
function openPlanningAnnualTeamAvailability(){
  const {resources,year}=annualTeamAvailabilityData();
  const modal=$("planningAnnualTeamAvailabilityModal");if(!modal)return;
  const title=$("planningAnnualTeamAvailabilityTitle"),subtitle=$("planningAnnualTeamAvailabilitySubtitle");
  if(title)title.textContent=`Disponibilité équipe · ${year}`;
  if(subtitle)subtitle.textContent=`${resources.length} ressource${resources.length>1?"s":""} · équipe annuelle sélectionnée`;
  const dates=annualYearDates(year),months=annualTeamMonthGroups(dates),confirmed=annualConfirmedMapForResources(resources,year),forecast=forecastMapForDates(dates),holidays=frenchPublicHolidays(year);
  const detailToggle=$("planningAnnualTeamShowRealMotifs");
  const detailToggleWrap=detailToggle?.closest?.(".annual-detail-toggle");
  const canToggleTeamDetails=canShowTeamAvailabilityRealMotifToggle(resources);
  if(detailToggle){detailToggle.checked=canToggleTeamDetails&&!!S.planningAnnualShowRealMotifs;detailToggle.disabled=!canToggleTeamDetails;}
  if(detailToggleWrap)detailToggleWrap.classList.toggle("hidden",!canToggleTeamDetails);
  const head=$("planningAnnualTeamAvailabilityHead"),body=$("planningAnnualTeamAvailabilityBody");
  if(head){
    const monthsRow=`<tr class="availability-month-row"><th class="availability-resource-head" rowspan="2">Ressource</th>${months.map(g=>`<th colspan="${g.count}">${esc(monthLabelFr(g.month))}</th>`).join("")}</tr>`;
    const daysRow=`<tr class="availability-day-row">${dates.map(iso=>{const d=new Date(`${iso}T12:00:00Z`),dow=["dim","lun","mar","mer","jeu","ven","sam"][d.getUTCDay()],day=String(d.getUTCDate()).padStart(2,"0"),weekend=d.getUTCDay()===0||d.getUTCDay()===6,holiday=holidays.has(iso);return `<th class="${weekend?"weekend":""} ${holiday?"holiday":""}" title="${esc(frenchDateShort(iso))}"><span>${dow}</span><strong>${day}</strong></th>`}).join("")}</tr>`;
    head.innerHTML=monthsRow+daysRow;
  }
  if(body){
    body.innerHTML=resources.length?resources.map(r=>{
      const id=Number(r.id),name=norm(F(r,"Nom"))||email(F(r,"Email"))||`Ressource ${id}`,canSeeDetails=canSeeTeamAvailabilityRealMotif(id),rows=confirmed.get(id)||new Map(),forecastRows=forecast.get(id)||new Map();
      const cells=dates.map(iso=>{
        const d=new Date(`${iso}T12:00:00Z`),weekend=d.getUTCDay()===0||d.getUTCDay()===6,holiday=holidays.has(iso);
        if(holiday)return `<td class="availability-off-cell holiday" title="Jour férié"><span>F</span></td>`;
        if(weekend)return `<td class="availability-off-cell weekend" title="Week-end"><span>WE</span></td>`;
        const row=rows.get(iso),display=planningDisplayForRow(row),forecastRequests=forecastRows.get(iso)||[];
        let code="",title="";
        const showReal=!!S.planningAnnualShowRealMotifs&&canSeeDetails;
        if(forecastRequests.length){code="AP";title=canSeeDetails?`Absence prévisionnelle · ${forecastRequests.map(req=>motifName(rid(F(req,"Motif")))||"Absence").join(" / ")}`:"Absence prévisionnelle";}
        else if(display.code==="A"){const real=planningRealMotifInfo(row);code=showReal&&real.code?real.code:"A";title=canSeeDetails?(real.label||real.code||"Absence"):"Absence";}
        else if(display.code==="P"){const real=planningRealMotifInfo(row);code=showReal&&real.code?real.code:"P";title=canSeeDetails?(real.label||real.code||"Jour travaillé"):"Jour travaillé";}
        if(!code)return `<td class="availability-empty" title="Aucune donnée"></td>`;
        let motifColor="";
        if(canSeeDetails&&code!=="AP"&&row)motifColor=presenceColorForMotifCode(norm(F(row,"Motif_Code")));
        const style=motifColor?` style="${presenceChipStyle(motifColor)}"`:"";
        const statusClass=code==="AP"?"status-ap":(display.code==="A"?"status-a":"status-p");
        return `<td class="availability-status ${statusClass}" title="${esc(title)}"><span${style}>${esc(code)}</span></td>`;
      }).join("");
      return `<tr><th class="availability-resource-cell" title="${esc(name)}"><strong>${esc(name)}</strong></th>${cells}</tr>`;
    }).join(""):'<tr><td class="planning-empty">Aucune ressource dans le périmètre filtré.</td></tr>';
  }
  modal.classList.remove("hidden");
}

function annualPresenceRateGlobal(){
  const active=(S.resources||[]).filter(r=>F(r,"Actif","actif")!==false);
  const canSeeAll=!!(S.isAdmin||S.isOwner||isPmo());
  const ownTeam=norm(F(S.person||{},"Equipe_Code","Equipe","equipe"));
  let visible=active;
  if(!canSeeAll){
    const managed=new Set((S.managedResources||[]).map(r=>Number(r.id)).filter(Boolean));
    visible=active.filter(r=>Number(r.id)===Number(S.person?.id||0)||managed.has(Number(r.id))||(ownTeam&&norm(F(r,"Equipe_Code","Equipe","equipe"))===ownTeam));
  }
  return annualConfirmedStats(visible.map(r=>r.id),localIsoToday().slice(0,4));
}
function annualCalendarData(resourceId,year){
  const confirmed=new Map();
  for(const row of (S.planningRows||[])){
    if(Number(rid(F(row,"Ressource"))||0)!==Number(resourceId))continue;
    const iso=planningIsoDate(F(row,"Date"));if(!iso||iso.slice(0,4)!==String(year))continue;
    const display=planningDisplayForRow(row);
    if(["P","A"].includes(display.code))confirmed.set(iso,{code:display.code,row,display});
  }
  const dates=[];let d=`${year}-01-01`,end=`${year}-12-31`,guard=0;
  while(d<=end&&guard<370){dates.push(d);d=addDaysIso(d,1);guard++;}
  const forecast=forecastMapForDates(dates).get(Number(resourceId))||new Map();
  return {confirmed,forecast,dates};
}
function annualAvailableYears(resourceId){
  const years=new Set();
  const current=Number(localIsoToday().slice(0,4));
  [current-2,current-1,current,current+1].forEach(y=>years.add(y));
  for(const row of (S.planningRows||[])){
    if(Number(rid(F(row,"Ressource"))||0)!==Number(resourceId))continue;
    const iso=planningIsoDate(F(row,"Date"));if(iso)years.add(Number(iso.slice(0,4)));
  }
  return [...years].filter(Boolean).sort((a,b)=>b-a);
}
function closeAnnualPresence(){
  const m=$("annualPresenceModal");if(m)m.classList.add("hidden");S.annualPresenceResourceId=null;
}
function openAnnualPresence(resourceId){
  const resource=resourceById(resourceId);if(!resource)return;
  S.annualPresenceResourceId=Number(resourceId);
  if(!S.annualPresenceYear)S.annualPresenceYear=Number(localIsoToday().slice(0,4));
  const select=$("annualPresenceYear");
  if(select){
    const years=annualAvailableYears(resourceId);
    if(!years.includes(Number(S.annualPresenceYear)))years.push(Number(S.annualPresenceYear));
    select.innerHTML=years.sort((a,b)=>b-a).map(y=>`<option value="${y}">${y}</option>`).join("");
    select.value=String(S.annualPresenceYear);
  }
  const m=$("annualPresenceModal");if(m)m.classList.remove("hidden");
  renderAnnualPresence();
}
function renderAnnualPresence(){
  const resourceId=Number(S.annualPresenceResourceId||0);if(!resourceId)return;
  const resource=resourceById(resourceId);if(!resource)return;
  const year=Number(S.annualPresenceYear||localIsoToday().slice(0,4));
  const name=norm(F(resource,"Nom"))||email(F(resource,"Email"))||`Ressource ${resourceId}`;
  const team=norm(F(resource,"Equipe_Code","Equipe","equipe"));
  const title=$("annualPresenceTitle");if(title)title.textContent=name;
  const sub=$("annualPresenceSubtitle");if(sub)sub.textContent=`Calendrier ${year}${team?` · ${team}`:""}`;
  const detailToggle=$("annualPresenceShowRealMotifs");
  const detailToggleWrap=detailToggle?.closest?.(".annual-detail-toggle");
  const canToggleIndividualDetails=canShowIndividualRealMotifToggle(resourceId);
  if(detailToggle){detailToggle.checked=canToggleIndividualDetails&&!!S.annualPresenceShowRealMotifs;detailToggle.disabled=!canToggleIndividualDetails;}
  if(detailToggleWrap)detailToggleWrap.classList.toggle("hidden",!canToggleIndividualDetails);
  const stats=annualConfirmedStats([resourceId],year);
  const rate=$("annualPresenceRateKpi");if(rate)rate.textContent=stats.rate===null?"Taux de présence —":`Taux de présence ${stats.rate.toLocaleString("fr-FR",{maximumFractionDigits:1})} %`;
  const abs=$("annualAbsenceKpi");if(abs)abs.textContent=`${stats.absence} jour${stats.absence>1?"s":""} d’absence`;
  const {confirmed,forecast}=annualCalendarData(resourceId,year);
  // Les droits de couleur/détail existants restent inchangés. La case est accessible au OWNER sur toute ressource et à chacun sur son propre calendrier.
  const canSeeDetails=canSeePlanningMotifDetails(resourceId);
  const monthNames=Array.from({length:12},(_,m)=>new Date(year,m,1).toLocaleDateString("fr-FR",{month:"long"}));
  const weekdays=["L","M","M","J","V","S","D"];
  const html=monthNames.map((monthName,m)=>{
    const first=new Date(year,m,1,12),last=new Date(year,m+1,0,12);
    const offset=(first.getDay()+6)%7, cells=[];
    weekdays.forEach(w=>cells.push(`<div class="annual-weekday">${w}</div>`));
    for(let i=0;i<offset;i++)cells.push('<div class="annual-day empty"></div>');
    for(let day=1;day<=last.getDate();day++){
      const iso=`${year}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const date=new Date(year,m,day,12),weekend=[0,6].includes(date.getDay()),base=confirmed.get(iso),forecastRequests=forecast.get(iso)||[];
      let code=forecastRequests.length?"AP":(base?.code||"");
      const showReal=!!S.annualPresenceShowRealMotifs&&canSeeDetails;
      if(code!=="AP"&&base?.row&&showReal){const real=planningRealMotifInfo(base.row);if(real.code)code=real.code;}
      let tip="Aucune donnée de présence";
      if(code==="AP"){
        if(canSeeDetails){
          const details=forecastRequests.map(req=>motifName(rid(F(req,"Motif")))||"Absence prévisionnelle").join(" / ");
          tip=`Absence prévisionnelle · ${details}`;
        }else tip="Absence prévisionnelle";
      }else if(base){
        if(canSeeDetails){
          const row=base.row,original=[planningOriginalMotifLabel(row),norm(F(row,"Motif_Code")),norm(F(row,"Statut")),norm(F(row,"Commentaire"))].filter(Boolean);
          tip=original.join(" · ")||"Donnée synchronisée";
        }else tip=base.display.reason;
      }
      const cls=code==="AP"?"day-ap":(base?.code?`day-${base.code.toLowerCase()}`:"");
      const today=iso===localIsoToday()?"today":"";
      let motifColor="";
      if(canSeeDetails&&code&&code!=="AP"&&base?.row)motifColor=presenceColorForMotifCode(norm(F(base.row,"Motif_Code")));
      const dayStyle=motifColor?` style="${presenceChipStyle(motifColor)}"`:"";
      cells.push(`<div class="annual-day ${weekend?"weekend":""} ${cls} ${today}" title="${esc(tip)}"${dayStyle}><span>${day}</span>${code?`<span class="annual-mark">${esc(code)}</span>`:""}</div>`);
    }
    return `<section class="annual-month"><h4>${esc(monthName)} ${year}</h4><div class="annual-month-grid">${cells.join("")}</div></section>`;
  }).join("");
  const cal=$("annualPresenceCalendar");if(cal)cal.innerHTML=html;
}
function forecastYearCount(){
  // Compteur global sur toute l'année civile en cours pour PMO / Admin / Owner.
  // Il ne dépend ni de la fenêtre de 15 jours, ni des filtres équipe/recherche du planning.
  const allowed=S.isOwner||S.isAdmin||isPmo();
  if(!allowed)return null;
  const ids=new Set((S.resources||[])
    .filter(r=>F(r,"Actif","actif")!==false)
    .map(r=>Number(r.id))
    .filter(Boolean));
  const year=localIsoToday().slice(0,4),yearStart=`${year}-01-01`,yearEnd=`${year}-12-31`;
  const unique=new Set();
  for(const r of (S.allRequests||[])){
    if(!isForecastAbsenceRequest(r))continue;
    const resourceId=rid(F(r,"Demandeur"));
    if(!resourceId||!ids.has(Number(resourceId)))continue;
    const range=requestIsoRange(r);if(!range)continue;
    let [a,b]=range;
    if(b<yearStart||a>yearEnd)continue;
    if(a<yearStart)a=yearStart;if(b>yearEnd)b=yearEnd;
    eachIsoDate(a,b,d=>{if(isCountablePresenceDay(d))unique.add(`${resourceId}|${d}`);});
  }
  return unique.size;
}
function canSeePlanningMotifDetails(resourceId){
  const id=Number(resourceId||0);
  if(!id)return false;
  if(S.isOwner||S.isAdmin)return true;
  if(id===Number(S.person?.id||0))return true;
  // Un profil MANAGER voit les motifs réels de toutes les ressources présentes dans son planning.
  // Le planning lui-même borne déjà son périmètre à son équipe / ses droits visibles.
  if(currentProfile()==="MANAGER")return true;
  if((S.managedResources||[]).some(x=>Number(x.id)===id))return true;
  return (S.managerLinks||[]).some(x=>F(x,"Actif")!==false&&Number(rid(F(x,"Ressource")))===id);
}
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
  await loadPlanningParams().catch(()=>{});
  await loadPlanningKpiRules().catch(()=>{});
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
  renderPlanningWeekSelect();
  const weeks=Number(S.planningWeeks||planningDefaultWeeks()),dayCount=Math.max(7,weeks*7);
  const start=S.planningStart||localIsoToday(),dates=Array.from({length:dayCount},(_,i)=>addDaysIso(start,i)),end=dates[dates.length-1];
  const startInput=$("planningStartDate");if(startInput&&startInput.value!==start)startInput.value=start;
  const range=$("planningRange");if(range)range.textContent=`${frenchDateShort(start)} – ${frenchDateShort(end)} ${end.slice(0,4)}`;
  const prev=$("planningPrev"),next=$("planningNext");if(prev)prev.title=`Période précédente de ${weeks} semaine${weeks>1?"s":""}`;if(next)next.title=`Période suivante de ${weeks} semaine${weeks>1?"s":""}`;
  const q=norm($("planningSearch")?.value).toLowerCase();
  const canSeeAllTeams=!!(S.isAdmin||S.isOwner),ownTeam=norm(F(S.person||{},"Equipe_Code","Equipe","equipe"));
  const active=(S.resources||[]).filter(r=>F(r,"Actif","actif")!==false);
  const teamSet=new Set(active.map(r=>norm(F(r,"Equipe_Code","Equipe","equipe"))).filter(Boolean));
  const sel=$("planningTeam");let team="";
  if(sel){
    const current=norm(sel.value);
    if(canSeeAllTeams){sel.disabled=false;sel.innerHTML='<option value="">Toutes les équipes</option>'+[...teamSet].sort((a,b)=>a.localeCompare(b,"fr")).map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");if([...teamSet].includes(current))sel.value=current;team=norm(sel.value);}
    else{sel.disabled=true;if(ownTeam){sel.innerHTML=`<option value="${esc(ownTeam)}">${esc(ownTeam)}</option>`;sel.value=ownTeam;team=ownTeam;}else{sel.innerHTML='<option value="">Mon équipe</option>';sel.value="";team="";}}
  }else if(!canSeeAllTeams)team=ownTeam;
  let teamCandidates=active.filter(r=>{const t=norm(F(r,"Equipe_Code","Equipe","equipe"));return canSeeAllTeams?(!team||t===team):(ownTeam?t===ownTeam:Number(r.id)===Number(S.person?.id||0));}).sort((a,b)=>norm(F(a,"Nom")).localeCompare(norm(F(b,"Nom"),"fr")));
  const candidateIds=new Set(teamCandidates.map(r=>Number(r.id)));
  S.planningSelectedResourceIds=(S.planningSelectedResourceIds||[]).map(Number).filter(id=>candidateIds.has(id));
  const selectedIds=new Set(S.planningSelectedResourceIds);
  const options=$("planningResourceOptions");
  if(options)options.innerHTML=teamCandidates.map(r=>{const id=Number(r.id),name=norm(F(r,"Nom"))||email(F(r,"Email"))||`Ressource ${id}`;return `<label><input type="checkbox" value="${id}" ${selectedIds.has(id)?"checked":""}><span>${esc(name)}</span></label>`}).join("")||'<div class="planning-resource-empty">Aucun collaborateur</div>';
  const resLabel=$("planningResourceSummary");if(resLabel)resLabel.textContent=selectedIds.size?`${selectedIds.size} collaborateur${selectedIds.size>1?"s":""} sélectionné${selectedIds.size>1?"s":""}`:"Tous les collaborateurs";
  let resources=teamCandidates.filter(r=>{const id=Number(r.id),t=norm(F(r,"Equipe_Code","Equipe","equipe")),name=norm(F(r,"Nom","nom")),mail=email(F(r,"Email","email"));return (!selectedIds.size||selectedIds.has(id))&&(!q||`${name} ${mail} ${t}`.toLowerCase().includes(q));});
  const byResource=new Map();
  for(const row of S.planningRows){const id=rid(F(row,"Ressource"));if(!id)continue;const iso=planningIsoDate(F(row,"Date"));if(!dates.includes(iso))continue;if(!byResource.has(id))byResource.set(id,new Map());byResource.get(id).set(iso,row);}
  const forecastByResource=forecastMapForDates(dates);
  const resourceIds=resources.map(r=>Number(r.id));
  const count=$("planningCount");if(count)count.textContent=`${resources.length} ressource${resources.length>1?"s":""} affichée${resources.length>1?"s":""}`;
  const forecastCount=$("planningForecastCount");if(forecastCount){const total=periodForecastCount(resourceIds,dates);forecastCount.classList.toggle("hidden",total===null);if(total!==null){forecastCount.textContent=`Absences prévisionnelles : ${total} jour${total>1?"s":""}`;forecastCount.title=`Sur la période affichée : ${frenchDateShort(start)} – ${frenchDateShort(end)}`;}}
  const presenceRate=$("planningPresenceRate");if(presenceRate){const stats=periodConfirmedStats(resourceIds,dates);presenceRate.textContent=stats.rate===null?"Taux de présence : —":`Taux de présence : ${stats.rate.toLocaleString("fr-FR",{maximumFractionDigits:1})} %`;presenceRate.title=`${stats.worked} jour(s) travaillé(s) / ${stats.total} jour(s) classé(s) sur la période affichée selon ${T.presenceMap}`;}
  renderPlanningAnnualConsultation(active,teamSet,canSeeAllTeams,ownTeam);
  applyPlanningKpiVisibility();
  const head=$("planningHead");if(head)head.innerHTML='<th class="sticky-col resource-col">Ressource</th><th class="sticky-col team-col">Équipe</th>'+dates.map(d=>{const h=frenchDayHeader(d);return `<th class="planning-day ${h.weekend?"weekend":""}"><span>${h.dow}</span><strong>${h.day}</strong></th>`}).join("");
  const body=$("planningBody");if(body)body.innerHTML=resources.length?resources.map(r=>{
    const id=Number(r.id),name=norm(F(r,"Nom"))||email(F(r,"Email"))||`Ressource ${id}`,teamName=norm(F(r,"Equipe_Code","Equipe"))||"—",initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase(),canSeeDetails=canSeePlanningMotifDetails(id),isConnectedUser=id===Number(S.person?.id||0);
    const cells=dates.map(d=>{const row=byResource.get(id)?.get(d),h=frenchDayHeader(d),display=planningDisplayForRow(row),forecastRequests=forecastByResource.get(id)?.get(d)||[],showWorked=$("planningShowWorked")?.checked!==false,showAbsence=$("planningShowAbsence")?.checked!==false,showForecast=$("planningShowForecast")?.checked!==false;let code="",usingForecast=false;if(forecastRequests.length&&showForecast){code="AP";usingForecast=true;}else if(display.code==="P"&&showWorked)code="P";else if(display.code==="A"&&showAbsence)code="A";let title="Aucune donnée synchronisée";if(usingForecast){if(canSeeDetails){const details=forecastRequests.map(req=>`${motifName(rid(F(req,"Motif")))}${F(req,"Reference")?` · ${F(req,"Reference")}`:""}`).join(" / ");title=`Absence prévisionnelle · ${details}`;}else title="Absence prévisionnelle";}else if(row){if(canSeeDetails){const motifCode=norm(F(row,"Motif_Code")),motifLabel=planningOriginalMotifLabel(row),original=[motifLabel,motifCode,norm(F(row,"Statut")),norm(F(row,"Commentaire"))].filter(Boolean);title=original.join(" · ")||"Donnée synchronisée";}else title=code?display.reason:"Aucune information de présence affichable";}let motifColor="";if(canSeeDetails&&code&&!usingForecast&&row)motifColor=presenceColorForMotifCode(norm(F(row,"Motif_Code")));const chipStyle=motifColor?` style="${presenceChipStyle(motifColor)}"`:"";const selectable=isConnectedUser&&planningRequestSelectionAllowed()&&d>=localIsoToday()&&isCountablePresenceDay(d)&&code!=="A"&&code!=="AP";const selected=isConnectedUser&&planningDateInRequestSelection(d);if(selectable)title=`${title} · Cliquez pour préparer une demande${S.planningRequestStart?" · Shift+clic pour étendre la période":""}`;return `<td class="planning-cell ${h.weekend?"weekend":""} ${usingForecast?"forecast-cell":""} ${selectable?"planning-request-selectable":""} ${selected?"planning-request-selected":""}" ${isConnectedUser?`data-self-date="${esc(d)}" data-self-code="${esc(code)}"`:""} title="${esc(title)}">${code?`<span class="presence-chip status-${esc(code.toLowerCase())}"${chipStyle}>${esc(code)}</span>`:'<span class="presence-empty">—</span>'}</td>`;}).join("");
    return `<tr class="${isConnectedUser?"planning-self-row":""}"${isConnectedUser?' aria-current="true"':''}><td class="sticky-col resource-col"><div class="resource-name"><span class="resource-avatar">${esc(initials||"R")}</span><strong>${esc(name)}</strong>${isConnectedUser?'<span class="planning-self-badge" title="Votre ligne">Moi</span>':''}<button type="button" class="resource-calendar-btn" data-annual-resource="${id}" title="Voir le calendrier annuel de ${esc(name)}" aria-label="Voir le calendrier annuel de ${esc(name)}">▦</button></div></td><td class="sticky-col team-col" title="${esc(teamName)}">${esc(teamName)}</td>${cells}</tr>`;
  }).join(""):`<tr><td colspan="${dates.length+2}" class="planning-empty">Aucune présence synchronisée sur cette période.</td></tr>`;
  updatePlanningRequestBar();
  const latest=(S.planningRows||[]).map(r=>Number(F(r,"Derniere_Sync")||0)).filter(Boolean).sort((a,b)=>b-a)[0],sync=$("planningSync");if(sync)sync.textContent=latest?`Synchronisé · ${new Date(latest*1000).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`:"En attente de synchronisation";
}

function shiftPlanning(days){S.planningStart=addDaysIso(S.planningStart||localIsoToday(),days);renderPlanning()}
function setPlanningStartDate(value){
  const v=norm(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return;
  S.planningStart=v;
  renderPlanning();
}
function resetPlanningToday(){S.planningStart=localIsoToday();renderPlanning()}

// V1.52 — correspondance Motifs RH -> impact feuille de présence
async function presenceMapTableExists(){
  try{await grist.docApi.fetchTable(T.presenceMap);return true}catch{return false}
}
async function ensurePresenceMapTable(){
  if(await presenceMapTableExists()){if(S.isOwner)await ensurePresenceMapColorColumn();return true;}
  if(!S.isOwner)throw new Error("Seul l’Owner peut initialiser la table de correspondance présence.");
  await grist.docApi.applyUserActions([["AddTable",T.presenceMap,[
    {id:"Motif",type:"Ref:Motifs_RH",label:"Motif RH"},
    {id:"Type_Presence",type:"Text",label:"Type de présence"},
    {id:"Actif",type:"Bool",label:"Actif"},
    {id:"Couleur",type:"Text",label:"Couleur"},
    {id:"Commentaire",type:"Text",label:"Commentaire"}
  ]]]);
  return true;
}
async function loadPresenceMappings(){
  if(!(await presenceMapTableExists())){
    S.presenceMappings=[];S.presenceMapReady=false;applyPresenceTheme();return false;
  }
  S.presenceMappings=rows(await grist.docApi.fetchTable(T.presenceMap));
  S.presenceMapReady=true;applyPresenceTheme();return true;
}
function presenceTypeLabel(v){
  return ({JOUR_TRAVAILLE:"Jour travaillé",ABSENCE:"Absence",AUCUN_IMPACT:"Aucun impact"})[norm(v).toUpperCase()]||"Non configuré";
}
function defaultPresenceColor(type){
  return ({JOUR_TRAVAILLE:"#ffe8ed",ABSENCE:"#e2f5df",AUCUN_IMPACT:"#eef3f8"})[norm(type).toUpperCase()]||"#eef3f8";
}
function validHexColor(v){
  const x=norm(v).toLowerCase();
  return /^#[0-9a-f]{6}$/.test(x)?x:"";
}
function contrastColor(hex){
  const x=validHexColor(hex);if(!x)return "#263a57";
  const r=parseInt(x.slice(1,3),16),g=parseInt(x.slice(3,5),16),b=parseInt(x.slice(5,7),16);
  return (r*299+g*587+b*114)/1000>150?"#263a57":"#ffffff";
}
function rgbaFromHex(hex,alpha){
  const x=validHexColor(hex);if(!x)return "";
  const r=parseInt(x.slice(1,3),16),g=parseInt(x.slice(3,5),16),b=parseInt(x.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function darkenHex(hex,factor=.35){
  const x=validHexColor(hex);if(!x)return "#263a57";
  const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
  const r=clamp(parseInt(x.slice(1,3),16)*(1-factor)),g=clamp(parseInt(x.slice(3,5),16)*(1-factor)),b=clamp(parseInt(x.slice(5,7),16)*(1-factor));
  return `#${[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}
function presenceColorForType(type){
  const wanted=norm(type).toUpperCase();
  const found=(S.presenceMappings||[]).find(r=>norm(F(r,"Type_Presence")).toUpperCase()===wanted&&F(r,"Actif")!==false&&validHexColor(F(r,"Couleur")));
  return validHexColor(found?F(found,"Couleur"):"")||defaultPresenceColor(wanted);
}
function applyPresenceTheme(){
  const root=document.documentElement;if(!root)return;
  const worked=presenceColorForType("JOUR_TRAVAILLE");
  const absence=presenceColorForType("ABSENCE");
  const setVars=(prefix,color)=>{
    const solid=validHexColor(color)||"#cbd5e1";
    root.style.setProperty(`--${prefix}-bg`,rgbaFromHex(solid,.14)||solid);
    root.style.setProperty(`--${prefix}-border`,rgbaFromHex(solid,.34)||solid);
    root.style.setProperty(`--${prefix}-text`,darkenHex(solid,.32));
    root.style.setProperty(`--${prefix}-solid-bg`,solid);
    root.style.setProperty(`--${prefix}-solid-border`,solid);
    root.style.setProperty(`--${prefix}-solid-text`,contrastColor(solid));
  };
  setVars("presence-worked",worked);
  setVars("presence-absence",absence);
}
function presenceMappingForMotif(motifId){
  return (S.presenceMappings||[]).find(x=>rid(F(x,"Motif"))===Number(motifId)&&F(x,"Actif")!==false)||null;
}
function presenceColorForMotif(motifId){
  const r=presenceMappingForMotif(motifId);if(!r)return "";
  return validHexColor(F(r,"Couleur"))||defaultPresenceColor(F(r,"Type_Presence"));
}
function presenceColorForMotifCode(code){
  const wanted=norm(code).toUpperCase();if(!wanted)return "";
  const motif=(S.motifs||[]).find(m=>norm(F(m,"Code")).toUpperCase()===wanted);
  return motif?presenceColorForMotif(motif.id):"";
}
function presenceChipStyle(color){
  const c=validHexColor(color);return c?`background:${c};color:${contrastColor(c)};border-color:${c}`:"";
}
async function ensurePresenceMapColorColumn(){
  try{await grist.docApi.applyUserActions([["AddColumn",T.presenceMap,"Couleur",{type:"Text",label:"Couleur"}]]);}catch(e){}
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
    const currentColor=validHexColor(r?F(r,"Couleur"):"")||defaultPresenceColor(type);
    const opts=[["","— Non configuré —"],["JOUR_TRAVAILLE","Jour travaillé"],["ABSENCE","Absence"],["AUCUN_IMPACT","Aucun impact"]]
      .map(([v,l])=>`<option value="${v}" ${type===v?"selected":""}>${l}</option>`).join("");
    return `<tr><td><span class="codechip">${esc(F(m,"Code")||"—")}</span></td><td><strong>${esc(F(m,"Libelle")||"—")}</strong></td><td><select data-presence-type="${m.id}">${opts}</select></td><td><label class="toggleline"><input type="checkbox" data-presence-active="${m.id}" ${actif?"checked":""}> Actif</label></td><td><div class="presence-color-control"><label class="presence-color-picker" title="Choisir la couleur"><span class="presence-color-preview" data-presence-color-preview="${m.id}" style="background:${esc(currentColor)}"></span><input type="color" data-presence-color="${m.id}" value="${esc(currentColor)}" aria-label="Choisir la couleur du motif ${esc(F(m,"Libelle")||F(m,"Code")||"")}"></label><input class="presence-color-hex" data-presence-color-hex="${m.id}" value="${esc(currentColor)}" maxlength="7" spellcheck="false" aria-label="Code hexadécimal de la couleur"><button type="button" class="table-action small" data-presence-color-default="${m.id}">Défaut</button></div></td><td><input data-presence-comment="${m.id}" value="${esc(comment)}" placeholder="Optionnel"></td><td><button class="table-action" data-presence-save="${m.id}">Enregistrer</button></td></tr>`;
  }).join("")||'<tr><td colspan="7">Aucun motif RH à paramétrer.</td></tr>';
  const syncPresenceColorUi=(id,color)=>{
    const c=validHexColor(color);if(!c)return false;
    const picker=document.querySelector(`[data-presence-color="${id}"]`);
    const hex=document.querySelector(`[data-presence-color-hex="${id}"]`);
    const preview=document.querySelector(`[data-presence-color-preview="${id}"]`);
    if(picker)picker.value=c;if(hex)hex.value=c;if(preview)preview.style.background=c;return true;
  };
  document.querySelectorAll("[data-presence-color]").forEach(input=>{
    input.addEventListener("input",()=>syncPresenceColorUi(Number(input.dataset.presenceColor),input.value));
  });
  document.querySelectorAll("[data-presence-color-hex]").forEach(input=>{
    input.addEventListener("input",()=>{const id=Number(input.dataset.presenceColorHex);const raw=norm(input.value).toUpperCase();input.value=raw;if(validHexColor(raw))syncPresenceColorUi(id,raw);});
    input.addEventListener("blur",()=>{const id=Number(input.dataset.presenceColorHex);if(!syncPresenceColorUi(id,input.value)){const picker=document.querySelector(`[data-presence-color="${id}"]`);syncPresenceColorUi(id,picker?.value||"#FFFFFF");}});
  });
  document.querySelectorAll("[data-presence-color-default]").forEach(b=>b.onclick=()=>{
    const id=Number(b.dataset.presenceColorDefault),type=norm(document.querySelector(`[data-presence-type="${id}"]`)?.value).toUpperCase();
    syncPresenceColorUi(id,defaultPresenceColor(type));
  });
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
  const couleur=validHexColor(document.querySelector(`[data-presence-color-hex="${motifId}"]`)?.value)||validHexColor(document.querySelector(`[data-presence-color="${motifId}"]`)?.value)||defaultPresenceColor(type);
  await ensurePresenceMapTable();await loadPresenceMappings();
  const old=S.presenceMappings.find(r=>rid(F(r,"Motif"))===Number(motifId));
  const fields={Motif:Number(motifId),Type_Presence:type,Actif:actif,Couleur:couleur,Commentaire:commentaire};
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
    const editable=st(r)==="EN_ATTENTE"&&!isCancellationRequest(r);
    const cancellable=canCancel(r);
    const cancellationRequestable=canRequestCancellation(r);
    const resource=resourceById(rid(F(r,"Demandeur")));
    const resourceCell=showResource?`<td><strong>${esc(resource?resLabel(resource):"Ressource #"+rid(F(r,"Demandeur")))}</strong></td>`:"";
    const actionButtons=[];
    if(actions&&editable)actionButtons.push(`<button class="secondary" data-e="${r.id}">Modifier</button>`);
    if(actions&&cancellable)actionButtons.push(`<button class="secondary" data-c="${r.id}">Annuler</button>`);
    if(actions&&cancellationRequestable)actionButtons.push(`<button class="secondary" data-ca="${r.id}">Demander l’annulation</button>`);
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
  document.querySelectorAll("[data-ca]").forEach(b=>b.onclick=()=>openCancellationRequest(+b.dataset.ca));
  renderAdmin();
}
function reset(){S.editing=null;$("formTitle").textContent="Nouvelle demande";$("save").textContent="Envoyer";$("type").value="CONGE";$("motif").value="";$("start").value="";$("end").value="";$("comment").value="";$("cancelEdit").classList.add("hidden")}
function edit(id){const r=S.myRequests.find(x=>x.id===id);if(!r||st(r)!=="EN_ATTENTE")return;S.editing=id;$("formTitle").textContent="Modifier ma demande";$("save").textContent="Enregistrer";$("type").value=F(r,"Type")||"CONGE";$("motif").value=rid(F(r,"Motif"));const iso=v=>new Date(Number(v)*1000).toISOString().slice(0,10);$("start").value=iso(F(r,"Date_Debut"));$("end").value=iso(F(r,"Date_Fin"));$("comment").value=F(r,"Commentaire_Demandeur")||"";$("cancelEdit").classList.remove("hidden")}
async function save(){
  const a=$("start").value,b=$("end").value,m=+$("motif").value;
  if(!a||!b||!m)return msg("Motif et période obligatoires.");
  if(b<a)return msg("La date de fin doit être ≥ à la date de début.");
  const currentResourceId=S.editing?rid(F(S.myRequests.find(x=>x.id===S.editing)||{},"Demandeur")):Number(S.person?.id||0);
  const fields={Type:$("type").value,Date_Debut:ep(a),Date_Fin:ep(b),Motif:m,Motif_Code:motifCode(m),Commentaire_Demandeur:$("comment").value.trim(),Date_Modification:Math.floor(Date.now()/1000),AutoValidation:autoValidationForResourceId(currentResourceId)};
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
function isoDateFromEpoch(v){
  if(!v)return "";
  const d=new Date(Number(v)*1000);
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function todayIso(){
  const d=new Date();
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function openCancellationRequest(id){
  const r=(S.myRequests||[]).find(x=>Number(x.id)===Number(id));
  if(!r||!canRequestCancellation(r))return;
  const originalStart=isoDateFromEpoch(F(r,"Date_Debut"));
  const originalEnd=isoDateFromEpoch(F(r,"Date_Fin"));
  const minDate=originalStart>todayIso()?originalStart:todayIso();
  $("cancelRequestOriginalId").value=String(r.id);
  $("cancelRequestInfo").textContent=`${motifName(rid(F(r,"Motif")))} · ${dt(F(r,"Date_Debut"))} → ${dt(F(r,"Date_Fin"))} · ${F(r,"Reference")||"#"+r.id}`;
  $("cancelRequestStart").min=minDate;
  $("cancelRequestStart").max=originalEnd;
  $("cancelRequestEnd").min=minDate;
  $("cancelRequestEnd").max=originalEnd;
  $("cancelRequestStart").value=minDate;
  $("cancelRequestEnd").value=originalEnd;
  $("cancelRequestComment").value="";
  $("cancelRequestMsg").textContent="";
  $("cancelRequestMsg").classList.add("hidden");
  $("cancelRequestModal").classList.remove("hidden");
}
function closeCancellationRequest(){
  $("cancelRequestModal").classList.add("hidden");
}
async function submitCancellationRequest(){
  const originalId=Number($("cancelRequestOriginalId").value||0);
  const original=(S.myRequests||[]).find(x=>Number(x.id)===originalId);
  if(!original||!canRequestCancellation(original))throw new Error("Cette demande n’est plus éligible à une demande d’annulation.");
  const a=$("cancelRequestStart").value,b=$("cancelRequestEnd").value;
  const originalStart=isoDateFromEpoch(F(original,"Date_Debut"));
  const originalEnd=isoDateFromEpoch(F(original,"Date_Fin"));
  const minDate=originalStart>todayIso()?originalStart:todayIso();
  if(!a||!b)return cancellationMsg("Période d’annulation obligatoire.");
  if(a<minDate||b>originalEnd||b<a)return cancellationMsg(`La période doit être comprise entre le ${dt(ep(minDate))} et le ${dt(ep(originalEnd))}.`);
  const u=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
  const comment=$("cancelRequestComment").value.trim();
  const originalRef=F(original,"Reference")||`#${original.id}`;
  const fields={
    Reference:`DRH-${new Date().getFullYear()}-${u.slice(0,8).toUpperCase()}`,
    Demandeur:rid(F(original,"Demandeur"))||S.person?.id,
    Type:"ANNULATION",
    Type_Action:"ANNULATION",
    Demande_Origine:original.id,
    Date_Debut:ep(a),Date_Fin:ep(b),
    Motif:rid(F(original,"Motif")),Motif_Code:F(original,"Motif_Code")||motifCode(rid(F(original,"Motif"))),
    Commentaire_Demandeur:`Demande d’annulation de ${originalRef}${comment?` — ${comment}`:""}`,
    Statut:"EN_ATTENTE",Date_Demande:Math.floor(Date.now()/1000),Date_Modification:Math.floor(Date.now()/1000),
    UUID_Demande:u,Version_Sync:1,AutoValidation:autoValidationForResourceId(rid(F(original,"Demandeur"))||S.person?.id)
  };
  const created=await grist.getTable(T.requests).create({fields});
  const newId=Number(created?.id||created)||0;
  if(newId)await syncRequestToCockpit(newId);
  closeCancellationRequest();
  await load();
}
function cancellationMsg(t){
  $("cancelRequestMsg").textContent=t;$("cancelRequestMsg").classList.remove("hidden");
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
  if($("closeCancelRequest")) $("closeCancelRequest").onclick=closeCancellationRequest;
  if($("cancelCancelRequest")) $("cancelCancelRequest").onclick=closeCancellationRequest;
  if($("submitCancelRequest")) $("submitCancelRequest").onclick=()=>submitCancellationRequest().catch(e=>cancellationMsg(e?.message||String(e)));
  $("syncResourcesBtn").onclick=adminSyncResources;
  $("applyAcl").onclick=()=>{};
  $("initLabelsBtn").onclick=()=>initLabelsTable().catch(fatal);
  $("refreshManagersBtn").onclick=()=>refreshManagersAdmin();
  $("addManagerLink").onclick=()=>addManagerLink().catch(managerAdminError);
  $("labelsSearch").oninput=e=>renderLabelsManager(e.target.value);
  $("resetAllLabels").onclick=()=>resetAllLabels().catch(fatal);
  if($("initMenuOrderBtn")) $("initMenuOrderBtn").onclick=()=>initMenuOrderTable().catch(fatal);
  if($("initPlanningParamsBtn")) $("initPlanningParamsBtn").onclick=()=>initPlanningParamsTable().catch(e=>showSyncAdminMsg("planningParamsMsg",e?.message||String(e),"danger"));
  if($("savePlanningParamsBtn")) $("savePlanningParamsBtn").onclick=()=>savePlanningParams().catch(e=>showSyncAdminMsg("planningParamsMsg",e?.message||String(e),"danger"));
  if($("planningForecastColor")) $("planningForecastColor").oninput=e=>syncPlanningForecastColorUi(e.target.value);
  if($("planningForecastColorHex")){ $("planningForecastColorHex").oninput=e=>{const raw=norm(e.target.value).toUpperCase();e.target.value=raw;if(validHexColor(raw))syncPlanningForecastColorUi(raw);}; $("planningForecastColorHex").onblur=e=>{if(!syncPlanningForecastColorUi(e.target.value))syncPlanningForecastColorUi(forecastColor());}; }
  if($("planningForecastColorDefault")) $("planningForecastColorDefault").onclick=()=>syncPlanningForecastColorUi("#FFD54F");
  if($("initPlanningKpiBtn")) $("initPlanningKpiBtn").onclick=()=>ensurePlanningKpiTable().then(loadPlanningKpiRules).catch(e=>showSyncAdminMsg("planningParamsMsg",e?.message||String(e),"danger"));
  if($("initImportTablesBtn")) $("initImportTablesBtn").onclick=()=>ensureImportTables().then(renderImportConfigAdmin).then(()=>showImportConfigMsg("Tables d’import initialisées / complétées.")).catch(e=>showImportConfigMsg(e?.message||String(e),"danger"));
  if($("addImportConfigRowBtn")) $("addImportConfigRowBtn").onclick=()=>addImportConfigRow().catch(e=>showImportConfigMsg(e?.message||String(e),"danger"));
  if($("saveImportDefaultsBtn")) $("saveImportDefaultsBtn").onclick=()=>saveImportDefaults().catch(e=>showImportConfigMsg(e?.message||String(e),"danger"));
  if($("importAnalyzeBtn")) $("importAnalyzeBtn").onclick=()=>analyzeImportImage().catch(e=>showImportMsg(e?.message||String(e),"danger"));
  if($("importCreateRequestsBtn")) $("importCreateRequestsBtn").onclick=()=>createImportedRequests().catch(e=>showImportMsg(e?.message||String(e),"danger"));
  if($("importSelectAllBtn")) $("importSelectAllBtn").onclick=()=>setAllImportDraftSelection(true);
  if($("importSelectNoneBtn")) $("importSelectNoneBtn").onclick=()=>setAllImportDraftSelection(false);
  if($("savePlanningKpiRolesBtn")) $("savePlanningKpiRolesBtn").onclick=()=>savePlanningKpiRoleRules().catch(e=>showSyncAdminMsg("planningParamsMsg",e?.message||String(e),"danger"));
  if($("addPlanningKpiOverrideBtn")) $("addPlanningKpiOverrideBtn").onclick=()=>addPlanningKpiOverride().catch(e=>showSyncAdminMsg("planningParamsMsg",e?.message||String(e),"danger"));
  if($("planningWeekChoices")) $("planningWeekChoices").addEventListener("change",()=>{const vals=[...document.querySelectorAll('#planningWeekChoices input[type="checkbox"]:checked')].map(x=>Number(x.value)).sort((a,b)=>a-b);const sel=$("planningDefaultWeeks");if(sel&&vals.length){const cur=Number(sel.value);sel.innerHTML=vals.map(n=>`<option value="${n}">${n} semaine${n>1?"s":""}</option>`).join("");sel.value=String(vals.includes(cur)?cur:vals[0]);}});
  if($("initSyncParamsBtn")) $("initSyncParamsBtn").onclick=()=>initSyncParamsTable().catch(e=>showSyncAdminMsg("syncParamsMsg",e?.message||String(e),"danger"));
  if($("refreshSyncParamsBtn")) $("refreshSyncParamsBtn").onclick=()=>loadSyncParams().catch(e=>showSyncAdminMsg("syncParamsMsg",e?.message||String(e),"danger"));
  if($("initSyncRequestsBtn")) $("initSyncRequestsBtn").onclick=()=>initSyncRequestsTable().catch(e=>showSyncAdminMsg("syncRequestsMsg",e?.message||String(e),"danger"));
  if($("refreshSyncRequestsBtn")) $("refreshSyncRequestsBtn").onclick=()=>loadSyncRequests().catch(e=>showSyncAdminMsg("syncRequestsMsg",e?.message||String(e),"danger"));
  if($("syncCurrentYearBtn")) $("syncCurrentYearBtn").onclick=()=>setSyncCurrentYear();
  if($("createSyncRequestBtn")) $("createSyncRequestBtn").onclick=()=>createSyncRequest().catch(e=>showSyncAdminMsg("syncRequestsMsg",e?.message||String(e),"danger"));
  $("save").onclick=()=>save().catch(fatal);
  $("newBtn").onclick=()=>{reset();showView("new")};
  $("cancelEdit").onclick=()=>{reset();showView("mine")};
  $("refresh").onclick=async()=>{await syncAll("manual");await load();await loadManagerContext()};
  $("syncNow").onclick=async()=>{await syncAll("manual");await load();await loadManagerContext()};
  $("viewAsSelect").onchange=e=>setViewAs(e.target.value);
  if($("initPlanningBtn")) $("initPlanningBtn").onclick=()=>initPlanningTable().catch(showPlanningError);
  if($("planningSearch")) $("planningSearch").oninput=()=>renderPlanning();
  if($("planningTeam")) $("planningTeam").onchange=()=>renderPlanning();
  if($("planningAnnualTeam")) $("planningAnnualTeam").onchange=e=>{S.planningAnnualTeam=norm(e.target.value);renderPlanning();};
  if($("planningAnnualYear")) $("planningAnnualYear").onchange=e=>{S.planningAnnualYear=Number(e.target.value)||Number(localIsoToday().slice(0,4));renderPlanning();};
  if($("planningShowWorked")) $("planningShowWorked").onchange=()=>renderPlanning();
  if($("planningShowAbsence")) $("planningShowAbsence").onchange=()=>renderPlanning();
  if($("planningShowForecast")) $("planningShowForecast").onchange=()=>renderPlanning();
  if($("planningStartDate")) $("planningStartDate").onchange=e=>setPlanningStartDate(e.target.value);
  if($("planningPrev")) $("planningPrev").onclick=()=>shiftPlanning(-Math.max(7,Number(S.planningWeeks||2)*7));
  if($("planningNext")) $("planningNext").onclick=()=>shiftPlanning(Math.max(7,Number(S.planningWeeks||2)*7));
  if($("planningWeeks")) $("planningWeeks").onchange=e=>{S.planningWeeks=Number(e.target.value)||planningDefaultWeeks();renderPlanning();};
  if($("planningResourceOptions")) $("planningResourceOptions").addEventListener("change",e=>{if(e.target.matches('input[type="checkbox"]')){S.planningSelectedResourceIds=[...$("planningResourceOptions").querySelectorAll('input[type="checkbox"]:checked')].map(x=>Number(x.value));renderPlanning();}});
  if($("planningResourcesAll")) $("planningResourcesAll").onclick=()=>{S.planningSelectedResourceIds=[];renderPlanning();};
  if($("planningToday")) $("planningToday").onclick=()=>resetPlanningToday();
  if($("planningRefresh")) $("planningRefresh").onclick=()=>loadPlanning().catch(showPlanningError);
  if($("planningAnnualByResourceBtn")) $("planningAnnualByResourceBtn").onclick=openPlanningAnnualByResource;
  if($("closePlanningAnnualByResource")) $("closePlanningAnnualByResource").onclick=closePlanningAnnualByResource;
  if($("planningAnnualByResourceModal")) $("planningAnnualByResourceModal").onclick=e=>{if(e.target===$("planningAnnualByResourceModal"))closePlanningAnnualByResource();};
  if($("planningAnnualTeamAvailabilityBtn")) $("planningAnnualTeamAvailabilityBtn").onclick=openPlanningAnnualTeamAvailability;
  if($("closePlanningAnnualTeamAvailability")) $("closePlanningAnnualTeamAvailability").onclick=closePlanningAnnualTeamAvailability;
  if($("planningAnnualTeamAvailabilityModal")) $("planningAnnualTeamAvailabilityModal").onclick=e=>{if(e.target===$("planningAnnualTeamAvailabilityModal"))closePlanningAnnualTeamAvailability();};
  if($("planningAnnualTeamShowRealMotifs")) $("planningAnnualTeamShowRealMotifs").onchange=e=>{if(e.target.disabled)return;S.planningAnnualShowRealMotifs=!!e.target.checked;openPlanningAnnualTeamAvailability();};
  if($("planningBody")) $("planningBody").addEventListener("click",e=>{
    const btn=e.target.closest?.("[data-annual-resource]");
    if(btn&&$("planningBody").contains(btn)){
      e.preventDefault();e.stopPropagation();const id=Number(btn.dataset.annualResource||0);if(id)openAnnualPresence(id);return;
    }
    const cell=e.target.closest?.("[data-self-date]");
    if(!cell||!$("planningBody").contains(cell))return;
    e.preventDefault();
    selectPlanningRequestDate(cell.dataset.selfDate,!!e.shiftKey,norm(cell.dataset.selfCode).toUpperCase());
  });
  if($("planningCreateRequest")) $("planningCreateRequest").onclick=openRequestFromPlanning;
  if($("planningClearRequest")) $("planningClearRequest").onclick=clearPlanningRequestSelection;
  if($("closeAnnualPresence")) $("closeAnnualPresence").onclick=closeAnnualPresence;
  if($("annualPresenceYear")) $("annualPresenceYear").onchange=e=>{S.annualPresenceYear=Number(e.target.value);renderAnnualPresence();};
  if($("annualPresenceShowRealMotifs")) $("annualPresenceShowRealMotifs").onchange=e=>{if(e.target.disabled)return;S.annualPresenceShowRealMotifs=!!e.target.checked;renderAnnualPresence();};
  if($("annualPresenceModal")) $("annualPresenceModal").onclick=e=>{if(e.target===$("annualPresenceModal"))closeAnnualPresence();};

  if($("allTeamFilter")) $("allTeamFilter").onchange=()=>render();
  if($("allResourceFilter")) $("allResourceFilter").onchange=()=>render();
  renderDebug();
  await syncAll("startup")
  await identify();
  await detectOwner();
  await load();await loadLabels();await loadMenuOrder();await loadPlanningParams().catch(()=>{});await loadPlanningKpiRules().catch(()=>{});await loadSyncParams();await loadSyncRequests();
  await loadManagerContext().catch(e=>console.warn("Mode manager:",e));
  showView("home");
}
boot().catch(fatal);


// V1.80 — menu latéral rétractable, compact par défaut
document.addEventListener("DOMContentLoaded", () => {
  const shell = document.querySelector(".shell");
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.getElementById("sidebarToggle");
  if (!shell || !sidebar || !toggle) return;

  const setCollapsed = (collapsed) => {
    shell.classList.toggle("sidebar-collapsed", collapsed);
    sidebar.classList.toggle("is-collapsed", collapsed);
    toggle.textContent = collapsed ? "›" : "‹";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggle.setAttribute("aria-label", collapsed ? "Développer le menu" : "Réduire le menu");
    toggle.title = collapsed ? "Développer le menu" : "Réduire le menu";
  };

  // Par défaut à chaque ouverture : mode compact.
  setCollapsed(true);
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCollapsed(!sidebar.classList.contains("is-collapsed"));
  });

  sidebar.querySelectorAll(".nav").forEach(btn => {
    const label = btn.querySelector("span")?.textContent?.trim();
    if (label && !btn.title) btn.title = label;
    btn.setAttribute("aria-label", label || btn.getAttribute("aria-label") || "Menu");
  });
});

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
    docs: ["guideUser","guideManager","guideAdmin"],
    admin: ["resources","managers","motifs","presenceMap","acl","labels","debug","menuOrder","syncParams","syncRequests","planningParams","sync"]
  };

  const applyAccordion = (open) => {
    sidebar.dataset.openSection = open;
    Object.entries(groups).forEach(([group, views]) => {
      const visible = group === open;
      views.forEach(view => {
        sidebar.querySelectorAll(`[data-view="${view}"]`).forEach(el => {
          const allowed=!el.classList.contains("hidden");
          el.style.setProperty("display", visible && allowed ? "flex" : "none", "important");
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
