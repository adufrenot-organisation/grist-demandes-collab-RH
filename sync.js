/*
SYNC V1.1 — specification/executable Node 18+ skeleton.
Secrets MUST be environment variables, never embedded in a widget:
GRIST_HOST, GRIST_API_KEY, COCKPIT_DOC_ID, DEMANDES_DOC_ID.

Flows:
1) Cockpit.Team -> Demandes.Ressources (master Cockpit)
2) Demandes.Demandes_RH -> Cockpit.Demandes_RH (master collaborator fields)
3) Cockpit.Demandes_RH -> Demandes.Demandes_RH (master manager decision fields)

Motifs_RH are LOCAL on both sides. They are NOT synchronized.
Demand motif mapping is by Motifs_RH.Code / Demandes_RH.Motif_Code.
*/
const cfg={host:process.env.GRIST_HOST,key:process.env.GRIST_API_KEY,cockpit:process.env.COCKPIT_DOC_ID,demandes:process.env.DEMANDES_DOC_ID};
if(Object.values(cfg).some(x=>!x))throw new Error("Configuration sync incomplète");
async function req(path,opt={}){const r=await fetch(`${cfg.host.replace(/\/$/,"")}/api${path}`,{method:opt.method||"GET",headers:{Authorization:`Bearer ${cfg.key}`,"Content-Type":"application/json"},body:opt.body?JSON.stringify(opt.body):undefined});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);return r.status===204?null:r.json()}
async function records(doc,t){return (await req(`/docs/${encodeURIComponent(doc)}/tables/${t}/records`)).records||[]}
async function patch(doc,t,id,fields){return req(`/docs/${encodeURIComponent(doc)}/tables/${t}/records`,{method:"PATCH",body:{records:[{id,fields}]}})}
async function create(doc,t,fields){return req(`/docs/${encodeURIComponent(doc)}/tables/${t}/records`,{method:"POST",body:{records:[{fields}]}})}
const f=(r,k)=>r.fields?.[k], norm=x=>String(x??"").trim();

async function syncResources(){
  const [src,dst]=await Promise.all([records(cfg.cockpit,"Team"),records(cfg.demandes,"Ressources")]);
  for(const s of src){
    const mail=norm(f(s,"Email")).toLowerCase(); if(!mail)continue;
    const d=dst.find(x=>norm(f(x,"Email")).toLowerCase()===mail);
    const fields={Email:f(s,"Email"),Nom:f(s,"Nom"),Profil:f(s,"Profil"),Actif:f(s,"Actif"),Source_Team_ID:s.id};
    d?await patch(cfg.demandes,"Ressources",d.id,fields):await create(cfg.demandes,"Ressources",fields);
  }
}
async function motifByCode(doc,code){const all=await records(doc,"Motifs_RH");return all.find(r=>norm(f(r,"Code"))===norm(code))}
async function syncCollaboratorRequests(){
  const [src,dst]=await Promise.all([records(cfg.demandes,"Demandes_RH"),records(cfg.cockpit,"Demandes_RH")]);
  for(const s of src){
    const uuid=norm(f(s,"UUID_Demande"));if(!uuid)continue;
    const d=dst.find(x=>norm(f(x,"UUID_Demande"))===uuid);
    const motif=await motifByCode(cfg.cockpit,f(s,"Motif_Code"));
    if(!motif){console.warn("Motif Cockpit introuvable:",f(s,"Motif_Code"),uuid);continue}
    const fields={Reference:f(s,"Reference"),Type:f(s,"Type"),Date_Debut:f(s,"Date_Debut"),Date_Fin:f(s,"Date_Fin"),Motif:motif.id,UUID_Demande:uuid,Commentaire_Demandeur:f(s,"Commentaire_Demandeur"),Date_Demande:f(s,"Date_Demande")};
    if(!d)fields.Statut=f(s,"Statut")||"EN_ATTENTE";
    d?await patch(cfg.cockpit,"Demandes_RH",d.id,fields):await create(cfg.cockpit,"Demandes_RH",fields);
  }
}
async function syncManagerDecisions(){
  const [src,dst]=await Promise.all([records(cfg.cockpit,"Demandes_RH"),records(cfg.demandes,"Demandes_RH")]);
  for(const s of src){
    const uuid=norm(f(s,"UUID_Demande"));if(!uuid)continue;
    const d=dst.find(x=>norm(f(x,"UUID_Demande"))===uuid);if(!d)continue;
    await patch(cfg.demandes,"Demandes_RH",d.id,{Statut:f(s,"Statut"),Manager_Email:f(s,"Manager_Email"),Commentaire_Manager:f(s,"Commentaire_Manager"),Date_Decision:f(s,"Date_Decision")});
  }
}
(async()=>{await syncResources();await syncCollaboratorRequests();await syncManagerDecisions();console.log("SYNC OK")})().catch(e=>{console.error(e);process.exitCode=1});