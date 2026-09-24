# V1.28 — correction réelle de l'accordéon
Cause trouvée dans le HTML réel :
- `Autres demandes` utilise `data-view="all"` et non `data-view="others"`.
- Il n'avait donc jamais reçu la classe `accordion-space`.

Correction :
- `Autres demandes` est maintenant explicitement membre de MON ESPACE.
- Quand ADMINISTRATION est ouverte, `Autres demandes` est forcé masqué.
- Quand MON ESPACE est ouvert, il réapparaît uniquement si les règles ADMIN l'autorisent.
- Aucun changement du design V1.26/V1.27.
