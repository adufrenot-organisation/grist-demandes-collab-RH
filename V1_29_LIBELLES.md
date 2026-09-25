# V1.29 — Administration des libellés

Nouvelle entrée Administration > Libellés de l’application.

- Accessible à un profil fonctionnel ADMIN ou au Owner.
- Stockage local dans la table Grist `PARAM_LIBELLES`.
- Initialisation depuis le widget si la table n’existe pas.
- Modification unitaire, recherche, retour au défaut et réinitialisation globale.
- Les clés techniques restent stables : seules les valeurs affichées changent.
- Fallback automatique sur les libellés d’origine.
- Aucun partage de clé API et aucune synchronisation avec le Cockpit.
- Les écrans Ressources / Motifs / ACL restent réservés au Owner comme auparavant.
