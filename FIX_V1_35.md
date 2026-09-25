# V1.35 — correctif démarrage isolé

La fonctionnalité Manager / Voir comme est retirée du chemin critique de démarrage.

Ordre :
1. identification Grist
2. chargement normal du portail
3. affichage du portail
4. chargement des libellés
5. seulement ensuite, en tâche optionnelle, chargement Managers_Ressources / Voir comme

Ainsi une erreur du module manager ne peut plus laisser l'application bloquée sur « Identification… ».
