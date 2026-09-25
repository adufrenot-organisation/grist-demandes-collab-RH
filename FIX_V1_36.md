# V1.36 — reconstruction depuis V1.32 stable

Les V1.33–V1.35 sont abandonnées car elles introduisaient un blocage avant la fin de l'identification.

Cette version repart de V1.32 validée.
Elle ajoute uniquement l'administration locale `Managers_Ressources`.
Aucun code Manager / Voir comme n'est exécuté pendant `boot()`, `identify()` ou `load()`.

Étape suivante après validation du démarrage : ajouter le mode Voir comme séparément.
