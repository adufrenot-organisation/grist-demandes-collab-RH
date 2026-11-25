# V2.04 — Affichage optionnel des motifs réels dans les vues annuelles

Base: V2.03.

- Ajoute la case **Afficher les motifs réels** dans le calendrier annuel individuel.
- Ajoute la même case dans **Disponibilité annuelle de l’équipe**.
- Quand elle est décochée, l’affichage reste inchangé (P/A/AP).
- Quand elle est cochée, les jours confirmés P/A sont remplacés à la volée par le code réel du motif résolu depuis `Motifs_RH` à partir de `PLANNING_PRESENCE.Motif_Code`.
- `AP` reste `AP` car il s’agit d’une demande prévisionnelle et non d’une présence confirmée.
- Aucun enregistrement n’est modifié dans Grist : il s’agit uniquement d’un mode d’affichage.
- Les droits de confidentialité existants restent appliqués : sans droit de détail, la cellule reste P/A.
