# V1.37 — Managers & Ressources sur table existante

- Base reconstruite depuis le contenu V1.36 lui-même issu de V1.32.
- Suppression totale de la création automatique de `Managers_Ressources`.
- La table doit déjà exister avec `Manager` (Ref:Ressources), `Ressource` (Ref:Ressources), `Actif` (Bool).
- Administration Owner : affecter / retirer des ressources dans la table existante.
- Chargement du contexte Manager uniquement après le démarrage normal du portail.
- Une erreur d'accès à `Managers_Ressources` ne bloque pas l'identification.
- `Voir comme` est en lecture seule : aucune création, modification ou annulation de demande.
- Le manager ne peut sélectionner que les ressources qui lui sont affectées avec `Actif=true`.
- Les ACL Grist restent autoritaires : le widget n'affiche que les demandes réellement lisibles par le manager.
