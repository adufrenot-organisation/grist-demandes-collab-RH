# V1.13 — Séparation des demandes ADMIN

Pour `Ressources.Profil = ADMIN` :
- **Mes demandes** : uniquement les demandes de l'ADMIN connecté.
- **Autres demandes** : uniquement les demandes dont le demandeur est différent de l'ADMIN connecté.
- Les demandes personnelles ne sont donc jamais dupliquées dans « Autres demandes ».

Pour PMO, MANAGER et autres profils :
- « Autres demandes » est masqué.
- « Mes demandes » reste limité aux demandes personnelles.

Les ACL Grist restent l'autorité de sécurité. Elles doivent autoriser ADMIN à lire toutes les demandes et limiter les autres profils à leurs propres lignes.
