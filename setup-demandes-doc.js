/*
setup-demandes-doc.js — V1.2
Crée/complète les tables locales du document "Demandes RH Collaborateurs".
Node 18+.

ENV:
  GRIST_HOST=https://...
  GRIST_API_KEY=...
  DEMANDES_DOC_ID=...

Aucun secret ne doit être intégré au widget.
*/
const C={host:(process.env.GRIST_HOST||"").replace(/\/$/,""),key:process.env.GRIST_API_KEY,doc:process.env.DEMANDES_DOC_ID};
if(!C.host||!C.key||!C.doc)throw new Error("Définir GRIST_HOST, GRIST_API_KEY et DEMANDES_DOC_ID");

async function api(path,opt={}){
  const r=await fetch(`${C.host}/api${path}`,{
    method:opt.method||"GET",
    headers:{Authorization:`Bearer ${C.key}`,"Content-Type":"application/json"},
    body:opt.body?JSON.stringify(opt.body):undefined
  });
  if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);
  return r.status===204?null:r.json();
}
const enc=encodeURIComponent;
async function tables(){return (await api(`/docs/${enc(C.doc)}/tables`)).tables||[]}
async function cols(t){return (await api(`/docs/${enc(C.doc)}/tables/${enc(t)}/columns`)).columns||[]}
async function createTable(id,columns){
  return api(`/docs/${enc(C.doc)}/tables`,{method:"POST",body:{tables:[{id,columns}]}});
}
async function addCols(t,columns){
  if(!columns.length)return;
  return api(`/docs/${enc(C.doc)}/tables/${enc(t)}/columns`,{method:"POST",body:{columns}});
}
const schemas={
  Ressources:[
    {id:"Email",fields:{type:"Text"}},
    {id:"Nom",fields:{type:"Text"}},
    {id:"Profil",fields:{type:"Text"}},
    {id:"Equipe_Code",fields:{type:"Text"}},
    {id:"Actif",fields:{type:"Bool"}},
    {id:"Source_Team_ID",fields:{type:"Int"}}
  ],
  Motifs_RH:[
    {id:"Code",fields:{type:"Text"}},
    {id:"Libelle",fields:{type:"Text"}},
    {id:"Actif",fields:{type:"Bool"}},
    {id:"Description",fields:{type:"Text"}}
  ],
  Demandes_RH:[
    {id:"Reference",fields:{type:"Text"}},
    {id:"Demandeur",fields:{type:"Ref:Ressources"}},
    {id:"Type",fields:{type:"Text"}},
    {id:"Date_Debut",fields:{type:"Date"}},
    {id:"Date_Fin",fields:{type:"Date"}},
    {id:"Motif",fields:{type:"Ref:Motifs_RH"}},
    {id:"Motif_Code",fields:{type:"Text"}},
    {id:"Statut",fields:{type:"Text"}},
    {id:"Manager_Email",fields:{type:"Text"}},
    {id:"Commentaire_Demandeur",fields:{type:"Text"}},
    {id:"Commentaire_Manager",fields:{type:"Text"}},
    {id:"Date_Demande",fields:{type:"DateTime"}},
    {id:"Date_Decision",fields:{type:"DateTime"}},
    {id:"Date_Modification",fields:{type:"DateTime"}},
    {id:"UUID_Demande",fields:{type:"Text"}},
    {id:"Version_Sync",fields:{type:"Int"}}
  ]
};
(async()=>{
  const existing=await tables();
  for(const [name,schema] of Object.entries(schemas)){
    if(!existing.some(t=>t.id===name)){
      await createTable(name,schema);
      console.log("Table créée:",name);
      continue;
    }
    const current=await cols(name);
    const ids=new Set(current.map(c=>c.id));
    const missing=schema.filter(c=>!ids.has(c.id));
    await addCols(name,missing);
    console.log("Table vérifiée:",name,"colonnes ajoutées:",missing.map(c=>c.id).join(", ")||"aucune");
  }
  console.log("SETUP DEMANDES RH OK");
})().catch(e=>{console.error(e);process.exitCode=1});
