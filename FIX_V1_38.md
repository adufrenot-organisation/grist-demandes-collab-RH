# V1.38 — correction identification Manager

Cette version repart du ZIP Grist complet fourni par l'utilisateur.

## Correction principale
L'ancien démarrage imposait exactement une ligne visible dans `Ressources`.
Cela bloque un manager dès que les ACL lui permettent de voir sa propre ligne
et celles de ses ressources.

V1.38 :
- conserve le comportement historique si une seule ressource est visible ;
- si plusieurs ressources sont visibles, lit `Managers_Ressources` ;
- identifie le manager par l'unique `Manager` actif présent parmi les ressources visibles ;
- charge ensuite normalement le portail ;
- le mode `Voir comme` reste post-démarrage et en lecture seule ;
- aucune table n'est créée automatiquement ;
- les ACL Grist restent la sécurité réelle.

## Schéma attendu
`Managers_Ressources`
- `Manager` : Ref:Ressources
- `Ressource` : Ref:Ressources
- `Actif` : Bool

## Autre correction
Correction de la virgule manquante dans le catalogue `LABEL_DEFS` autour des
libellés Managers & Ressources.
