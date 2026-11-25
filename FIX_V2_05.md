# V2.05 — Règles d’affichage du détail des motifs annuels

Base : V2.04 construite depuis V2.03.

## Calendrier annuel individuel
- La case **Afficher les motifs réels** n’est visible que lorsque la ressource consultée est la personne réellement connectée.
- Un manager, un admin ou un owner qui ouvre le calendrier individuel d’une autre ressource ne voit pas cette case.

## Disponibilité annuelle de l’équipe
- OWNER : la case est visible et permet d’afficher les motifs réels pour toutes les ressources affichées.
- MANAGER : la case est visible et les motifs réels ne sont affichés que pour ses ressources gérées.
- Autres profils : la case est masquée.

## Sécurité
- Aucun changement de données Grist.
- AP reste affiché AP.
- Le détail est calculé à la volée à partir de PLANNING_PRESENCE / Motifs_RH.
