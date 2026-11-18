# V1.65 — filtres d’affichage du planning

Ajout de trois filtres cumulables dans le planning de présence :

- **Jours travaillés (P)**
- **Absences (A)**
- **Absences prévisionnelles (AP)**

Les trois filtres sont activés par défaut et modifient uniquement l’affichage.

Comportement particulier : si **AP** est masqué, la cellule affiche de nouveau la donnée synchronisée de base (`P` ou `A`) si le filtre correspondant est actif.

Aucune donnée Grist n’est modifiée et aucune nouvelle table/colonne n’est nécessaire.
