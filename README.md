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

Le lien **Administration du site** dans le pied de page ouvre `/admin/`.
L’éditeur de contenu est préparé avec **Pages CMS** et `.pages.yml`. Son activation
nécessite encore l’autorisation de l’application GitHub sur **Durstyone/Hippocampes uniquement**.
Après activation, enregistrer un contenu dans l’éditeur crée une modification GitHub
et déclenche automatiquement la publication. Aucun jeton n’est placé dans le site.

Le bouton **Espace club** renvoie à l’administration associative existante, avec
ses accès actuels. Les adhérents, inscriptions, finances et documents privés
restent sur ce serveur distinct. Ses publications ne sont pas synchronisées
automatiquement avec le dépôt public.

Voir [le guide d’administration](docs/ADMINISTRATION.md).

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
