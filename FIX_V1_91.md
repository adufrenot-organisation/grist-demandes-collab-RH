# FIX V1.91 — Accès aux menus de demandes selon le profil Interne / Externe

## Règle
La table `Ressources` contient le champ `Profil_interne_externe` (`Interne` / `Externe`).

- une ressource `Interne` standard ne voit plus les menus liés aux demandes ;
- une ressource `Interne` qui est `PMO` ou `MANAGER` conserve ces menus ;
- les ressources `Externe` conservent le comportement existant ;
- Planning et Documentation restent accessibles.

La restriction est également appliquée dans `showView()` afin d'empêcher l'ouverture directe des vues de demandes.

## Fichiers modifiés
- `app.js`
- `index.html`
