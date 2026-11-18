# V1.54 — Restitution du planning via la correspondance des motifs

- Le planning ne restitue plus directement les statuts techniques de `PLANNING_PRESENCE.Statut`.
- Pour chaque ligne synchronisée, `Motif_Code` est rapproché de `Motifs_RH.Code`.
- La ligne correspondante de `PARAM_MOTIFS_PRESENCE` détermine l’affichage :
  - `JOUR_TRAVAILLE` → `P` (Jour travaillé)
  - `ABSENCE` → `A` (Absence)
  - `AUCUN_IMPACT` → aucun indicateur
  - motif absent/non configuré/inactif → aucun indicateur
- La légende du planning est simplifiée à Jour travaillé / Absence.
- La table `PLANNING_PRESENCE` reste une table esclave alimentée par la synchronisation Cockpit RH.
