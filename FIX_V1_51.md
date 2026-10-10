# V1.51 — Mode diagnostic d’identification

- Ajoute Administration > Diagnostic, réservé à l’Owner.
- Activation persistante via localStorage (`rh_debug_enabled`).
- `?debug=1` permet aussi d’activer le diagnostic dès le démarrage.
- En cas d’erreur avant identification, un bouton permet d’afficher le diagnostic sur l’écran fatal.
- Le journal indique : version réellement chargée, ressources visibles, résultat de SESSION_IDENTITE, e-mail Grist obtenu, correspondance Ressources.Email, Owner/Admin détecté.
- Les secrets (token, clé API, authorization, password, secret) sont masqués dans le snapshot.

Important : cette version ne réintroduit aucun fallback d’identité par ressource/manager/PMO unique. L’identité reste strictement basée sur l’e-mail Grist obtenu par la sonde SESSION_IDENTITE.
