# V1.75 — planning filtrable et durée configurable

## Planning
- Les indicateurs du planning sont calculés uniquement sur la plage de dates affichée et sur les ressources effectivement filtrées.
- Le compteur d'absences prévisionnelles exclut week-ends et jours fériés.
- Le taux de présence utilise les jours confirmés `JOUR_TRAVAILLE` et `ABSENCE` du périmètre affiché.
- Ajout d'une sélection multi-collaborateurs en complément de la recherche texte et du filtre équipe.
- La durée d'affichage est exprimée en semaines : 2 semaines par défaut, soit 14 jours calendaires.
- Les boutons précédent/suivant déplacent la fenêtre de la durée courante.

## Administration
- Nouveau menu `Paramètres planning`.
- Nouvelle table `PARAM_PLANNING` : `Cle`, `Valeur`, `Commentaire`.
- Clés :
  - `PLANNING_SEMAINES_DISPONIBLES` (défaut `2,3,4`)
  - `PLANNING_SEMAINES_DEFAUT` (défaut `2`)
- L'interface permet d'autoriser de 1 à 8 semaines et de choisir la valeur par défaut.

## Compatibilité
- Si `PARAM_PLANNING` n'existe pas ou n'est pas lisible, le planning utilise `2,3,4` avec 2 semaines par défaut.
