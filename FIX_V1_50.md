# V1.50 — identité = e-mail réel du compte Grist

La V1.50 supprime tous les fallbacks d'identification par visibilité :
- pas de « ressource unique » ;
- pas de « manager unique » ;
- pas de « PMO unique » ;
- `anon@getgrist.com` n'est jamais utilisé comme identité.

## Principe

Le Custom Widget crée une ligne temporaire dans `SESSION_IDENTITE`.
Les colonnes `Email` et `Nom` sont des **trigger formulas** évaluées par Grist :

- `Email` : `user.Email`
- `Nom` : `user.Name`
- application aux nouveaux enregistrements

Le widget lit ensuite cet e-mail, recherche exactement `Ressources.Email`, puis supprime la ligne temporaire.

Ainsi :

`compte Grist connecté -> user.Email -> Ressources.Email -> S.person`

La table `SESSION_IDENTITE` est créée automatiquement si les droits du compte le permettent. Si le compte ne peut pas modifier le schéma, un administrateur doit ouvrir le module une première fois (ou créer la table manuellement).
