# V1.30 — Initialisation des libellés visible

Dans Administration > Libellés de l’application :
- le bloc « Table des libellés » est désormais toujours visible ;
- si PARAM_LIBELLES n’existe pas, bouton « Initialiser la table » ;
- si elle existe, état visible + bouton « Compléter / vérifier la table » ;
- l’action crée la table et ajoute seulement les clés manquantes ;
- les personnalisations existantes ne sont pas supprimées ;
- message explicite si le compte Grist n’a pas le droit de créer/modifier la table.
