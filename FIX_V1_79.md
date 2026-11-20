# V1.79 — Responsive planning, visibilité KPI et motifs réels

- Refonte responsive du bandeau d’indicateurs du planning.
- Nouvelle table `PARAM_PLANNING_INDICATEURS` pour paramétrer la visibilité des KPI par rôle et avec dérogation par ressource.
- Rôles pris en charge : COLLABORATEUR, MANAGER, PMO, ADMIN, OWNER.
- Une règle ressource est prioritaire sur la règle de rôle.
- Les absences prévisionnelles sont calculées pour tous ; leur visibilité dépend désormais du paramétrage.
- Correction de l’affichage des détails : utilisateur sur sa ligne, manager sur ses ressources, admin/owner sur toutes les lignes voient le motif d’origine synchronisé (`Libelle`/`Motif_Code`), et non le libellé générique de `PARAM_MOTIFS_PRESENCE`.
- `PARAM_MOTIFS_PRESENCE` reste utilisé pour classifier JOUR_TRAVAILLE / ABSENCE / AUCUN_IMPACT, les couleurs et les statistiques.
