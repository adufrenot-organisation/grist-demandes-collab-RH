# V1.11 — Visibilité globale ADMIN

Règle fonctionnelle :
- Profil ADMIN : ses demandes + toutes les demandes rendues visibles par les ACL Grist.
- PMO, MANAGER et autres profils : uniquement leurs propres demandes.
- Le tableau de bord et « Mes demandes » restent personnels, y compris pour ADMIN.
- Une vue « Toutes les demandes » apparaît uniquement pour Profil=ADMIN.
- La modification/annulation depuis le portail reste limitée aux propres demandes de l'utilisateur.

Important : le widget ne contourne jamais les ACL. Les ACL de `Demandes_RH` doivent autoriser le profil ADMIN à lire toutes les lignes, et les autres utilisateurs uniquement leurs lignes.
