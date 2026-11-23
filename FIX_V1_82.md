# V1.82 — Guides intégrés au portail

## Évolutions
- Ajout de **Administration → Guides**.
- Le **Guide utilisateur** est affiché par défaut et accessible à tous les profils.
- Le **Guide manager** est accessible en plus aux profils `MANAGER` et `PMO`.
- Le **Guide administrateur** est réservé à l'`OWNER`.
- Les trois guides HTML sont embarqués dans le package sous `guides/` et s'affichent directement dans le portail.
- Ajout d'un bouton **Ouvrir seul ↗** pour consulter le guide dans un onglet séparé.
- La rubrique Administration reste visible pour tous afin de donner accès aux Guides, mais les autres menus d'administration restent masqués selon les droits existants.
- Correction de l'accordéon de navigation afin qu'il ne réaffiche pas une entrée masquée par les droits.

## Fichiers modifiés
- `index.html`
- `app.js`
- `styles.css`

## Fichiers ajoutés
- `guides/Guide_utilisateur_RH_V1.81.html`
- `guides/Guide_manager_RH_V1.81.html`
- `guides/Guide_administrateur_RH_V1.81.html`
- `FIX_V1_82.md`
