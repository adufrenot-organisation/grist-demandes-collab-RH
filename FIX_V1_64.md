# V1.64 — absences prévisionnelles dans le planning

- Le planning synchronisé `PLANNING_PRESENCE` reste la base et n’est jamais modifié par l’affichage.
- Les demandes futures `EN_ATTENTE` dont le motif actif est classé `ABSENCE` dans `PARAM_MOTIFS_PRESENCE` sont superposées à l’écran avec le code `AP` (absence prévisionnelle).
- Les demandes d’annulation (`Type_Action = ANNULATION`) sont exclues de la couche prévisionnelle.
- La surcharge ne s’applique qu’à partir de la date du jour.
- Sur sa propre ligne, l’utilisateur voit le motif et la référence de sa demande prévisionnelle ; sur les autres lignes, seul « Absence prévisionnelle » est révélé.
- Une légende `AP` orange/ambre est ajoutée au planning.
- Les profils PMO, ADMIN et Owner voient le total des jours d’absence prévisionnels de l’année en cours pour les ressources actuellement filtrées.
- Le total déduplique les couples ressource/date afin d’éviter le double comptage en cas de chevauchement.
