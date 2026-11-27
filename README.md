# Les Hippocampes du Robec — site public

Sources du site du club pour le dépôt **Durstyone/Hippocampes** et GitHub Pages.
Ce compte et ce dépôt sont propres au club.

## Adresse et publication

L’adresse GitHub Pages prévue pour ce dépôt est `https://durstyone.github.io/Hippocampes/`.
Le dépôt est public et la source **Settings → Pages → Source : GitHub Actions**
est activée. L’adresse devient utilisable après la réussite du déploiement.
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

Pour conserver une nouvelle photo d’actualité : ajouter le fichier dans
`public/images/`, déclarer `/images/nom-du-fichier.jpg` dans `github-pages/local-media.json`,
puis utiliser ce chemin dans l’actualité. Cette liste autorise des images, jamais des vidéos.

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

La construction de production accepte les images locales déclarées et vérifiées.
Une URL externe n’est nécessaire que pour un média qui n’est pas déclaré local.
Le résultat destiné à Pages est `outputs/hippocampes-github-pages/www/`.

Voir [le guide complet](docs/GITHUB-PAGES.md) pour les médias, la publication
et l’ajout éventuel d’un nom de domaine.
