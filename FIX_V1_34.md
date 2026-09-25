# V1.34 — Correctif démarrage V1.33

Symptôme : écran bloqué sur « Identification… », menu vide.

Correction :
- `Managers_Ressources` devient réellement optionnelle au démarrage.
- Lecture directe et tolérante de la table d'affectations.
- Une table absente ou non lisible ne bloque plus `identify()` / `load()` / l'affichage normal.
- La fonctionnalité « Voir comme » reste disponible dès que `Managers_Ressources` existe et est lisible.
- Les libellés optionnels ne peuvent plus bloquer le démarrage non plus.
