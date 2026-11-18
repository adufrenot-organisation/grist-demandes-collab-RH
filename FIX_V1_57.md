# V1.57 — confidentialité du planning par équipe

- Un utilisateur standard/manager ne voit que le planning de sa propre équipe.
- Si aucune équipe n’est renseignée sur sa ressource, il ne voit que sa propre ligne.
- Admin/Owner conservent le filtre multi-équipe.
- Sur sa propre ligne, l’utilisateur peut voir dans le détail (survol) les informations originales synchronisées du motif RH (libellé/code/statut/commentaire lorsque disponibles).
- Sur les autres lignes, aucune information brute du motif RH n’est révélée : seules les catégories issues de PARAM_MOTIFS_PRESENCE sont exposées (Jour travaillé / Absence).
- Les motifs non configurés ou AUCUN_IMPACT restent masqués sur les autres lignes.
