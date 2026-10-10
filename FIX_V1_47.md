# V1.47 — correction d'identité Owner / PMO

## Problème corrigé

Le widget pouvait considérer n'importe quel utilisateur comme Owner lorsqu'`ADMIN_PORTAIL` ne contenait qu'un seul OWNER (ou qu'un `Owner_Email` était configuré globalement). Une PMO pouvait alors apparaître sous l'identité de l'Owner et accéder à « Autres demandes ».

## Correction

- L'identité courante est maintenant déterminée uniquement à partir des lignes `Ressources` réellement visibles via les ACL Grist.
- Si plusieurs ressources sont visibles pour un manager, `Managers_Ressources` sert à retrouver la ligne du manager.
- `ADMIN_PORTAIL` et `Owner_Email` ne servent plus à déterminer l'identité du connecté : ils servent uniquement à vérifier que l'utilisateur déjà identifié est bien l'Owner déclaré.
- En cas d'identité ambiguë, le rôle Owner n'est pas accordé.

## Résultat attendu

- Une PMO voit son propre compte et uniquement ses demandes dans « Mes demandes ».
- Un manager peut utiliser « Voir comme » pour ses ressources sans devenir Owner.
- L'accès Owner n'est accordé que si l'e-mail de la ressource identifiée correspond à l'OWNER déclaré.
