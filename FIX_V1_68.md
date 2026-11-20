# FIX V1.68 — Planning : compteur annuel et visibilité des motifs

## Correctifs

- Le compteur **Absences prévisionnelles YYYY** est désormais calculé sur toute l’année civile en cours et sur l’ensemble des ressources actives visibles par le profil PMO/Admin/Owner. Il ne dépend plus de la fenêtre de 15 jours, du filtre équipe ni de la recherche du planning.
- Les jours sont dédupliqués par couple `Ressource + Date`.
- Le contexte manager (`Managers_Ressources`) est chargé avant l’affichage initial de l’application.
- Un manager voit les détails réels des motifs pour sa propre ligne et pour les ressources explicitement rattachées dans `Managers_Ressources`.
- Admin et Owner voient les détails réels de toutes les lignes visibles.
- Après rechargement du contexte manager, le planning est immédiatement rerendu si nécessaire.
