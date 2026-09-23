# Synchronisation V1.9

Déclenchements :
1. ouverture du widget : synchronisation Cockpit → portail ;
2. création d'une demande : envoi immédiat vers Cockpit ;
3. modification d'une demande EN_ATTENTE : mise à jour immédiate dans Cockpit ;
4. annulation d'une demande EN_ATTENTE : envoi immédiat ;
5. bouton ↻ : synchronisation manuelle ;
6. bouton Actualiser existant : synchronisation puis rechargement.

Clé demandes : `UUID_Demande`.

Retour Cockpit → portail :
- Statut
- Manager_Email
- Commentaire_Manager
- Date_Decision

Catalogue Motifs_RH :
- jamais synchronisé ;
- rapprochement à l'envoi par `Motif_Code` → `Cockpit.Motifs_RH.Code`.

Ressources :
- Cockpit.Team MASTER ;
- Ressources SLAVE ;
- `UUID_Ressource` utilisé dès qu'il est présent côté Cockpit, avec compatibilité Email/Source_Team_ID.

L'interface affiche l'état et l'heure de la dernière synchronisation réussie.
La connexion cross-document reste soumise à la configuration et aux droits utilisateur ; aucune clé maître n'est embarquée.
