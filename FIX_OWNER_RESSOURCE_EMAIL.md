# Correctif Owner / Ressource par e-mail

## Problème

Un Owner pouvait être correctement identifié via `ADMIN_PORTAIL` tout en gardant `S.person = null` lorsqu'il avait accès à plusieurs lignes de `Ressources`.
La création d'une demande utilisait ensuite `S.person.id`, ce qui provoquait :

`Cannot read properties of null (reading 'id')`

## Correctif

- Lors de `identify()`, un Owner est maintenant rapproché de sa ligne `Ressources` par l'adresse e-mail du bootstrap `ADMIN_PORTAIL`.
- L'identifiant Grist local de cette ressource est ensuite utilisé pour la référence `Demandeur`.
- `save()` vérifie explicitement que `S.person` existe avant de créer une demande et affiche un message explicite sinon.

## Principe

L'e-mail sert de clé de correspondance entre documents. Les `id` Grist restent des identifiants locaux propres à chaque document.
