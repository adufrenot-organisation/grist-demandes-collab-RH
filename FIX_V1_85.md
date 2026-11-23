# FIX V1.85 — Alignement des couleurs présence / absence

## Demande
Les couleurs affichées pour les indicateurs de présence et d’absence dans le planning n’étaient pas alignées avec les couleurs configurées dans l’interface d’administration (`PARAM_MOTIFS_PRESENCE`).

## Correctif appliqué
- ajout d’un thème dynamique dérivé de `PARAM_MOTIFS_PRESENCE` ;
- les couleurs des types **Jour travaillé** et **Absence** sont maintenant relues depuis la configuration admin ;
- application de ces couleurs aux éléments suivants :
  - puces `P` et `A` du planning ;
  - indicateurs annuels **Présence** et **Absences** ;
  - calendrier annuel ressource ;
  - vue de disponibilité d’équipe.

## Fichiers modifiés
- `app.js`
- `styles.css`
