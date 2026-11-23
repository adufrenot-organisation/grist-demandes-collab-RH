# V1.98 — fallback géométrique de la grille OCR

- L’import ne dépend plus de la reconnaissance OCR de l’en-tête 01–31.
- Si moins de 3 numéros de jours fiables sont reconnus, le module utilise les lignes des mois et les variations de couleur de la grille pour localiser la zone des jours.
- La zone est divisée en 31 colonnes et les centres de jours sont reconstruits géométriquement.
- L’OCR reste utilisé pour les codes métier CA, RH, TL, RT, JS, DI, etc.
- Le message de résultat indique si les jours ont été déterminés par OCR ou par géométrie.
