# RH Demandes Collaborateurs — V1.2

## 1. Tables du document Demandes RH
Exécuter `setup-demandes-doc.js` une fois avec :
- `GRIST_HOST`
- `GRIST_API_KEY`
- `DEMANDES_DOC_ID`

Le script crée/complète :
- `Ressources`
- `Motifs_RH`
- `Demandes_RH`

`Motifs_RH` est **local** et n'est jamais synchronisé. Les deux documents sont reliés par `Motifs_RH.Code`.

## 2. Synchronisation
`sync.js` utilise :
- `GRIST_HOST`
- `GRIST_API_KEY`
- `COCKPIT_DOC_ID`
- `DEMANDES_DOC_ID`

Flux :
1. `Cockpit.Team` -> `Demandes.Ressources` (upsert par Email)
2. `Demandes.Demandes_RH` -> `Cockpit.Demandes_RH` (upsert par UUID_Demande)
3. décision manager `Cockpit.Demandes_RH` -> `Demandes.Demandes_RH`

Mapping motif :
`Demandes_RH.Motif` -> motif local -> `Code` stocké dans `Motif_Code` -> recherche du même `Code` dans `Cockpit.Motifs_RH` -> Ref motif local du Cockpit.

Aucune suppression globale. Aucun secret n'est embarqué dans le widget.

## 3. Widget
Le widget V1.2 travaille exclusivement avec les tables locales du document Demandes RH. Le collaborateur est identifié par l'utilisateur Grist connecté et `Ressources.Email`.
