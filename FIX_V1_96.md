# V1.96 — Valeurs par défaut de l’import OCR

- Le type par défaut est désormais **PRESENCE**.
- Ajout d’un **Motif RH par défaut** dans Administration > Paramètres import congés.
- Les valeurs par défaut sont stockées dans `PARAM_IMPORT_CONGES` via une ligne technique `Code_Import=__DEFAUT__`.
- Cette ligne n’apparaît pas dans la liste des codes OCR.
- Les nouveaux codes héritent du type et du motif par défaut.
- Si une correspondance OCR ne possède pas de motif spécifique, le motif par défaut est utilisé comme secours.
- Les correspondances explicites restent prioritaires.
