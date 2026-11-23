# FIX V1.87 — Couleur administrable des absences prévisionnelles (AP)

## Fonctionnalité
- ajout du paramètre `PLANNING_COULEUR_AP` dans `PARAM_PLANNING` ;
- sélecteur visuel + code hexadécimal dans **Administration → Paramètres planning** ;
- couleur par défaut : `#FFD54F` ;
- application de la couleur AP au planning, au compteur d’absences prévisionnelles, au calendrier annuel et à la disponibilité annuelle d’équipe ;
- une AP conserve toujours la couleur prévisionnelle, même si l’utilisateur a accès au motif réel. Le motif reste disponible dans le détail/infobulle.

## Fichiers modifiés
- `app.js`
- `index.html`
- `styles.css`
