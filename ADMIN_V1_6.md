# Administration V1.6

La navigation Administration est conçue pour être réservée au Owner.

## ACL & Permissions
Le Security Center distingue :
- audit/diagnostic ;
- application explicite après confirmation.

Important : l'API standard du Custom Widget ne doit pas être contournée pour modifier les ACL.
La V1.6 n'affirme donc pas appliquer des ACL qu'elle ne peut pas modifier de manière sûre.
Le bouton d'application reste désactivé tant qu'un mécanisme Owner sécurisé n'est pas branché.

Le setup Python reste l'outil administrateur local pour les opérations privilégiées.
