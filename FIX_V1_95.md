# V1.95 — Paramétrage complet de l’import OCR

- Tous les motifs de `Motifs_RH` sont proposés dans la correspondance OCR, y compris les motifs inactifs (signalés comme tels).
- Ajout de `Couleur_Attendue` (`#RRGGBB`) et `Tolerance_Couleur` pour filtrer une reconnaissance OCR par couleur quand une couleur est renseignée.
- Ajout de `Creer_Demande` pour distinguer les codes qui doivent créer une `Demandes_RH` de ceux qui sont uniquement reconnus et tracés.
- Types proposés : Congé, Absence, Présence, Aucun impact.
- Migration automatique de `PARAM_IMPORT_CONGES` : les nouvelles colonnes sont ajoutées sans supprimer les lignes existantes ; les lignes existantes conservent par défaut la création de demande.
- Les codes configurés sans création de demande apparaissent dans le résultat OCR avec le statut « Reconnu uniquement » et sont historisés dans `IMPORT_CONGES_LIGNES`.
