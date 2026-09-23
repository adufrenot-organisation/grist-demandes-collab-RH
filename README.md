# RH Demandes Collaborateurs — V1.5

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


## Correctif V1.5 — identité Grist

`grist.getUser()` a été supprimé : cette fonction n'existe pas dans l'API officielle du Custom Widget.

Résolution de l'identité :
1. option widget `Email_Connexion` si elle est définie ;
2. sinon, si les Access Rules Grist ne rendent visible qu'une seule ligne active dans `Ressources`, cette ligne est utilisée.

La méthode recommandée est de filtrer `Ressources` par Access Rules avec l'identité Grist
(`user.Email == rec.Email`). Ainsi le widget ne choisit jamais librement un autre collaborateur.

La documentation officielle expose notamment `grist.getOptions()`, `grist.docApi.fetchTable()`
et `grist.docApi.getAccessToken()`, mais pas `grist.getUser()`.


## V1.5 — identité pilotée par ACL

L'option `Email_Connexion` est supprimée.
Le widget ne demande et ne choisit aucun email.

`Ressources` doit être filtrée par les Access Rules Grist. Pour un collaborateur connecté,
le widget exige exactement une Ressource active visible. Cette ligne devient son identité métier.

Voir `REGLES_ACCES_V1_5.md`.

Attention : la synchronisation cross-document depuis le navigateur reste soumise aux droits
réels accordés par Grist au collaborateur. Aucune clé administrateur n'est intégrée au widget.
