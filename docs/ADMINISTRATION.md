# Administrer le site des Hippocampes

## Une interface de gestion dans le site

Le bouton **Administration** ouvre [l’espace d’administration du club](https://durstyone.github.io/Hippocampes/admin/). Il regroupe le tableau de bord, les actualités, la photothèque, l’agenda et les informations du club. Les listes et formulaires s’utilisent dans cette interface ; les contenus sont enregistrés dans **Durstyone/Hippocampes**, branche **main**, puis publiés par GitHub Pages.

Le lien **Voir le site** reste accessible et ouvre toujours [le site public](https://durstyone.github.io/Hippocampes/).

## Se connecter pour enregistrer

La consultation des contenus publics ne demande aucune connexion. Les données affichées au chargement correspondent à la dernière version publiée. Pour enregistrer directement depuis cette administration, utiliser un **jeton personnel GitHub à permissions fines** (*fine-grained personal access token*) :

1. Se connecter à GitHub avec le compte du club **Durstyone**.
2. Dans les paramètres GitHub, ouvrir **Developer settings → Personal access tokens → Fine-grained tokens**.
3. Créer un jeton avec **Durstyone** comme propriétaire, choisir **Only select repositories** et sélectionner uniquement **Hippocampes**.
4. Autoriser **Repository permissions → Contents → Read and write**. La lecture des métadonnées du dépôt est ajoutée automatiquement par GitHub ; aucune permission d’administration ou de workflow n’est nécessaire.
5. Copier le jeton dans le champ de connexion de l’administration et valider. L’identité retournée par GitHub est affichée après vérification.

Cette connexion par jeton est distincte de la session ouverte sur github.com. Elle ne réutilise pas automatiquement les autorisations de Pages CMS. Le jeton reste uniquement en mémoire dans l’onglet : il n’est enregistré ni dans les fichiers du site, ni dans le stockage local du navigateur. Il est envoyé uniquement à l’API officielle GitHub et supprimé à la déconnexion ou au rechargement de la page.

Ne pas placer le jeton dans une URL, un article ou un fichier du dépôt. Il doit rester limité au dépôt du club et avoir une durée adaptée à son usage.

## Actualités et récits à la une

La rubrique **Actualités** distingue les nouvelles publications et les récits historiques mis en avant sur l’accueil. Ces récits sont déjà présents : ils ne correspondent pas à des articles vides à recréer.

Pour une nouvelle actualité, renseigner le titre, la date, le résumé, le texte et une éventuelle photo de couverture. Le texte utilise des paragraphes séparés par une ligne vide. L’aperçu permet de vérifier la présentation avant l’enregistrement.

Les nouvelles actualités sont enregistrées dans `github-pages/content/news/`. Leur nom de fichier sert d’identifiant et reste stable pour préserver les liens publics. Les récits historiques mis en avant sont enregistrés dans `featuredNews`, dans `github-pages/content/site-settings.json`.

## Photos et albums

La photothèque présente les images déjà conservées dans le site. Une image peut être choisie pour une actualité ou une publication photo. Pour organiser les nouvelles photos en albums, renseigner un titre, une description, une légende éventuelle et le même nom d’album pour les images d’une même sortie. Le champ d’ordre permet de classer les photos.

Les nouveaux fichiers sont conservés dans `public/images/publications/`. Les formats **JPEG, PNG, WebP et GIF** sont acceptés, avec une limite de **5 Mio par image**. Cloudinary n’est pas nécessaire. Les fiches d’albums sont enregistrées dans `github-pages/content/photos/`.

Les photos historiques, leurs liens et les archives déjà importées restent conservés. Les archives servent de mémoire documentaire ; leur consultation n’implique pas que toutes leurs pages disposent du même formulaire d’édition que les nouvelles publications.

## Agenda et créneaux habituels

L’agenda permet de créer et modifier les rendez-vous de la saison :

- Le type d’activité détermine la couleur et le filtre du calendrier.
- La date de fin, facultative, désigne le dernier jour inclus d’un événement sur plusieurs jours.
- Les statuts sont **Prévu**, **Confirmé** et **À confirmer**.
- Les heures sont saisies à l’heure de Paris. Laisser vide une heure inconnue ; ne pas inventer d’heure de fin.
- Les dates doivent se situer dans les limites de la saison.

Les créneaux habituels du mardi et du jeudi restent sans date. Ils donnent une fréquence indicative et ne créent pas automatiquement de séances. Un jour férié est un repère du calendrier ; il ne signifie pas à lui seul que le club est fermé.

Le calendrier public conserve ses vues, ses filtres et ses exports `.ics`. Ces exports sont des imports ponctuels dans les agendas personnels, sans synchronisation automatique des changements ultérieurs.

## Présentation, coordonnées, saison et FAQ

La rubrique du club permet de modifier les paragraphes de présentation, les coordonnées, l’adresse, les jours et horaires d’entraînement, la saison et les questions fréquentes. Les champs non modifiés sont conservés.

L’ensemble de ces informations et l’agenda utilisent `github-pages/content/site-settings.json`. Les mêmes validations s’appliquent dans l’administration et lors de la construction du site.

## Enregistrement et publication

Enregistrer crée un commit GitHub avec les fichiers concernés. Les images et leurs données peuvent être enregistrées ensemble dans un même commit. Le client vérifie les versions des fichiers avant d’écrire : si quelqu’un a modifié le même contenu entre-temps, il signale le conflit et conserve la saisie au lieu d’écraser cette modification.

**Enregistré sur GitHub** et **publié sur le site** correspondent à deux étapes différentes. GitHub Actions construit puis déploie la nouvelle version. Une réussite de l’étape **deploy** confirme sa publication. En cas d’échec, la dernière version correctement déployée reste accessible ; le contenu signalé doit être corrigé avant une nouvelle publication.

Les changements saisis dans un formulaire mais non enregistrés restent dans l’onglet. Ils ne sont pas des brouillons sauvegardés sur GitHub. Le dépôt ne gère pas de brouillon privé : son contenu est public.

## Pages CMS reste disponible

L’[éditeur Pages CMS existant](https://app.pagescms.org/durstyone/hippocampes/main/file/site) reste un autre moyen de modifier les mêmes contenus. Il utilise sa propre connexion GitHub et sa configuration `.pages.yml`. Les modifications effectuées dans l’un des éditeurs doivent être rechargées dans l’autre avant de poursuivre sur le même fichier.

## Périmètre de cette administration

Cette interface administre les **contenus publics du site**. Le dépôt est public : toute donnée enregistrée dans ses fichiers est visible dans GitHub, même avant le déploiement du site.

Les fonctions privées de l’ancien espace club — adhérents, paiements, inscriptions, palanquées, matériel, certificats et documents confidentiels — ne sont pas migrées dans cette version. Elles nécessitent un stockage privé et des contrôles d’accès adaptés. Ne pas enregistrer ces informations dans les contenus publics.

Références officielles : [jetons personnels GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [API GitHub et requêtes depuis le navigateur](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests), [configuration de Pages CMS](https://pagescms.org/docs/configuration/).
