/*
sync.js — V1.2
ENV: GRIST_HOST, GRIST_API_KEY, COCKPIT_DOC_ID, DEMANDES_DOC_ID

Règles:
- Cockpit.Team -> Demandes.Ressources : Cockpit maître.
- Motifs_RH : LOCAL dans chaque document, JAMAIS synchronisés.
- Demandes créées/modifiées : Demandes -> Cockpit.
- Décision manager : Cockpit -> Demandes.
- Jointure demande : UUID_Demande.
- Jointure motif : Motifs_RH.Code.
- Upsert uniquement, aucune suppression globale.
*/
const C={host:(process.env.GRIST_HOST||"").replace(/\/$/,""),key:process.env.GRIST_API_KEY,cockpit:process.env.COCKPIT_DOC_ID,demandes:process.env.DEMANDES_DOC_ID};
if(Object.values(C).some(v=>!v))throw new Error("Configuration sync incomplète");
const enc=encodeURIComponent, norm=x=>String(x??"").trim(), f=(r,k)=>r.fields?.[k];
const rid=v=>Number(Array.isArray(v)?v[1]:(v?.id??v??0))||0;

async function api(path,opt={}){
 const r=await fetch(`${C.host}/api${path}`,{method:opt.method||"GET",headers:{Authorization:`Bearer ${C.key}`,"Content-Type":"application/json"},body:opt.body?JSON.stringify(opt.body):undefined});
 if(!r.ok)throw new Error(`${r.status} ${await r.text()}`); return r.status===204?null:r.json();
}
async function rec(doc,t){return (await api(`/docs/${enc(doc)}/tables/${enc(t)}/records`)).records||[]}
async function create(doc,t,fields){return api(`/docs/${enc(doc)}/tables/${enc(t)}/records`,{method:"POST",body:{records:[{fields}]}})}
async function patch(doc,t,id,fields){return api(`/docs/${enc(doc)}/tables/${enc(t)}/records`,{method:"PATCH",body:{records:[{id,fields}]}})}

async function syncResources(){
 const [src,dst,teams]=await Promise.all([rec(C.cockpit,"Team"),rec(C.demandes,"Ressources"),rec(C.cockpit,"Team_ref")]);
 for(const s of src){
   const mail=norm(f(s,"Email")).toLowerCase(); if(!mail)continue;
   const team=teams.find(t=>t.id===rid(f(s,"Equipe")));
   const fields={Email:f(s,"Email"),Nom:f(s,"Nom"),Profil:f(s,"Profil"),Equipe_Code:team?norm(f(team,"Code")):"",Actif:f(s,"Actif"),Source_Team_ID:s.id};
   const d=dst.find(x=>norm(f(x,"Email")).toLowerCase()===mail);
   d?await patch(C.demandes,"Ressources",d.id,fields):await create(C.demandes,"Ressources",fields);
 }
}
async function syncRequestsToCockpit(){
 const [src,dst,srcRes,cockRes,cockTeams,cockMotifs]=await Promise.all([
   rec(C.demandes,"Demandes_RH"),rec(C.cockpit,"Demandes_RH"),rec(C.demandes,"Ressources"),
   rec(C.cockpit,"Team"),rec(C.cockpit,"Team_ref"),rec(C.cockpit,"Motifs_RH")
 ]);
 for(const s of src){
   const uuid=norm(f(s,"UUID_Demande")); if(!uuid)continue;
   const localRes=srcRes.find(r=>r.id===rid(f(s,"Demandeur"))); if(!localRes)continue;
   const mail=norm(f(localRes,"Email")).toLowerCase();
   const cr=cockRes.find(r=>norm(f(r,"Email")).toLowerCase()===mail); if(!cr){console.warn("Ressource Cockpit absente",mail);continue}
   const motifCode=norm(f(s,"Motif_Code"));
   const cm=cockMotifs.find(m=>norm(f(m,"Code"))===motifCode); if(!cm){console.warn("Code motif Cockpit absent",motifCode,uuid);continue}
   const teamCode=norm(f(localRes,"Equipe_Code"));
   const ct=cockTeams.find(t=>norm(f(t,"Code"))===teamCode);
   const d=dst.find(x=>norm(f(x,"UUID_Demande"))===uuid);
   const fields={Reference:f(s,"Reference"),Demandeur:cr.id,Equipe:ct?.id||0,Type:f(s,"Type"),Date_Debut:f(s,"Date_Debut"),Date_Fin:f(s,"Date_Fin"),Motif:cm.id,Commentaire_Demandeur:f(s,"Commentaire_Demandeur"),Date_Demande:f(s,"Date_Demande"),UUID_Demande:uuid};
   // Le statut collaborateur n'est maître qu'à la création / annulation avant décision.
   if(!d)fields.Statut=f(s,"Statut")||"EN_ATTENTE";
   else if(norm(f(d,"Statut"))==="EN_ATTENTE" && norm(f(s,"Statut"))==="ANNULEE")fields.Statut="ANNULEE";
   d?await patch(C.cockpit,"Demandes_RH",d.id,fields):await create(C.cockpit,"Demandes_RH",fields);
 }
}
async function syncManagerDecisions(){
 const [src,dst]=await Promise.all([rec(C.cockpit,"Demandes_RH"),rec(C.demandes,"Demandes_RH")]);
 for(const s of src){
   const uuid=norm(f(s,"UUID_Demande")); if(!uuid)continue;
   const d=dst.find(x=>norm(f(x,"UUID_Demande"))===uuid); if(!d)continue;
   const status=norm(f(s,"Statut")).toUpperCase();
   if(!["VALIDEE","REFUSEE","EN_ATTENTE","ANNULEE"].includes(status))continue;
   await patch(C.demandes,"Demandes_RH",d.id,{Statut:status,Manager_Email:f(s,"Manager_Email"),Commentaire_Manager:f(s,"Commentaire_Manager"),Date_Decision:f(s,"Date_Decision")});
 }
}
(async()=>{await syncResources();await syncRequestsToCockpit();await syncManagerDecisions();console.log("SYNC V1.2 OK")})().catch(e=>{console.error(e);process.exitCode=1});
