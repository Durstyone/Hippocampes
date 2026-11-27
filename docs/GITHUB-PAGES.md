# Publier le site du club sur GitHub Pages

Cette cible publie la vitrine, les actualités publiques et les archives déjà reprises du blog. À la demande du club, **les 123 fichiers d’images récupérés sont provisoirement hébergés avec le site sur GitHub Pages**, soit 8 534 026 octets (environ 8,53 Mo). Cloudinary n’est pas nécessaire pour cette publication.

Le dépôt public est **Durstyone/Hippocampes**, avec **GitHub Actions** comme source Pages. L’adresse prévue est `https://durstyone.github.io/Hippocampes/`. Elle devient accessible après la réussite du déploiement. Ce compte et ce dépôt sont réservés au club.

## Ce qui fonctionne sur Pages

| Élément | Hébergement et mise à jour |
| --- | --- |
| Présentation, activités, agenda de saison, contact | Fichiers du site sur GitHub Pages. Le contact prépare un e-mail dans la messagerie du visiteur. |
| Archives importées, recherche et lecture | JSON et interface statique. Les 140 contenus repris comprennent 121 articles, 14 pages et 5 albums ; la reprise du blog reste partielle. |
| Actualités et albums publics supplémentaires | Copies publiques dans `github-pages/content/public-club.json` et `github-pages/content/public-media.json`. |
| Images des actualités, fond du site et albums récupérés | Images dans `public/`, déclarées dans `github-pages/local-media.json` et servies par GitHub Pages. |
| Vidéos éventuelles | Hébergement externe et liens HTTPS. Aucune vidéo locale n’est incluse dans cette version. |
| Comptes, inscriptions, administration et documents privés | Serveur distinct obligatoire. Un lien peut être ajouté avec `clubUrl`. |

GitHub Pages ne fait pas fonctionner le serveur Node, SQLite, D1 ou les API de l’espace club. Les versions Sites et autonome restent disponibles dans le projet d’origine. Les publications de leur administration ne sont **pas synchronisées automatiquement** avec la version Pages : les copies publiques doivent être mises à jour puis republiées.

Les anciennes images qui n’avaient pas pu être récupérées du blog restent des liens vers leur source.

## 1. Configuration actuelle

Les sources sont à la racine du dépôt, avec `package.json`, `package-lock.json` et `.github/workflows/pages.yml`. Dans GitHub, **Settings → Pages → Build and deployment → Source** est réglé sur **GitHub Actions**.

La configuration publique dans `github-pages/site.config.json` est :

```json
{
  "basePath": "/Hippocampes/",
  "domain": "",
  "mediaBaseUrl": "",
  "mediaMap": {},
  "clubUrl": ""
}
```

| Clé | Usage |
| --- | --- |
| `basePath` | `/Hippocampes/` pour ce site de projet. Le workflow utilise également le chemin retourné par GitHub Pages. |
| `domain` | Vide tant qu’aucun domaine propre n’est configuré. |
| `mediaBaseUrl` | Base HTTPS facultative pour des médias externalisés en conservant leurs chemins. |
| `mediaMap` | Correspondance facultative entre les chemins des médias et leurs URL HTTPS externes. |
| `clubUrl` | Adresse HTTPS d’un espace adhérent hébergé séparément, lorsqu’il est disponible. |

Les variables `PAGES_BASE_PATH`, `PAGES_DOMAIN`, `PAGES_MEDIA_BASE_URL`, `PAGES_CLUB_URL` et `PAGES_MEDIA_MAP_FILE` peuvent fournir ces paramètres à la construction. `PAGES_SITE_URL` fournit l’adresse publique complète au sitemap et aux URL canoniques. Ces réglages sont publics ; aucun secret Cloudinary n’est nécessaire au site ou au workflow Pages.

Le dépôt contient uniquement les sources et contenus publics du site. Les données adhérents, documents privés, fichiers `.env`, clés, sessions et bases de données restent hors du dépôt public.

## 2. Gérer les images locales

`github-pages/local-media.json` déclare les **123 chemins d’images actuellement servis par GitHub Pages**. Chaque fichier doit exister dans `public/`, avec un chemin commençant par `/images/` ou `/media/archive/`. Les vidéos ne sont pas autorisées dans cette liste.

`github-pages/media-inventory.json` conserve l’inventaire des images récupérées, avec leurs tailles et empreintes SHA-256. Les contrôles vérifient les fichiers déclarés et leur présence dans le site construit. Une image de la liste locale reste servie par GitHub Pages même si `mediaMap` ou `mediaBaseUrl` contient une correspondance pour elle.

Pour ajouter une nouvelle image :

1. Placer le fichier dans `public/images/` ou `public/media/archive/`.
2. Ajouter son chemin public, par exemple `/images/sortie-club.jpg`, dans `github-pages/local-media.json`.
3. Utiliser ce chemin dans le contenu concerné, puis enregistrer la modification dans le dépôt.

Les documents publics PDF et le calendrier ICS restent dans `public/media/archive/` ; ils ne font pas partie de la liste d’images.

