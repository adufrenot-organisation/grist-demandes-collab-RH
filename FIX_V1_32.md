# V1.32 — Deux « Mes demandes » indépendants

Les deux textes identiques ont désormais des clés explicites distinctes :
- `page.mine` = grand titre d'en-tête en haut de l'écran ;
- `mine.title` = titre de la section de suivi.

Modifier l'un dans PARAM_LIBELLES ne modifie plus l'autre.
Les hooks `data-label-key` évitent désormais l'ambiguïté liée à deux textes par défaut identiques.
