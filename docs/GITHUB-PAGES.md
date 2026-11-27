# Publier le site du club sur GitHub Pages

Cette cible publie la vitrine, les actualités publiques et les archives déjà reprises du blog. Les photos des actualités déclarées dans `github-pages/local-media.json` sont conservées dans les fichiers du site. Les autres médias et vidéos sont servis par un hébergement externe. Le compte, le dépôt, le domaine et les accès appartiennent au club ; ils sont indépendants de tout autre projet de Florent.

## Ce qui fonctionne sur Pages

| Élément | Hébergement et mise à jour |
| --- | --- |
| Présentation, activités, agenda de saison, contact | Fichiers du site sur GitHub Pages. Le contact prépare un e-mail dans la messagerie du visiteur. |
| Archives importées, recherche et lecture | JSON et interface statique, publiés avec le site. La reprise du blog reste partielle. |
| Actualités et albums publics supplémentaires | Copies publiques dans `github-pages/content/public-club.json` et `github-pages/content/public-media.json`. Une nouvelle publication met ces copies à jour. |
| Photos des actualités | Images présentes dans `public/` et déclarées dans `github-pages/local-media.json`, conservées sur GitHub Pages. |
| Autres photos, fond et vidéos | URL HTTPS externes : Cloudinary ou hébergement média/CDN. |
| Comptes, inscriptions, administration et documents privés | Serveur distinct obligatoire. Pages propose un lien vers cet espace si `clubUrl` est renseigné. |

GitHub Pages ne fait pas fonctionner le serveur Node, SQLite, D1 ou les API de l’espace club. Les versions Sites et autonome restent disponibles dans le projet. Les nouvelles publications de leur administration ne sont **pas synchronisées automatiquement** avec la version Pages : une copie publique doit être mise à jour puis republiée. Le secret Cloudinary utilisé pour signer les imports reste dans le serveur d’administration.

## 1. Utiliser un dépôt dédié au club

Sur GitHub Free, Pages est disponible pour un dépôt **public**. Créer ou choisir un compte ou une organisation du club, puis un dépôt réservé à ce site.

Une adresse gratuite en `.github.io` suffit pour démarrer : aucun nom de domaine payant n’est nécessaire. Pour obtenir `https://<compte-du-club>.github.io/`, nommer le dépôt public exactement `<compte-du-club>.github.io`. Par exemple, un compte disponible et créé sous le nom `hippocampes-du-robec` utiliserait le dépôt `hippocampes-du-robec.github.io` et l’adresse correspondante. Ces noms sont des exemples non réservés. Un autre nom de dépôt donnera généralement `https://<compte-du-club>.github.io/<depot>/` ; le workflow fourni adapte les chemins aux deux cas.

Le ZIP fourni contient deux dossiers :

| Dossier | Destination |
| --- | --- |
| `site-github/` | Sources publiques et configuration de publication. La version adaptée au dépôt conserve aussi les photos d’actualité explicitement autorisées. |
| `medias-a-heberger/` | Les 123 images à transférer chez l’hébergeur média, avec leur inventaire, la correspondance d’URL à remplir et les consignes. Aucune vidéo locale n’a été trouvée dans cette version. |

**Copier uniquement le contenu de `site-github/` à la racine du dépôt**, y compris le dossier `.github/`. Les fichiers `package.json` et `package-lock.json` doivent donc se trouver à la racine, sans niveau `site-github/` supplémentaire. Ne pas ajouter `medias-a-heberger/`, le ZIP entier, le projet source complet ou une sauvegarde de production au dépôt.

Le dépôt ne doit contenir ni données adhérents, ni documents privés, ni fichiers `.env`, ni clés Cloudinary, ni sessions, ni base de données. Les fichiers et URL publiés par Pages sont consultables par les visiteurs.

Dans le dépôt, choisir **Settings → Pages → Build and deployment → Source : GitHub Actions**. Le workflow de publication fourni construit le site puis transmet le seul dossier `www` à Pages. Une modification enregistrée sur la branche de publication déclenche une nouvelle construction ; il faut attendre sa réussite dans l’onglet **Actions**.

Dans le dépôt `Durstyone/Hippocampes`, le contrôle initial indique `Publication en attente des médias` et saute toutes les étapes de publication si les URL externes ne sont pas encore configurées. Les 7 fichiers d’actualité conservés localement ne demandent aucune URL externe ; les 116 autres chemins restent à configurer. Un contrôle de code réussi n’est pas une publication.

