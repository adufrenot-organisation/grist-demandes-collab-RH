# RH Demandes Collaborateurs — V1.3

## Architecture corrigée

### Poste administrateur
`setup_demandes.py` est le seul script d'installation.
Il crée/complète les tables locales du document Demandes RH.
Il utilise une clé API administrateur uniquement au moment du setup.

### Poste utilisateur / navigateur
`app.js` est le widget Grist.
La synchronisation fonctionnelle est intégrée dans ce JavaScript :
- rafraîchissement Ressources depuis Cockpit,
- envoi création/modification d'une demande vers Cockpit,
- retour Statut / décision Manager vers la demande locale.

Il n'y a plus de `sync.js` Node à lancer.

## Sécurité importante
Aucune clé API maître n'est embarquée dans le ZIP.
Le navigateur ne doit disposer que des droits propres/minimaux de l'utilisateur.
La synchro cross-document nécessite donc que votre hébergement Grist/API/ACL autorise cet accès
avec l'identité utilisateur, ou qu'un proxy/SSO sécurisé fournisse cet accès.
Ne jamais injecter une clé d'administration commune dans `app.js`.

## Motifs
`Motifs_RH` reste local dans chaque document.
Aucune synchronisation de catalogue.
Le rapprochement lors de l'envoi d'une demande se fait par `Motif_Code` -> `Cockpit.Motifs_RH.Code`.
