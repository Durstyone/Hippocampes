# Administrer le site des Hippocampes

## Les deux accès

Le pied de page du site contient **Administration du site**. Cette page propose :

- **L’éditeur du site**, pour les actualités, les photos, l’agenda, les coordonnées et les textes de présentation.
- **L’espace club**, qui conserve l’administration associative existante : adhérents, inscriptions, finances, matériel et documents privés.

Le bouton **Espace club** reste également accessible en haut du site. Les droits de cet espace ne sont pas modifiés. Ses publications ne mettent pas automatiquement à jour GitHub Pages.

## Accéder à l’éditeur

Pages CMS est activé depuis le **28 novembre 2026**, avec **Durstyone/Hippocampes** comme seul dépôt existant sélectionné. La configuration de l’éditeur est dans `.pages.yml`.

1. Cliquer sur **Ouvrir l’éditeur** pour accéder à [l’éditeur du site](https://app.pagescms.org/durstyone/hippocampes/main/file/site).
2. Si une connexion est demandée, utiliser le compte GitHub du club **Durstyone**.
3. Choisir la rubrique à modifier : **Actualités**, **Photos et albums** ou **Le site et l’agenda**. L’éditeur utilise le dépôt **Hippocampes**, branche **main**.

L’application est autorisée à modifier les fichiers et gérer les Actions de ce dépôt, à lire l’adresse email du compte et à créer des dépôts sur Durstyone. Ces permissions ont été explicitement approuvées lors de l’installation. Aucun mot de passe ni jeton GitHub n’est inclus dans le site.

## Publier une actualité

Dans **Actualités**, créer une entrée, renseigner le titre, la date, le résumé, le texte et, si souhaité, une photo de couverture. Le texte utilise des paragraphes séparés par une ligne vide. Enregistrer lance la publication du site.

Les articles sont enregistrés dans `github-pages/content/news/`. Leur nom de fichier sert d’identifiant et le renommage est désactivé pour conserver leurs liens. La collection commence vide : les trois récits historiques affichés sur l’accueil se modifient dans **Le site et l’agenda → Récits du blog mis en avant**. Les archives déjà reprises restent accessibles sur le site.

## Ajouter des photos à un album

Dans **Photos et albums**, ajouter une entrée par photo. Choisir l’image, donner un titre et une description, puis indiquer le même nom d’album pour les photos d’une même sortie. L’ordre permet d’organiser les photos dans l’album.

Les images sont conservées dans `public/images/publications/`. Les formats JPEG, PNG, WebP et GIF sont acceptés, dans la limite de **5 Mio par image**. Les dimensions sont détectées automatiquement. Cloudinary n’est pas nécessaire.

Les albums historiques déjà repris restent accessibles et les photos des actualités sont conservées.

La bibliothèque **Photos du site** contient le calendrier et les trois visuels d’accueil. Ces copies permettent de les sélectionner dans l’éditeur ; les originaux utilisés par les archives sont conservés. Importer les nouvelles images dans cette bibliothèque, puis les choisir avec **Select** dans le contenu concerné.

## Modifier les informations pratiques

Dans **Le site et l’agenda**, modifier les coordonnées, la saison, le programme, les événements, la présentation, les récits mis en avant ou les questions fréquentes.

## Modifier le planning

Le lien **L’agenda** ouvre [le calendrier du club](https://durstyone.github.io/Hippocampes/agenda/), avec une vue **Mois**, une vue **Agenda**, une recherche et des filtres par activité. L’accueil présente les deux créneaux habituels et les trois prochains événements du club, selon la date à Paris ; les jours fériés restent dans le calendrier complet.

Dans **Le site et l’agenda → Agenda**, ouvrir ou ajouter un événement :

- Renseigner le titre, le type d’activité et **Couleur et filtre du calendrier**.
- Indiquer la **Date de début**. Pour plusieurs jours, **Date de fin, jour inclus** correspond au dernier jour de l’événement ; la laisser vide pour une seule journée.
- Choisir **Prévu**, **Confirmé** ou **À confirmer**. Les dates rouges du programme d’origine restent **À confirmer** tant que le club ne les a pas validées.
- Saisir uniquement les heures connues, au format `HH:MM`, à l’heure de Paris. Une heure de fin est facultative. Si l’horaire reste inconnu, laisser les heures vides et préciser « Horaire à préciser ».
- Compléter la description, le lieu s’il est connu et, si disponible, le lien vers l’annonce du club.

Les créneaux habituels du mardi et du jeudi conservent une date vide : ils sont affichés comme repères, sans générer automatiquement des séances. Un jour férié n’indique pas à lui seul que le club est fermé. Les dates des événements doivent rester comprises dans les dates de la saison.

Le **planning d’origine** reste accessible en bas du calendrier. La reprise utilise [l’annonce de septembre 2026](https://les-hippocampes-du-robec.over-blog.com/2026/09/bonne-reprise-pour-notre-club-et-agenda-2026/2027.html), qui confirme notamment Conflans au **11 avril 2027** et l’AG du **17 octobre 2026 à 19 h 30**.

### Ajouter les dates à un agenda personnel

Un événement, le mois affiché ou toute la saison peuvent être téléchargés au format `.ics`, puis importés dans Google Agenda, Apple Calendrier ou Outlook. L’export du mois comprend toutes ses dates, même les catégories masquées à l’écran. Les créneaux sans date ne sont pas exportés ; sans horaire connu, le fichier conserve un repère à la journée.

Il s’agit d’un import ponctuel : les modifications ultérieures du site ne sont pas synchronisées automatiquement dans l’agenda personnel.

## Vérifier une publication

Après l’enregistrement, GitHub Actions contrôle les données et construit le site. Le lien **Suivre une publication** permet de voir sa progression. Une réussite du travail **deploy** confirme la mise en ligne ; en cas d’échec, la dernière version correctement déployée reste accessible. Corriger le contenu signalé puis enregistrer de nouveau.

## Données publiques et gestion du club

Le dépôt est public. Les textes et les images enregistrés dans l’éditeur sont donc visibles dans GitHub, même avant leur apparition sur le site. Les coordonnées des adhérents, les certificats, les paiements et les documents privés doivent rester dans l’espace club.

L’éditeur n’administre pas les permissions ni la base de l’espace club. L’accès au site privé n’accorde pas automatiquement le rôle d’administrateur au sein du club.

Références : [démarrage de Pages CMS](https://pagescms.org/docs/quick-start/), [configuration](https://pagescms.org/docs/configuration/), [médias](https://pagescms.org/docs/configuration/media/).
