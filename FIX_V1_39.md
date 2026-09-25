# V1.39 — affichage « Voir comme »

Correction ciblée après validation du démarrage V1.38.

Le problème : `loadManagerContext()` quittait immédiatement pour un Owner (`S.isOwner`).
Or l'utilisateur qui configure/teste le portail peut être Owner ET être présent comme Manager
dans `Managers_Ressources`.

V1.39 :
- ne désactive plus le mode Manager pour Owner ;
- si `S.person` existe, utilise son id Ressources ;
- si Owner a `S.person=null`, retrouve sa ligne Ressources par son email ADMIN_PORTAIL ;
- lit ensuite les affectations actives `Managers_Ressources`;
- affiche « Voir comme » uniquement s'il existe au moins une ressource affectée et visible ;
- aucune création de table ;
- aucun changement du boot V1.38 ;
- mode « Voir comme » toujours en lecture seule.
