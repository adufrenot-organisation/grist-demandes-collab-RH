# V2.08 — Auto-validation des demandes internes

- `AutoValidation` est calculé à partir de `Ressources.Profil_interne_externe` (fallback `Type`).
- Une ressource `Interne` produit `AutoValidation=true`; les autres `false`.
- La règle s’applique aux demandes classiques, aux demandes créées par import OCR et aux demandes d’annulation.
- `syncRequestToCockpit()` transmet désormais `AutoValidation` au Cockpit.
- Une modification de demande recalcule également le booléen à partir du demandeur réel.
- RH-SYNC V3.10 reste inchangé.
