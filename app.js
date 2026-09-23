const VERSION="V1.2";
const T={requests:"Demandes_RH",resources:"Ressources",motifs:"Motifs_RH"};
const S={user:null,person:null,requests:[],motifs:[],editing:null};
const $=x=>document.getElementById(x), norm=x=>String(x??"").trim(), email=x=>norm(x).toLowerCase();
const F=(r,...ks)=>{for(const k of ks)if(r?.[k]!==undefined)return r[k]};
const rid=v=>Number(Array.isArray(v)?v[1]:(v?.id??v??0))||0;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ep=d=>Math.floor(new Date(d+"T00:00:00").getTime()/1000), st=r=>norm(F(r,"Statut")||"EN_ATTENTE").toUpperCase();
const dt=v=>v?new Date(Number(v)*1000).toLocaleDateString("fr-FR"):"—";
function rows(t){const ids=t.id||[];return ids.map((id,i)=>{const r={id};for(const k of Object.keys(t))if(k!=="id")r[k]=t[k]?.[i];return r})}
async function table(name){return rows(await grist.docApi.fetchTable(name))}
async function identify(){
  const u=await grist.getUser();
  if(!u?.email)throw new Error("Impossible d'identifier l'utilisateur Grist connecté.");
  S.user=u;
  const rr=await table(T.resources);
  S.person=rr.find(r=>email(F(r,"Email","email"))===email(u.email));
  if(!S.person)throw new Error(`Aucune ressource locale ne correspond à ${u.email}. La synchronisation Ressources doit être exécutée.`);
}
async function load(){
  const [q,m]=await Promise.all([table(T.requests),table(T.motifs)]);
  S.motifs=m;
  S.requests=q.filter(r=>rid(F(r,"Demandeur"))===Number(S.person.id));
  render();
}
function motifName(id){const r=S.motifs.find(x=>x.id===id);return r?norm(F(r,"Libelle","Nom","Code")||`Motif ${id}`):"—"}
function motifCode(id){const r=S.motifs.find(x=>x.id===id);return r?norm(F(r,"Code")):""}
function render(){
  $("identity").textContent=`${S.user.name||S.user.email} · ${S.user.email}`;
  $("setup").classList.add("hidden");$("app").classList.remove("hidden");$("fatal").classList.add("hidden");
  $("motif").innerHTML='<option value="">— Choisir —</option>'+S.motifs.filter(r=>F(r,"Actif","actif")!==false).map(r=>`<option value="${r.id}">${esc(motifName(r.id))}</option>`).join("");
  $("kw").textContent=S.requests.filter(r=>st(r)==="EN_ATTENTE").length;
  $("kv").textContent=S.requests.filter(r=>st(r)==="VALIDEE").length;
  $("kr").textContent=S.requests.filter(r=>st(r)==="REFUSEE").length;
  $("rows").innerHTML=S.requests.length?S.requests.slice().reverse().map(r=>{const e=st(r)==="EN_ATTENTE";return `<tr><td>${esc(F(r,"Reference")||"#"+r.id)}</td><td>${esc(F(r,"Type")||"—")}</td><td>${dt(F(r,"Date_Debut"))} → ${dt(F(r,"Date_Fin"))}</td><td>${esc(motifName(rid(F(r,"Motif"))))}</td><td><span class="badge">${esc(st(r))}</span></td><td><div class="rowactions">${e?`<button class="secondary" data-e="${r.id}">Modifier</button><button class="secondary" data-c="${r.id}">Annuler</button>`:""}</div></td></tr>`}).join(""):'<tr><td colspan="6">Aucune demande.</td></tr>';
  document.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>edit(+b.dataset.e));
  document.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>cancelReq(+b.dataset.c));
}
function reset(){S.editing=null;$("formTitle").textContent="Nouvelle demande";$("save").textContent="Envoyer";$("type").value="CONGE";$("motif").value="";$("start").value="";$("end").value="";$("comment").value="";$("cancelEdit").classList.add("hidden")}
function edit(id){const r=S.requests.find(x=>x.id===id);if(!r||st(r)!=="EN_ATTENTE")return;S.editing=id;$("formTitle").textContent="Modifier ma demande";$("save").textContent="Enregistrer";$("type").value=F(r,"Type")||"CONGE";$("motif").value=rid(F(r,"Motif"));const iso=v=>new Date(Number(v)*1000).toISOString().slice(0,10);$("start").value=iso(F(r,"Date_Debut"));$("end").value=iso(F(r,"Date_Fin"));$("comment").value=F(r,"Commentaire_Demandeur")||"";$("cancelEdit").classList.remove("hidden")}
async function save(){
  const a=$("start").value,b=$("end").value,m=+$("motif").value;
  if(!a||!b||!m)return msg("Motif et période obligatoires.");
  if(b<a)return msg("La date de fin doit être ≥ à la date de début.");
  const fields={Type:$("type").value,Date_Debut:ep(a),Date_Fin:ep(b),Motif:m,Motif_Code:motifCode(m),Commentaire_Demandeur:$("comment").value.trim(),Date_Modification:Math.floor(Date.now()/1000)};
  const tab=grist.getTable(T.requests);
  if(S.editing){
    const r=S.requests.find(x=>x.id===S.editing);if(!r||st(r)!=="EN_ATTENTE")throw new Error("Demande non modifiable.");
    await tab.update({id:S.editing,fields});
  } else {
    const u=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
    Object.assign(fields,{Reference:`DRH-${new Date().getFullYear()}-${u.slice(0,8).toUpperCase()}`,Demandeur:S.person.id,Statut:"EN_ATTENTE",Date_Demande:Math.floor(Date.now()/1000),UUID_Demande:u,Version_Sync:1});
    await tab.create({fields});
  }
  reset();await load();
}
async function cancelReq(id){const r=S.requests.find(x=>x.id===id);if(!r||st(r)!=="EN_ATTENTE"||!confirm("Annuler cette demande ?"))return;await grist.getTable(T.requests).update({id,fields:{Statut:"ANNULEE",Date_Modification:Math.floor(Date.now()/1000)}});await load()}
function msg(t){$("msg").textContent=t;$("msg").classList.remove("hidden")}
function fatal(e){$("fatal").textContent=e?.message||String(e);$("fatal").classList.remove("hidden");$("app").classList.add("hidden")}
async function boot(){grist.ready({requiredAccess:"full"});$("save").onclick=()=>save().catch(fatal);$("newBtn").onclick=reset;$("cancelEdit").onclick=reset;$("refresh").onclick=()=>load().catch(fatal);await identify();await load()}
boot().catch(fatal);