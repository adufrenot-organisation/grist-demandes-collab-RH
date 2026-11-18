# V1.66 — Administration de la synchronisation

- Ajoute **Paramètres de synchro** dans Administration pour gérer `PARAM_SYNCHRO`.
- Ajoute **Demandes de synchro** pour gérer `DEMANDES_SYNCHRO`.
- Permet de modifier les valeurs des paramètres sans changer les clés.
- Permet de demander une synchronisation manuelle sur une période.
- Bouton **Toute l’année en cours** : 01/01 → 31/12 avec `Force_Full=true`.
- Historique des demandes avec statut, compteurs et message de résultat.
- Les deux tables peuvent être initialisées/complétées depuis l’écran si elles sont absentes.
- La création d’une ligne `EN_ATTENTE` ne remplace pas le backend : le service `rh-sync` doit être adapté pour consommer `DEMANDES_SYNCHRO`.
