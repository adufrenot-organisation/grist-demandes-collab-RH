# FIX V1.89 — Sauvegarde des libellés du planning

## Problème
La sauvegarde d’un libellé comme `planning.demand.title` pouvait afficher « Le libellé ne peut pas être vide ».

## Cause
Le code cherchait le premier élément de toute la page portant `data-label-key`. Depuis l’ajout des libellés directement sur les titres du planning, il récupérait le titre affiché au lieu du champ de saisie de l’écran Administration → Libellés.

## Correctif
La sauvegarde cible désormais uniquement `.label-input[data-label-key=...]`.

## Fichiers modifiés
- `app.js`
- `index.html` (version affichée)
