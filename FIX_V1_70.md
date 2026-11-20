# V1.70 — Couleur personnalisable des motifs de présence

## Administration
Dans `Administration > Correspondance présence`, chaque motif RH dispose maintenant d'un sélecteur de couleur.

La couleur est stockée dans la colonne `Couleur` de `PARAM_MOTIFS_PRESENCE` au format hexadécimal (`#RRGGBB`).
Le bouton `Défaut` remet la couleur standard correspondant au type de présence.

## Planning
La couleur personnalisée est utilisée dans le planning global et le calendrier annuel uniquement quand l'utilisateur a le droit de voir le détail du motif :
- collaborateur : sa propre ligne ;
- manager : ses ressources ;
- admin / owner : toutes les ressources visibles.

Pour les autres lignes, la couleur générique `P`, `A` ou `AP` est conservée afin de ne pas révéler indirectement le motif.

## Migration
Le bouton `Initialiser / compléter la table` ajoute automatiquement la colonne `Couleur` à `PARAM_MOTIFS_PRESENCE` si elle n'existe pas.
