# V1.53 — Planning présence

- Ajout de l’onglet **Planning présence** dans « Mon espace ».
- Vue roulante sur 15 jours, lecture seule, navigation par fenêtres de 15 jours et bouton « Aujourd’hui ».
- Filtres par équipe et recherche de ressource.
- Présentation cohérente avec le module Demandes RH (P / TL / A / WE).
- Ajout de la table esclave **PLANNING_PRESENCE** côté document Demande RH.
- La table est conçue pour être alimentée par la synchronisation Cockpit RH ; le widget ne modifie jamais les présences.

## Schéma PLANNING_PRESENCE

- Ressource (Ref:Ressources)
- Date (Date)
- Statut (Text : P, TL, A, WE ou valeur source compatible)
- Libelle (Text)
- Motif_Code (Text)
- Equipe_Code (Text)
- Source_Feuille_ID (Int)
- Derniere_Sync (DateTime)
- Erreur_Sync (Text)

> La synchronisation externe devra faire le rapprochement Ressource via l'identifiant stable / e-mail puis écrire l'id local de Ressources.
