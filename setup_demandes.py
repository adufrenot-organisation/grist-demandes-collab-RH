#!/usr/bin/env python3
"""Setup V1.3 — à lancer uniquement sur le poste administrateur."""
import os, json, urllib.request, urllib.error

HOST=os.environ["GRIST_HOST"].rstrip("/")
KEY=os.environ["GRIST_API_KEY"]
DOC=os.environ["DEMANDES_DOC_ID"]

def api(path, method="GET", body=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(HOST+"/api"+path,data=data,method=method,
        headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
    with urllib.request.urlopen(req) as r:
        raw=r.read()
        return json.loads(raw) if raw else None

schemas={
"Ressources":[
 {"id":"Email","fields":{"type":"Text"}},{"id":"Nom","fields":{"type":"Text"}},
 {"id":"Profil","fields":{"type":"Text"}},{"id":"Equipe_Code","fields":{"type":"Text"}},
 {"id":"Actif","fields":{"type":"Bool"}},{"id":"Source_Team_ID","fields":{"type":"Int"}}],
"Motifs_RH":[
 {"id":"Code","fields":{"type":"Text"}},{"id":"Libelle","fields":{"type":"Text"}},
 {"id":"Actif","fields":{"type":"Bool"}},{"id":"Description","fields":{"type":"Text"}}],
"ADMIN_PORTAIL":[
 {"id":"Email","fields":{"type":"Text"}},{"id":"Nom","fields":{"type":"Text"}},
 {"id":"Role","fields":{"type":"Text"}},{"id":"Actif","fields":{"type":"Bool"}}],
"Demandes_RH":[
 {"id":"Reference","fields":{"type":"Text"}},{"id":"Demandeur","fields":{"type":"Ref:Ressources"}},
 {"id":"Type","fields":{"type":"Text"}},{"id":"Date_Debut","fields":{"type":"Date"}},
 {"id":"Date_Fin","fields":{"type":"Date"}},{"id":"Motif","fields":{"type":"Ref:Motifs_RH"}},
 {"id":"Motif_Code","fields":{"type":"Text"}},{"id":"Statut","fields":{"type":"Text"}},
 {"id":"Manager_Email","fields":{"type":"Text"}},{"id":"Commentaire_Demandeur","fields":{"type":"Text"}},
 {"id":"Commentaire_Manager","fields":{"type":"Text"}},{"id":"Date_Demande","fields":{"type":"DateTime"}},
 {"id":"Date_Decision","fields":{"type":"DateTime"}},{"id":"Date_Modification","fields":{"type":"DateTime"}},
 {"id":"UUID_Demande","fields":{"type":"Text"}},{"id":"Version_Sync","fields":{"type":"Int"}}]
}
tables=api(f"/docs/{DOC}/tables").get("tables",[])
existing={t["id"] for t in tables}
for name, schema in schemas.items():
    if name not in existing:
        api(f"/docs/{DOC}/tables","POST",{"tables":[{"id":name,"columns":schema}]})
        print("Table créée:",name)
    else:
        cols=api(f"/docs/{DOC}/tables/{name}/columns").get("columns",[])
        ids={c["id"] for c in cols}
        missing=[c for c in schema if c["id"] not in ids]
        if missing:
            api(f"/docs/{DOC}/tables/{name}/columns","POST",{"columns":missing})
        print("Table vérifiée:",name,"; ajoutées:",", ".join(c["id"] for c in missing) or "aucune")
owner=os.environ.get("OWNER_EMAIL","").strip()
if owner:
    rows=api(f"/docs/{DOC}/tables/ADMIN_PORTAIL/records").get("records",[])
    found=next((r for r in rows if str(r.get("fields",{}).get("Email","")).strip().lower()==owner.lower()),None)
    fields={"Email":owner,"Nom":"Owner","Role":"OWNER","Actif":True}
    if found:
        api(f"/docs/{DOC}/tables/ADMIN_PORTAIL/records","PATCH",{"records":[{"id":found["id"],"fields":fields}]})
    else:
        api(f"/docs/{DOC}/tables/ADMIN_PORTAIL/records","POST",{"records":[{"fields":fields}]})
    print("Owner bootstrap configuré:",owner)
else:
    print("OWNER_EMAIL non défini : table ADMIN_PORTAIL créée, mais aucun Owner bootstrap ajouté.")
print("SETUP V1.7 OK")
