# V1.49 — identité technique anon / PMO

- `anon@getgrist.com` est traité comme une identité technique du token Custom Widget et n'est plus utilisé comme identité utilisateur.
- Le module retombe alors sur les mécanismes locaux d'identification.
- Si plusieurs Ressources sont visibles et qu'aucun manager unique n'est identifiable, une Ressource avec `Profil = PMO` est utilisée uniquement si elle est unique parmi les Ressources visibles.
- `Mes demandes` reste filtré sur l'id local de cette Ressource.
- Le numéro de version visible reste en blanc dans la barre latérale.

Les ACL Grist restent l'autorité de sécurité : le filtrage du widget ne remplace pas les règles d'accès du document.
