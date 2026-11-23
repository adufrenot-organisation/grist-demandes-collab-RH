# FIX V1.88 — Rubrique Documentation autonome

## Évolution
Les guides ne sont plus rangés dans Administration. Une rubrique **DOCUMENTATION** autonome est ajoutée dans le menu principal.

## Visibilité
- Guide utilisateur : tous les profils ;
- Guide manager : profils MANAGER et PMO ;
- Guide administrateur : OWNER uniquement.

Le Guide utilisateur est sélectionné par défaut à l’ouverture.

## Administration
La rubrique Administration redevient invisible pour les profils sans fonctions administratives.

## Libellés
Les clés de libellés `section.documentation`, `nav.guides` et `page.guides` permettent de personnaliser les intitulés via `PARAM_LIBELLES`.

## Fichiers modifiés
- `index.html`
- `app.js`
- `styles.css`
