# V1.61 — Ordonnancement des menus Utilisateur / Mon espace

- Étend le paramétrage `PARAM_MENU_ORDRE` aux deux rubriques : `space` (Utilisateur / Mon espace) et `admin` (Administration).
- Ajoute la colonne `Section` à `PARAM_MENU_ORDRE`.
- Migration automatique : les anciennes lignes sans `Section` sont classées dans `admin`.
- Ajoute les menus utilisateur : Accueil, Nouvelle demande, Mes demandes, Planning présence, Autres demandes.
- Deux listes indépendantes dans Administration > Ordre des menus.
- Les droits et la visibilité conditionnelle des menus ne changent pas.
