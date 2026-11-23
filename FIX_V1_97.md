# V1.97 — OCR : reconstruction robuste de l’en-tête 01–31

- La détection de l’en-tête des jours n’exige plus 10 numéros OCR.
- À partir de 3 numéros de jours cohérents, le module calcule l’espacement horizontal et reconstruit les 31 colonnes.
- Les tokens comme `01`, `02,`, `03.` sont tolérés.
- Le regroupement vertical des numéros est plus tolérant pour les scans/images légèrement décalés.
- Si moins de 3 jours cohérents sont réellement reconnus, l’analyse reste bloquée avec un message explicite afin d’éviter d’associer des congés à de mauvaises dates.
