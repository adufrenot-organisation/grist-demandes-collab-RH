# V1.76 — Indicateurs annuels contextuels dans le planning

- Conservation des KPI de la période affichée.
- Ajout d’une seconde ligne de KPI sur toute l’année correspondant à la date de début sélectionnée.
- Les KPI annuels respectent les filtres équipe, recherche et sélection multi-collaborateurs.
- Présence annuelle : nombre de jours `JOUR_TRAVAILLE`.
- Absences annuelles : nombre de jours `ABSENCE`.
- Taux annuel = JOUR_TRAVAILLE / (JOUR_TRAVAILLE + ABSENCE).
- Week-ends, jours fériés, `AUCUN_IMPACT` et motifs non paramétrés sont exclus.
