# FIX V1.92 — Règle débrayable pour les ressources internes

## Nouveau paramètre
`PARAM_PLANNING.MASQUER_DEMANDES_INTERNES`

- `true` : les ressources `Interne` ne voient pas les menus de demandes, sauf Manager / PMO.
- `false` : la restriction est désactivée ; le comportement historique s'applique.

## Administration
Ajout d'une case à cocher dans **Administration → Paramètres planning**.

## Fichiers modifiés
- `app.js`
- `index.html`
- `styles.css`
