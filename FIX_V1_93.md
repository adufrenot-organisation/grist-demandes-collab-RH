# V1.93 — Module Import congés par image

## Fonctionnalités
- nouveau menu **Import congés** pour les ressources `Interne`, les `PMO` et les `MANAGER` ;
- OCR classique dans le navigateur via Tesseract.js ;
- détection de la grille annuelle (mois en lignes, jours 01–31 en colonnes) ;
- correspondance des codes OCR avec les motifs RH via `PARAM_IMPORT_CONGES` ;
- regroupement des jours détectés en périodes ;
- écran de validation des brouillons avant création ;
- création de demandes `EN_ATTENTE` dans `Demandes_RH`, destinées à être reprises par la synchronisation ;
- traçabilité via `IMPORT_CONGES` et `IMPORT_CONGES_LIGNES`.

## Administration
Nouveau menu **Paramètres import congés** permettant de gérer :
- code OCR ;
- motif RH ;
- type de demande ;
- seuil de confiance ;
- activation ;
- commentaire.

## Tables
- `PARAM_IMPORT_CONGES`
- `IMPORT_CONGES`
- `IMPORT_CONGES_LIGNES`

## Fichiers modifiés
- `app.js`
- `index.html`
- `styles.css`

## Dépendance
Tesseract.js 4.1.4 chargé depuis jsDelivr pour l’OCR côté navigateur.
