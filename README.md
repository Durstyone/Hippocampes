# Les Hippocampes du Robec — site public

Sources du site du club pour le dépôt **Durstyone/Hippocampes** et GitHub Pages.
Ce compte et ce dépôt sont propres au club.

## Adresse et publication

L’adresse du site publié est `https://durstyone.github.io/Hippocampes/`.
Le dépôt est public et la source **Settings → Pages → Source : GitHub Actions**
est activée. Le premier déploiement public a été vérifié le 27 novembre 2026.
Un nom de domaine payant est facultatif.

Le workflow vérifie le code, les images et les fichiers construits, puis publie le
site. Il faut vérifier la réussite de l’étape de déploiement dans **Actions** :
un contrôle de code réussi ne signifie pas, à lui seul, que le site est en ligne.

## Publication provisoire sans Cloudinary

Les **123 fichiers d’images récupérés**, soit **8 534 026 octets (environ 8,53 Mo)**,
sont conservés dans `public/` et déclarés dans `github-pages/local-media.json`.
GitHub Pages sert provisoirement ces images, y compris le fond du site, les albums
et les **7 fichiers des actualités et articles illustrés déjà repris**.
La publication de cette version ne demande aucun compte Cloudinary ni URL média externe.

Les nouvelles photos déposées par l’éditeur sont conservées dans
`public/images/publications/` et reconnues automatiquement par la publication.
JPG, JPEG, PNG, WebP et GIF sont acceptés jusqu’à 5 Mio par image.
Les images historiques continuent d’utiliser la liste locale existante.

Cloudinary reste une option pour la suite. Une migration consiste à importer les
images choisies, vérifier leurs URL HTTPS, renseigner `mediaMap` dans
`github-pages/site.config.json`, puis retirer **ces seuls chemins** de la liste
locale. Une image présente dans cette liste reste prioritairement servie par
GitHub Pages. Les 7 fichiers des actualités peuvent ainsi rester locaux pendant
que les autres images sont déplacées. Voir le guide avant de supprimer les copies
du dépôt. Les vidéos éventuelles restent hébergées séparément.

## Contenus et mises à jour

- Les 140 contenus d’archives déjà repris : 121 articles, 14 pages et 5 albums.
- Les archives dans `public/content/`.
- Les actualités de l’éditeur dans `github-pages/content/news/`.
- Les photos des nouveaux albums dans `github-pages/content/photos/`.
- La présentation, les coordonnées et l’agenda dans `github-pages/content/site-settings.json`.
- Les anciens fichiers `public-club.json` et `public-media.json` restent compatibles.
- Les documents publics PDF et le calendrier ICS dans `public/media/archive/`.

La reprise du blog reste partielle. Les images anciennes qui n’avaient pas pu être
récupérées restent des liens vers leur source.

## Administration

L’[administration intégrée](https://durstyone.github.io/Hippocampes/admin/) propose des formulaires pour les actualités, les photos, le calendrier, les documents et les informations du club. Les contenus publics sont conservés dans **Durstyone/Hippocampes** et publiés par GitHub Actions.

Les fiches adhérents et les pièces privées utilisent le dépôt **privé Durstyone/Hippocampes-prive**, jamais le dossier de publication de ce dépôt. L’accès est vérifié par GitHub à chaque opération privée. **Accès et droits** permet au propriétaire de gérer les collaborateurs et les invitations par dépôt ; aucun rôle fin par rubrique n’est simulé.

La page [Documents](https://durstyone.github.io/Hippocampes/documents/) donne directement accès au dossier d’adhésion vierge 2026–2027, au règlement, aux statuts et à la documentation TIV. Les nouveaux PDF publics sont conservés dans `public/documents/fichiers/` et leurs fiches dans `github-pages/content/documents/`.

La connexion de l’éditeur utilise un jeton en mémoire dans l’onglet. Le propriétaire peut utiliser un jeton à accès fin limité aux deux dépôts ; les collaborateurs d’un dépôt personnel utilisent un jeton classique dont la portée est plus large. Les permissions et les limites sont détaillées dans le [guide d’administration](docs/ADMINISTRATION.md). Pages CMS reste disponible pour les collections configurées dans `.pages.yml`.

Les liens **Voir le site** et **Retour au site** ouvrent toujours le site public GitHub Pages. Le site et les données du club restent indépendants de tout projet professionnel.

## Construction locale

Avec Node.js 24 :

```sh
npm ci
npm run typecheck
node scripts/check-pages-media-config.mjs
npm run build
npm run check
```

La construction de production accepte les images locales déclarées et vérifiées.
Une URL externe n’est nécessaire que pour un média qui n’est pas déclaré local.
Le résultat destiné à Pages est `outputs/hippocampes-github-pages/www/`.

Voir [le guide complet](docs/GITHUB-PAGES.md) pour les médias, la publication
et l’ajout éventuel d’un nom de domaine.
