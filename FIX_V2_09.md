# V2.09 — Auto-validation basée explicitement sur Ressources.Type

- La détection Interne/Externe utilise désormais exclusivement `Ressources.Type`.
- `Type = Interne` => `Demandes_RH.AutoValidation = true`.
- Toute autre valeur => `Demandes_RH.AutoValidation = false`.
- La propagation de `AutoValidation` vers Cockpit reste inchangée.
- Aucun autre comportement métier n’est modifié.
