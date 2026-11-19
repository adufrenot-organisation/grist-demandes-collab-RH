# V1.67 — compteur annuel et visibilité des motifs du planning

- Le compteur `Absences prévisionnelles` couvre désormais toute l’année civile en cours, du 1er janvier au 31 décembre.
- Le calcul conserve un dédoublonnage par ressource + date pour éviter de compter deux fois des demandes qui se chevauchent.
- Les PMO, Admin et Owner conservent l’accès au compteur annuel selon le périmètre de ressources actuellement filtré.
- Détail des motifs dans le planning :
  - collaborateur : détail réel uniquement sur sa propre ligne ;
  - manager : détail réel sur sa propre ligne et sur les ressources qui lui sont affectées dans `Managers_Ressources` avec `Actif=true` ;
  - Admin / Owner : détail réel sur toutes les lignes visibles ;
  - autres lignes : uniquement la catégorie de présence (`Jour travaillé`, `Absence`, `Absence prévisionnelle`).
- La même règle de confidentialité s’applique aux absences prévisionnelles issues des demandes `EN_ATTENTE`.
