# Les Hippocampes du Robec — site public

Sources du site du club pour le dépôt **Durstyone/Hippocampes** et GitHub Pages.
Ce compte et ce dépôt sont propres au club.

## Adresse et publication

L’adresse GitHub Pages prévue pour ce dépôt est `https://durstyone.github.io/Hippocampes/`.
Elle devient utilisable après activation de Pages et réussite d’une publication.
Un nom de domaine payant est facultatif. Avec GitHub Free, le dépôt doit être public
pour activer Pages ; choisir **Settings → Pages → Source : GitHub Actions**.

Le workflow vérifie le code puis les médias. Tant que les URL externes requises
ne sont pas renseignées, il indique **Publication en attente des médias** et ne
lance aucun déploiement. Un contrôle de code réussi ne signifie pas que le site est en ligne.

## Photos des actualités conservées

Les **7 fichiers d’images actuellement utilisés par les actualités et les articles
illustrés déjà repris** sont conservés dans `public/`, soit environ 1 Mo. Leurs
chemins sont déclarés dans `github-pages/local-media.json`. Ils restent servis par
GitHub Pages, même lorsqu’un hébergement externe est configuré pour les autres médias.

Pour conserver une nouvelle photo d’actualité : ajouter le fichier dans
`public/images/`, déclarer `/images/nom-du-fichier.jpg` dans `github-pages/local-media.json`,
puis utiliser ce chemin dans l’actualité. Cette liste autorise des images, jamais des vidéos.

Les **116 autres chemins de médias** sont destinés à Cloudinary ou à l’hébergement
média choisi. Ils ne sont pas copiés dans le dépôt. Leur inventaire reste dans
`github-pages/media-inventory.json`, avec celui des images locales. Renseigner les
URL HTTPS obtenues dans `mediaMap` de `github-pages/site.config.json`, ou une base
`mediaBaseUrl` qui conserve exactement les chemins existants.

## Contenus et mises à jour

- Les 140 contenus d’archives déjà repris : 121 articles, 14 pages et 5 albums.
- Les archives dans `public/content/`.
- Les nouvelles actualités dans `github-pages/content/public-club.json`.
- Les albums supplémentaires dans `github-pages/content/public-media.json`.
- Les documents publics PDF et le calendrier ICS dans `public/media/archive/`.

La reprise du blog reste partielle. Les images anciennes qui n’avaient pas pu être
récupérées restent des liens vers leur source.

Les comptes adhérents, inscriptions, administration et documents privés demandent
un serveur distinct. `clubUrl` peut fournir un lien vers cet espace lorsqu’il est
ouvert. Les publications de ce serveur ne sont pas synchronisées automatiquement
avec les fichiers publics du dépôt.

## Construction locale

Avec Node.js 24 :

```sh
npm ci
npm run typecheck
node scripts/check-pages-media-config.mjs
npm run build
npm run check
```

La construction de production exige la configuration complète des médias externes.
Le résultat destiné à Pages est `outputs/hippocampes-github-pages/www/`.

Voir [le guide complet](docs/GITHUB-PAGES.md) pour les médias, la publication
et l’ajout éventuel d’un nom de domaine.
