# Permissions avancées Grist — V1.5

Objectif : le navigateur ne choisit jamais l'identité du collaborateur.
C'est Grist qui filtre les données avant qu'elles n'arrivent au widget.

## Ressources
Créer une règle pour les utilisateurs collaborateurs :

Condition :
    user.Email == rec.Email

Autoriser la lecture de leur propre ligne.
Refuser la lecture des autres lignes aux collaborateurs.

Les comptes/service utilisés pour l'administration ou la synchronisation doivent être traités
par une règle séparée selon votre organisation des accès.

## Demandes_RH
Le principe est identique : un collaborateur ne doit accéder qu'aux demandes dont le Demandeur
correspond à sa Ressource.

Selon les colonnes/références disponibles dans votre document, la condition doit comparer
l'email de la Ressource référencée par Demandeur avec user.Email.

Exemple conceptuel :
    rec.Demandeur.Email == user.Email

Autoriser au collaborateur :
- lecture de ses demandes ;
- création ;
- modification des champs collaborateur uniquement lorsque Statut == EN_ATTENTE.

Ne pas lui donner le droit de modifier :
- décision manager ;
- commentaire manager ;
- date de décision.

## Important
Les règles exactes doivent être validées dans l'éditeur de règles Grist de votre version.
Le widget V1.5 ne contient plus d'option Email_Connexion et n'essaie plus d'identifier
l'utilisateur par une fonction JavaScript inexistante.
