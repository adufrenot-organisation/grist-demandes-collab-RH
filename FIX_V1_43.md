# V1.43 — correction réelle de la zone Affectations

Cause identifiée :
les V1.41/V1.42 ciblaient `#managerForm`, alors que le HTML réel utilise
`class="manager-form"`. Les règles ne pouvaient donc pas agir sur le formulaire.

V1.43 cible le DOM réel :
- suppression du grand vide entre Configuration et Affectation ;
- Manager / Ressource / Affecter alignés dans la carte avec marges internes ;
- bouton Affecter décollé des bords ;
- tableau immédiatement sous le formulaire ;
- cellules du tableau réalignées avec le formulaire ;
- responsive tablette/mobile ;
- aucune modification fonctionnelle.