## 3. Construire et publier sans Cloudinary

Avec **Node.js 24**, depuis la racine du dépôt :

```sh
npm ci
npm run typecheck
node scripts/check-pages-media-config.mjs
npm run build
npm run check
```

Le résultat est `outputs/hippocampes-github-pages/www/`. La construction de production copie les images locales déclarées. Elle exige une URL externe uniquement pour les médias requis qui ne sont pas déclarés locaux. Avec les 123 images présentes et déclarées, aucune configuration Cloudinary n’est attendue.

Le workflow `.github/workflows/pages.yml` effectue les contrôles puis transmet uniquement le dossier `www` à Pages. Une modification de `main` déclenche la publication ; un lancement manuel est aussi possible dans **Actions → Publier le site du club sur GitHub Pages → Run workflow**.

Vérifier la réussite du travail **deploy**, puis ouvrir le site. Un contrôle de code réussi ou un travail de publication ignoré ne signifie pas que le site est en ligne. Le message `Publication en attente des médias` reste utile si un futur média n’a ni copie locale déclarée ni URL externe valide.

Les pages d’archives et d’actualités disposent de fichiers HTML pour que leurs liens directs fonctionnent. Les chemins des liens, images et documents tiennent compte de `/Hippocampes/`.

## 4. Mettre à jour les contenus

- Les archives reprises résident dans `public/content/archive-index.json` et `public/content/entries/`.
- Les nouvelles actualités publiques utilisent `github-pages/content/public-club.json`, avec une liste `news`.
- Les albums supplémentaires utilisent `github-pages/content/public-media.json`, avec une liste `photos` et des chemins locaux déclarés ou des URL HTTPS externes.

Pour reprendre une publication du serveur d’administration, exporter uniquement les champs publics attendus, relire le résultat puis mettre à jour ces fichiers. Enregistrer la modification dans le dépôt pour reconstruire et publier le site.

## 5. Déplacer les images vers Cloudinary plus tard

Cette migration est facultative. Elle peut se faire progressivement tout en conservant les photos des actualités dans GitHub.

1. Importer les images choisies dans le compte Cloudinary du club, ou chez l’hébergeur média retenu.
2. Récupérer leurs **véritables URL HTTPS publiques** et vérifier qu’elles affichent bien les images attendues.
3. Renseigner ces URL dans `mediaMap` de `github-pages/site.config.json`. Une base `mediaBaseUrl` convient aussi si les chemins `images/...` et `media/archive/...` sont conservés exactement.
4. Retirer **uniquement les chemins externalisés** de `github-pages/local-media.json`. Cette étape est nécessaire, car la liste locale est prioritaire sur les URL externes.
5. Construire, contrôler, publier puis vérifier sur le site les images, le fond et les albums concernés.
6. Après cette vérification, retirer du dépôt les copies devenues inutiles. Conserver l’inventaire et les correspondances d’URL. Une sauvegarde des originaux reste utile.

Les **7 fichiers d’images des actualités et articles illustrés** à conserver localement selon la préférence actuelle du club sont :

```text
/images/activites-piscine-2026.jpg
/images/reprise-club-2026.jpg
/images/sortie-nemo-2026.jpg
/media/archive/0b5029b91de07bd7084c2fc5.jpg
/media/archive/9301a6aa51fcb174bf36b901.jpg
/media/archive/bab0b513fb09bb8fdaf49f61.jpg
/media/archive/d2c24cf9bbf27149c98059f3.jpg
```

La version statique utilise les URL publiques des médias. Les identifiants permettant d’importer ou d’administrer Cloudinary ne doivent pas être ajoutés au dépôt. Le simple déplacement d’une vidéo ne crée pas de lecteur vidéo supplémentaire dans le site.

## 6. Ajouter un nom de domaine

L’adresse gratuite en `.github.io` suffit pour publier. Un domaine propre peut être acheté séparément et configuré plus tard ; aucun achat n’est nécessaire pour cette version.

Une fois le domaine choisi et acheté au nom du club :

1. Vérifier sa propriété dans les réglages Pages du compte GitHub du club avec l’enregistrement TXT fourni par GitHub.
2. Renseigner le domaine dans **Settings → Pages → Custom domain**, ainsi que dans `domain` pour la construction du site. Un domaine propre utilise le chemin racine `/`.
3. Chez le registrar, appliquer les enregistrements indiqués par GitHub : `CNAME` de `www` vers `durstyone.github.io` et enregistrements `A` ou `ALIAS`/`ANAME` appropriés pour le domaine sans `www`. La cible CNAME ne contient pas `/Hippocampes/`.
4. Une fois les DNS et le certificat prêts, vérifier **Enforce HTTPS** et contrôler les liens directs ainsi que les images.

La messagerie sur le domaine est un service distinct de GitHub Pages. Si une messagerie existe déjà, conserver ses enregistrements MX/TXT.

## Documentation officielle

- [Présentation de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Publication avec GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Domaines personnalisés](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
- [Configuration des DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Vérification du domaine](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
