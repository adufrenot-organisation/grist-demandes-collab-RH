# FIX V1.69 — Calendrier annuel et taux de présence

- Ajout d’un bouton calendrier à côté de chaque ressource du Planning présence.
- Ouverture d’un encart annuel, par défaut sur l’année en cours, avec navigation par année.
- Calendrier annuel P / A / AP selon `PARAM_MOTIFS_PRESENCE`.
- Calcul du taux de présence confirmé : `JOUR_TRAVAILLE / (JOUR_TRAVAILLE + ABSENCE)`.
- Calcul du nombre de jours d’absence confirmés sur l’année sélectionnée.
- Les motifs `AUCUN_IMPACT` et non configurés sont exclus du calcul.
- Les absences prévisionnelles AP sont visibles mais ne sont pas comptées comme absences confirmées.
- Respect des droits de détail existants : collaborateur = soi-même, manager = ressources gérées, admin/owner = tout.
- Ajout dans l’entête global du planning du taux de présence de l’année en cours, à côté du compteur d’absences prévisionnelles.