### Conserver les images des actualités

Les images déclarées dans `github-pages/local-media.json` sont l’exception à l’externalisation des médias. Leur fichier doit exister dans `public/` et leur chemin doit commencer par `/images/` ou `/media/archive/`. Le constructeur les copie dans le site et les conserve locales même lorsqu’une base CDN est configurée. Pour ajouter une nouvelle photo d’actualité, ajouter le fichier, son chemin à cette liste et sa référence dans l’actualité. Les vidéos restent externes.

## 2. Héberger les photos et vidéos séparément

Dans le ZIP fourni, le lot est déjà préparé dans **`medias-a-heberger/`**. Il contient les images publiques copiées en conservant leurs chemins, un `manifest.json` avec tailles et empreintes SHA-256, et un `media-map.example.json` dont les URL sont à renseigner. Les PDF, ICS, identifiants et données privées n’y sont pas inclus. Aucun transfert sur Internet n’a été effectué.

La commande suivante permet de régénérer ce lot **uniquement depuis le projet source complet** :

```sh
node scripts/export-public-media.mjs
```

Elle produit `outputs/hippocampes-medias/`, sans envoi réseau et sans modifier les originaux. Le script `export-public-media.mjs` et les médias locaux ne font pas partie du dossier public `site-github/` ; il n’est pas nécessaire d’exécuter cette commande pour utiliser le ZIP fourni.

Deux méthodes sont possibles :

- **Base d’URL commune** : conserver les chemins `images/...` et `media/archive/...` chez l’hébergeur média, puis renseigner `mediaBaseUrl`. Le site ajoute le chemin de chaque fichier à cette base.
- **Correspondance fichier par fichier**, recommandée lorsque Cloudinary attribue des URL différentes : remplir une copie de `media-map.example.json` avec les URL HTTPS réellement obtenues après import. Placer cette correspondance dans `mediaMap`, ou utiliser `PAGES_MEDIA_MAP_FILE` pour charger le fichier JSON. Une correspondance explicite est prioritaire sur la base commune.

Exemple de correspondance, à remplacer par de vraies URL :

```json
{
  "/images/fond-manta-robec.png": "https://cdn.example.org/images/fond-manta-robec.png",
  "/images/reprise-club-2026.jpg": "https://cdn.example.org/images/reprise-club-2026.jpg"
}
```

Les anciennes images qui n’ont pas été récupérées du blog restent des liens vers leur source ; cette préparation n’invente pas de copies distantes. Les futurs fichiers vidéo doivent également avoir une URL externe. Une vidéo hébergée sur une plateforme peut être proposée comme lien ; le simple déplacement de fichiers ne crée pas un nouveau lecteur vidéo dans le site.

## 3. Renseigner la configuration publique

Modifier `github-pages/site.config.json` :

```json
{
  "basePath": "/",
  "domain": "",
  "mediaBaseUrl": "",
  "mediaMap": {},
  "clubUrl": ""
}
```

| Clé | Valeur attendue |
| --- | --- |
| `basePath` | `/` pour un domaine propre ou un site `<compte>.github.io` ; `/nom-du-depot/` pour un site de projet. |
| `domain` | Nom de domaine réellement détenu par le club, sans `https://`, chemin ni barre finale. Vide tant qu’aucun domaine n’est choisi. |
| `mediaBaseUrl` | Base HTTPS de l’hébergement média conservant les chemins, ou vide si la correspondance couvre tous les médias. |
| `mediaMap` | Objet associant les chemins locaux des médias à leurs URL HTTPS externes. |
| `clubUrl` | URL HTTPS de l’espace adhérent hébergé séparément. Vide tant que cet espace n’est pas ouvert. |

Les variables `PAGES_BASE_PATH`, `PAGES_DOMAIN`, `PAGES_MEDIA_BASE_URL`, `PAGES_CLUB_URL` et `PAGES_MEDIA_MAP_FILE` peuvent fournir ces paramètres lors de la construction. `PAGES_SITE_URL` permet d’indiquer l’adresse publique complète pour le sitemap et les URL canoniques lorsqu’aucun domaine propre n’est configuré. Elles contiennent des réglages publics ; aucun secret Cloudinary n’est nécessaire au navigateur ou au workflow Pages.

Avec un domaine personnalisé, la racine du site est `/`. Les chemins des pages, des documents et des ressources sont adaptés lors de la construction. Des fichiers HTML sont générés pour les routes des archives et des actualités publiées afin que leurs liens directs fonctionnent.

