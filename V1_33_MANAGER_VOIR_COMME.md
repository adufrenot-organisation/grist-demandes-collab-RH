# V1.33 — Manager : Voir comme une ressource

- Table locale `Managers_Ressources` initialisable depuis Administration > Managers & Ressources.
- Owner affecte un manager à une ou plusieurs ressources.
- Un manager ayant des affectations voit un sélecteur `Voir comme`.
- `Moi-même` revient à son contexte normal.
- En sélectionnant une ressource, `Mes demandes`, les KPI et l'identité affichée utilisent le contexte de cette ressource.
- Le mode `Voir comme` est strictement en lecture seule : création, modification et annulation sont masquées et bloquées dans le JS.
- L'identité réelle du manager n'est jamais remplacée.
- Cette fonctionnalité suppose que les ACL Grist permettent au manager de lire les demandes des ressources qui lui sont affectées. Le widget ne contourne jamais les ACL Grist.
