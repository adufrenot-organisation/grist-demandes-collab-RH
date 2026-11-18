# V1.59 — Dates des demandes et annulation avant début

- Les listes affichent désormais séparément **Date début** et **Date fin**.
- Une demande peut être annulée tant que sa date de début est aujourd'hui ou dans le futur.
- Les statuts `ANNULEE` et `REFUSEE` ne sont pas annulables.
- La modification reste réservée aux demandes `EN_ATTENTE`.
- Lors d'une annulation, le statut `ANNULEE` est maintenant envoyé au Cockpit même si la demande distante existe déjà.
- Une confirmation rappelle le motif et la période avant annulation.
