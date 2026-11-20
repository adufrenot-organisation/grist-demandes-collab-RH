# Correctif V1.72

- Correction du clic sur le bouton calendrier à côté des ressources dans le planning.
- Le gestionnaire de clic utilise désormais une délégation d'événement sur `planningBody`, ce qui reste fonctionnel après chaque re-rendu du tableau.
- Ajout de `preventDefault`, `stopPropagation`, `pointer-events:auto` et d'un z-index explicite sur le bouton calendrier.
- Version affichée mise à jour en V1.72.
