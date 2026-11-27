# Administrer le site des Hippocampes

## Les deux accès

Le pied de page du site contient **Administration du site**. Cette page propose :

- **L’éditeur du site**, pour les actualités, les photos, l’agenda, les coordonnées et les textes de présentation.
- **L’espace club**, qui conserve l’administration associative existante : adhérents, inscriptions, finances, matériel et documents privés.

Le bouton **Espace club** reste également accessible en haut du site. Les droits de cet espace ne sont pas modifiés. Ses publications ne mettent pas automatiquement à jour GitHub Pages.

## Première activation de l’éditeur

La configuration `.pages.yml` est prête, mais l’autorisation de Pages CMS reste à effectuer.

1. Ouvrir `https://app.pagescms.org/` depuis **Se connecter à l’éditeur**.
2. Utiliser le compte GitHub du club **Durstyone**.
3. Autoriser l’application uniquement pour **Durstyone/Hippocampes**, après lecture des permissions affichées. Ne pas sélectionner tous les dépôts.
4. Ouvrir le dépôt **Hippocampes**, branche **main**. Les rubriques configurées sont Actualités, Photos et albums, Le site et l’agenda.

Cette étape autorise un outil à modifier les fichiers du dépôt. Aucune autorisation n’a été accordée par l’ajout des sources. Aucun mot de passe ni jeton GitHub n’est inclus dans le site.

## Publier une actualité

Dans **Actualités**, créer une entrée, renseigner le titre, la date, le résumé, le texte et, si souhaité, une photo de couverture. Le texte utilise des paragraphes séparés par une ligne vide. Enregistrer lance la publication du site.

Les articles sont enregistrés dans `github-pages/content/news/`. Leur nom de fichier sert d’identifiant et le renommage est désactivé pour conserver leurs liens. Les anciennes actualités sont toujours prises en charge.

## Ajouter des photos à un album

Dans **Photos et albums**, ajouter une entrée par photo. Choisir l’image, donner un titre et une description, puis indiquer le même nom d’album pour les photos d’une même sortie. L’ordre permet d’organiser les photos dans l’album.

Les images sont conservées dans `public/images/publications/`. Les formats JPEG, PNG, WebP et GIF sont acceptés, dans la limite de **5 Mio par image**. Les dimensions sont détectées automatiquement. Cloudinary n’est pas nécessaire.

Les albums historiques déjà repris restent accessibles et les photos des actualités sont conservées.

## Modifier les informations pratiques

Dans **Le site et l’agenda**, modifier les coordonnées, la saison, le programme, les événements, la présentation, les récits mis en avant ou les questions fréquentes. Pour un événement daté, le site propose un fichier calendrier correspondant à cette date. Un rendez-vous sans date précise propose de contacter le club.

## Vérifier une publication

Après l’enregistrement, GitHub Actions contrôle les données et construit le site. Le lien **Suivre une publication** permet de voir sa progression. Une réussite du travail **deploy** confirme la mise en ligne ; en cas d’échec, la dernière version correctement déployée reste accessible. Corriger le contenu signalé puis enregistrer de nouveau.

## Données publiques et gestion du club

Le dépôt est public. Les textes et les images enregistrés dans l’éditeur sont donc visibles dans GitHub, même avant leur apparition sur le site. Les coordonnées des adhérents, les certificats, les paiements et les documents privés doivent rester dans l’espace club.

L’éditeur n’administre pas les permissions ni la base de l’espace club. L’accès au site privé n’accorde pas automatiquement le rôle d’administrateur au sein du club.

Références : [démarrage de Pages CMS](https://pagescms.org/docs/quick-start/), [configuration](https://pagescms.org/docs/configuration/), [médias](https://pagescms.org/docs/configuration/media/).
