# Administrer le site des Hippocampes

## Une interface de gestion dans le site

Le bouton **Administration** ouvre [l’espace d’administration du club](https://durstyone.github.io/Hippocampes/admin/). Il regroupe le tableau de bord, les adhérents, les documents publics et privés, les actualités, la photothèque, l’agenda, les informations du club et les accès des responsables. Les listes et formulaires s’utilisent dans cette interface ; les contenus sont enregistrés dans **Durstyone/Hippocampes**, branche **main**, puis publiés par GitHub Pages.

Le lien **Voir le site** reste accessible et ouvre toujours [le site public](https://durstyone.github.io/Hippocampes/).

## Se connecter pour enregistrer

La consultation des contenus publics ne demande aucune connexion. Les données affichées au chargement correspondent à la dernière version publiée. Pour enregistrer directement depuis cette administration, utiliser un **jeton personnel GitHub à permissions fines** (*fine-grained personal access token*) :

1. Se connecter à GitHub avec le compte du club **Durstyone**.
2. Dans les paramètres GitHub, ouvrir **Developer settings → Personal access tokens → Fine-grained tokens**.
3. Créer un jeton avec **Durstyone** comme propriétaire, choisir **Only select repositories** et sélectionner **Hippocampes** pour le site et **Hippocampes-prive** pour les dossiers du club.
4. Autoriser **Repository permissions → Contents → Read and write**. La lecture des métadonnées du dépôt est ajoutée automatiquement par GitHub ; aucune permission de workflow n’est nécessaire. La rubrique séparée **Accès et droits**, réservée au propriétaire, demande aussi **Administration → Read and write** pour gérer les invitations.
5. Copier le jeton dans le champ de connexion de l’administration et valider. L’identité retournée par GitHub est affichée après vérification.

Cette connexion par jeton est distincte de la session ouverte sur github.com. Elle ne réutilise pas automatiquement les autorisations de Pages CMS. Le jeton reste uniquement en mémoire dans l’onglet : il n’est enregistré ni dans les fichiers du site, ni dans le stockage local du navigateur. Il est envoyé uniquement à l’API officielle GitHub et supprimé à la déconnexion ou au rechargement de la page.

Ne pas placer le jeton dans une URL, un article ou un fichier du dépôt. Pour le propriétaire, il peut rester limité aux deux dépôts du club et avoir une durée adaptée à son usage.

## Comptes des responsables invités

Chaque responsable utilise son propre compte GitHub. Une fonction associative renseignée dans une fiche adhérent ne donne **aucun droit technique**. Le propriétaire choisit les autorisations dans **Accès et droits** ; la personne doit accepter l’invitation GitHub.

GitHub ne permet pas à un collaborateur d’utiliser un jeton à accès fin sur un dépôt personnel appartenant à un autre utilisateur. Pour les formulaires intégrés, le collaborateur utilise un jeton classique : `public_repo` pour le site public seul, `repo` pour les dossiers privés. Ce dernier périmètre peut aussi couvrir ses autres dépôts privés. La clé n’est jamais conservée durablement par le site ; utiliser une durée courte et la révoquer après usage. Le propriétaire peut conserver un jeton à accès fin limité aux dépôts du club.

## Adhérents

La rubrique **Adhérents** gère les coordonnées, la saison, le niveau, les groupes, le statut du dossier, la réception du formulaire d’adhésion, le numéro et l’échéance de la licence, l’échéance du CACI et le contact d’urgence. Ne pas y renseigner de diagnostic ni les réponses d’un questionnaire médical.

La liste est recherchable, filtrable et exportable en CSV. Une fiche peut être archivée puis rétablie. Ses documents sont consultables depuis la fiche. Les données ne sont chargées qu’après autorisation sur le dépôt privé **Durstyone/Hippocampes-prive**, et sont effacées de la mémoire de l’interface à la déconnexion.

Aucun jeu de faux adhérents n’est préchargé. L’audit de la base de l’ancien espace effectué le 28 novembre 2026 n’a trouvé aucune fiche adhérent ni pièce jointe enregistrée à migrer.

## Documents publics et dossier d’adhésion

La page [Documents](https://durstyone.github.io/Hippocampes/documents/) regroupe les formulaires vierges et les ressources publiques. Le dossier officiel **2026–2027** déjà présent dans les archives est proposé directement : six pages, à imprimer et compléter. Il comprend la feuille d’inscription, la charte et les documents médicaux vierges. Le bouton de la page **Le club** suit la fiche d’adhésion de la saison.

Dans **Documents → Documents publics**, ajouter ou modifier une fiche, importer un PDF de 5 Mio maximum ou choisir un document déjà présent. Confirmer que le document est destiné à tous les visiteurs avant sa publication. Les fiches sont enregistrées dans `github-pages/content/documents/` ; les nouveaux PDF sont dans `public/documents/fichiers/`. Le PDF et sa fiche sont enregistrés ensemble. Retirer une fiche de la page ne purge pas son fichier ni l’historique GitHub.

## Documents privés

**Documents → Documents privés** permet d’importer une pièce administrative (PDF, JPEG, PNG ou WebP, 5 Mio maximum), de la rattacher à un adhérent, de la classer par saison et catégorie, de la télécharger, de la modifier ou de l’archiver. Les fichiers restent dans **Hippocampes-prive** et ne sont jamais ajoutés à la publication GitHub Pages.

Le rattachement à un adhérent sert au classement : il ne crée pas un accès personnel pour cet adhérent. Les responsables autorisés sur le dépôt privé voient tous les dossiers. Les questionnaires médicaux remplis restent avec l’adhérent et son médecin.

## Accès et droits

Cette rubrique est réservée au propriétaire **Durstyone**. Elle vérifie le compte GitHub du destinataire, affiche les accès et invitations existants et permet d’inviter un responsable ou de retirer un accès après confirmation.

Les deux périmètres correspondent aux permissions **réelles** de GitHub :

- **Site et code** : écriture dans `Durstyone/Hippocampes`, y compris les contenus, les fichiers sources et le logiciel d’administration. Réserver cet accès à une personne de confiance, car elle peut modifier le code utilisé par les autres responsables.
- **Dossiers privés** : lecture et écriture dans `Durstyone/Hippocampes-prive`, comprenant tous les adhérents, les documents et leur historique.

Un compte personnel GitHub distingue propriétaire et collaborateurs. Cette architecture ne fournit pas de rôle « actualités seulement », de lecture seule du dépôt privé ou de restriction par adhérent. Les rôles fins et les comptes autonomes des adhérents nécessitent une autre couche d’authentification et de permissions. Ajouter un accès à chacun des deux dépôts est une opération distincte ; l’interface indique les éventuels résultats partiels.

Aucune invitation n’est envoyée automatiquement lors de la création d’une fiche, et aucun nouvel accès n’a été attribué pendant cette mise à jour.

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

## Périmètre et conservation

Les contenus publics et les données privées sont enregistrés dans deux dépôts distincts. Le client privé refuse les lectures et les enregistrements si GitHub ne confirme plus le caractère privé de `Hippocampes-prive`. Le constructeur du site n’inclut aucune fiche adhérent ni pièce jointe privée.

Git conserve les versions antérieures : **archiver n’efface pas définitivement** les données de l’historique. La suppression définitive d’une donnée nécessite une opération distincte sur l’historique, à préparer spécifiquement.

Les paiements, la comptabilité, les inscriptions autonomes aux sorties, les palanquées et le prêt de matériel ne sont pas intégrés dans cette version. Les formulaires et les protections sont testés localement ; l’enregistrement authentifié et l’envoi d’invitations doivent être vérifiés après activation du jeton du propriétaire.

Références officielles : [jetons personnels GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [permissions d’un dépôt personnel](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository), [API GitHub depuis le navigateur](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests), [configuration de Pages CMS](https://pagescms.org/docs/configuration/).
