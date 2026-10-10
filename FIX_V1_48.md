# V1.48 — identité réelle Grist / PMO

## Problème corrigé
Une PMO pouvait être assimilée à l'Owner lorsque `ADMIN_PORTAIL` ne contenait qu'un seul OWNER, ou l'identification échouait lorsque plusieurs lignes `Ressources` étaient visibles.

## Correction
- l'identité est recherchée à partir de la session Grist courante (e-mail) via les API de session/profil disponibles ;
- la ligne `Ressources` est ensuite rapprochée par `Email` ;
- `ADMIN_PORTAIL` ne sert plus à fabriquer l'identité : le rôle OWNER n'est activé que si l'e-mail de la session correspond à un OWNER actif ;
- une seule ligne OWNER dans `ADMIN_PORTAIL` ne suffit plus à accorder les droits Owner ;
- les fallbacks historiques (une seule ressource visible, manager unique) restent disponibles si l'API de session ne fournit pas l'e-mail.

## Sécurité
L'identité et le périmètre de visibilité sont désormais séparés : voir plusieurs ressources ne change pas l'identité de la personne connectée.
