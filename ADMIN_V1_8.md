# Administration V1.8

## Motifs RH
CRUD local dans le widget Owner :
- création ;
- modification ;
- activation / désactivation ;
- contrôle Code obligatoire et unique.

Aucune synchronisation du catalogue Motifs_RH avec le Cockpit.
Le rapprochement d'une demande utilise uniquement `Code`.

## Ressources
`Cockpit.Team` reste MASTER.
`Demandes.Ressources` reste SLAVE.

L'Admin Ressources est donc une console de lecture/diagnostic et de synchronisation :
- aucune création locale ;
- aucune modification locale ;
- anomalies visibles ;
- bouton Synchroniser.

Le setup V1.8 ajoute `UUID_Ressource`, `Derniere_Sync` et `Erreur_Sync` à Ressources.
La migration vers UUID_Ressource comme clé principale de synchronisation pourra être activée
dès que Cockpit.Team possède lui aussi cette colonne de manière stable.
