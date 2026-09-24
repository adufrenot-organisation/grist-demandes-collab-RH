# V1.23 — correction réelle de la version
Le défaut venait de `styles.css` : la règle historique `.version{position:absolute;bottom:20px...}`
continuait à forcer la version en bas. Les précédents correctifs avaient surtout modifié `index.html`.

V1.23 :
- neutralise cette règle dans `styles.css` ;
- force V1.23 en haut à droite du bloc logo ;
- compacte les vrais éléments `.nav` du DOM ;
- remonte les sections et réduit légèrement la police ;
- rend la sidebar elle-même scrollable si la hauteur reste insuffisante.
