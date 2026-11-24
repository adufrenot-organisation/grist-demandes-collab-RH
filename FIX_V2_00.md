# V2.00 — OCR cellule par cellule

- Détection géométrique du corps du planning sans dépendre des libellés des mois ni de l’en-tête 01–31.
- Reconstruction fixe 12 × 31 à partir de la zone colorée du planning, avec repli sur les proportions du format de carte annuel.
- Chaque cellule est découpée, agrandie et normalisée avant OCR.
- Deux prétraitements : masque texte puis niveau de gris en secours.
- OCR limité aux codes actifs de PARAM_IMPORT_CONGES, avec corrections non ambiguës des confusions courantes.
- La couleur attendue reste un contrôle secondaire.