## 4. Mettre à jour les contenus publics

- Les archives reprises résident dans `public/content/archive-index.json` et `public/content/entries/`.
- Les nouvelles actualités publiques utilisent `github-pages/content/public-club.json`, avec une liste `news`.
- Les photos publiées dans les albums supplémentaires utilisent `github-pages/content/public-media.json`, avec une liste `photos` et les URL externes.

Les listes initialement vides ne sont pas des données fictives. Pour reprendre une publication du serveur, exporter uniquement les champs publics attendus, relire le résultat puis mettre à jour ces fichiers. Ne pas y copier une réponse d’administration contenant des adhérents, des brouillons ou des informations privées. Enregistrer ensuite la modification dans le dépôt pour reconstruire et publier le site.

## 5. Construire et publier

Pour construire le paquet public sur un ordinateur, installer **Node.js 24**, puis ouvrir un terminal dans `site-github/` ou à la racine du dépôt qui en contient les fichiers. Après avoir renseigné les URL des médias :

```sh
npm ci
npm run build
npm run check
```

`npm ci` installe les versions figées dans le fichier de dépendances. La construction lance `scripts/build-github-pages.mjs`, puis le contrôle vérifie le dossier produit avec `scripts/check-github-pages.mjs`. Le résultat se trouve dans `outputs/hippocampes-github-pages/www/`. Le mode de production exige une configuration externe pour tous les médias requis et s’arrête si elle manque. Il ne faut pas déposer les photos et vidéos dans le dépôt pour contourner cette vérification.

Le workflow GitHub Actions réalise ces opérations de publication à partir du dépôt. Pour une construction manuelle depuis le projet source complet déjà équipé de ses dépendances, utiliser `node scripts/build-github-pages.mjs`, puis `node scripts/check-github-pages.mjs`.

L’aperçu avec copies locales des médias ci-dessous est réservé **au projet source complet**, qui conserve les images dans `public/`. Il n’est pas utilisable à partir du paquet public `site-github/`, dont ces fichiers sont exclus :

```sh
node scripts/build-github-pages.mjs --preview-local-media
```

Ce mode de contrôle conserve des copies locales des médias dans un dossier distinct, `outputs/hippocampes-github-pages-preview/www/`. **Il n’est pas destiné à la publication sur GitHub Pages.** Le workflow de production doit utiliser la première commande, sans cette option.

## 6. Ajouter un nom de domaine

GitHub Pages accepte un domaine acheté séparément chez un registrar. Par exemple, `hippocampesdurobec.fr` serait un nom possible ; **sa disponibilité n’a pas été vérifiée**, il n’a pas été réservé et aucun achat n’a été effectué.

Le domaine et son renouvellement sont distincts de l’hébergement Pages. GitHub fournit le HTTPS lorsque le domaine et les DNS sont correctement configurés. Prévoir le domaine au nom du club, avec des accès récupérables par son bureau.

Une fois le nom choisi et acheté :

1. Vérifier le domaine dans les réglages Pages du compte ou de l’organisation GitHub du club, à l’aide du TXT fourni par GitHub.
2. Renseigner le domaine dans **Settings → Pages → Custom domain** du dépôt, ainsi que dans `domain` pour la construction du site.
3. Chez le registrar, appliquer les enregistrements indiqués par GitHub : `CNAME` de `www` vers `<compte-du-club>.github.io` et, pour le domaine sans `www`, les enregistrements `A` ou `ALIAS`/`ANAME` appropriés. La cible CNAME ne contient pas le nom du dépôt.
4. Configurer les variantes avec et sans `www` pour laisser GitHub rediriger vers l’adresse retenue.
5. Une fois la vérification DNS et le certificat prêts, activer **Enforce HTTPS** et contrôler les liens directs des archives ainsi que les médias externes.

Cette configuration concerne le site web. Une adresse e-mail sur le domaine est un service distinct et n’est pas fournie par GitHub Pages. Si le domaine possède déjà une messagerie, conserver ses enregistrements MX/TXT.

## Documentation officielle

- [Présentation de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Publication avec un workflow GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Domaines personnalisés](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
- [Configuration du domaine et des DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Vérification du domaine](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

L’ouverture du compte et du dépôt dédiés, le choix du domaine, son achat, le transfert des médias et la publication effective restent à effectuer avec les accès du club.
