# Demandes RH Collaborateurs — V1.1

## Architecture retenue
Le document Demandes RH possède ses propres tables locales :
- `Ressources` : copie esclave de `Cockpit.Team`
- `Motifs_RH` : référentiel **local**, jamais synchronisé avec les motifs du Cockpit
- `Demandes_RH` : maître lors de la création/modification collaborateur

Le Cockpit possède sa propre `Demandes_RH`. La synchronisation rapproche les demandes par `UUID_Demande`.

### Mapping motifs
Les deux documents ont leurs propres `Motifs_RH`.
Aucune synchronisation de cette table.
Le lien logique est `Motifs_RH.Code`.
Lors d'une demande, le widget enregistre aussi `Demandes_RH.Motif_Code`.
Le synchroniseur cherche ce Code dans `Cockpit.Motifs_RH` et renseigne le Ref Motif local du Cockpit.

## Colonnes locales attendues
### Ressources
`Email`, `Nom`, `Profil`, `Actif`, `Source_Team_ID`

### Motifs_RH
au minimum `Code`, `Libelle`, `Actif`

### Demandes_RH
`Reference`, `Demandeur` (Ref:Ressources), `Type`, `Date_Debut`, `Date_Fin`,
`Motif` (Ref:Motifs_RH), `Motif_Code`, `Statut`, `Commentaire_Demandeur`,
`Commentaire_Manager`, `Manager_Email`, `Date_Demande`, `Date_Decision`,
`Date_Modification`, `UUID_Demande`, `Version_Sync`.

## Synchronisation
`sync.js` contient les 3 flux :
1. Cockpit `Team` -> Demandes `Ressources`
2. Demandes `Demandes_RH` -> Cockpit `Demandes_RH`
3. Cockpit décisions manager -> Demandes `Demandes_RH`

Variables d'environnement du synchroniseur :
`GRIST_HOST`, `GRIST_API_KEY`, `COCKPIT_DOC_ID`, `DEMANDES_DOC_ID`.

Ne jamais placer la clé de synchronisation dans le JavaScript du widget.
