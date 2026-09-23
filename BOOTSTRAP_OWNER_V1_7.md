# Bootstrap Owner — V1.7

La V1.7 permet d'ouvrir Administration avant que les ACL Ressources soient configurées.

## Setup administrateur

Sur le poste administrateur, définir :

- GRIST_HOST
- GRIST_API_KEY
- DEMANDES_DOC_ID
- OWNER_EMAIL

Puis exécuter :

    python setup_demandes.py

Le setup crée `ADMIN_PORTAIL` et ajoute l'Owner :
- Email
- Nom
- Role = OWNER
- Actif = true

Le widget lit ce bootstrap avant de résoudre la Ressource. Ainsi, si les ACL Ressources
ne sont pas encore prêtes, l'Owner peut quand même accéder à ACL & Permissions.

## Sécurité

`ADMIN_PORTAIL` sert au bootstrap de l'interface, pas de remplacement aux ACL Grist.
Les opérations réellement privilégiées doivent rester protégées par Grist / un mécanisme
administrateur autorisé.

Pour plusieurs Owners, l'identité doit être reliée à un contexte d'authentification fiable ;
la V1.7 privilégie le cas bootstrap initial d'un Owner unique.
