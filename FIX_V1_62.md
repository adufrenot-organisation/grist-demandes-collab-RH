# V1.62 — demandes d’annulation d’absences acceptées

- Une demande acceptée/validée dont le motif est paramétré `ABSENCE` dans `PARAM_MOTIFS_PRESENCE` peut faire l’objet d’une demande d’annulation si la période comporte encore des dates non passées.
- L’utilisateur choisit une sous-période incluse dans la période d’origine, limitée aux dates à partir d’aujourd’hui.
- Une nouvelle ligne `Demandes_RH` est créée avec `Type=ANNULATION`, `Type_Action=ANNULATION` et `Demande_Origine` pointant vers la demande acceptée.
- La demande d’origine n’est pas modifiée : l’historique est conservé.
- Une seule demande d’annulation `EN_ATTENTE` peut être ouverte simultanément pour une demande d’origine.
- L’annulation directe reste réservée aux demandes `EN_ATTENTE` futures.
- Les demandes d’annulation en attente peuvent être annulées, mais pas modifiées comme une demande classique.
