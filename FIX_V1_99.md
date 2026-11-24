# V1.99 — Import OCR : reconstruction géométrique des mois

- Suppression de la dépendance obligatoire à la reconnaissance OCR des noms Janvier à Décembre.
- Si moins de 6 mois sont reconnus, reconstruction des 12 lignes par trame géométrique à partir des codes OCR présents dans le tableau.
- Recherche d’une cadence régulière de 12 lignes, avec tolérance aux mois dont aucun code n’est reconnu.
- Le fallback géométrique des 31 jours de la V1.98 est conservé.
- L’OCR reste principalement utilisé pour les codes métier (CA, RH, TL, RT, JS, DI, etc.).
