import { useEffect } from 'react';
import { CalendarDays, Check, ExternalLink, FilePenLine, Images, LockKeyhole, Settings } from 'lucide-react';
import { mediaUrl } from '../../lib/site-delivery';
import './admin.css';

const EDITOR_URL = 'https://app.pagescms.org/durstyone/hippocampes/main/file/site';
const PUBLIC_SITE_URL = 'https://durstyone.github.io/Hippocampes/';
const REPOSITORY_URL = 'https://github.com/Durstyone/Hippocampes';
const PUBLICATION_URL = 'https://github.com/Durstyone/Hippocampes/actions/workflows/pages.yml';

export default function AdminPage() {
  useEffect(() => { document.title = 'Administration — Les Hippocampes du Robec'; }, []);
  return <div className="club-admin-page">
    <a className="site-skip" href="#administration">Aller au contenu</a>
    <header className="site-header"><div className="site-container site-header-inner">
      <a className="site-brand" href={PUBLIC_SITE_URL} aria-label="Les Hippocampes du Robec, accueil"><img src={mediaUrl('/images/logo-club.jpg')} alt="" width="50" height="50"/><span>Les Hippocampes<small>DU ROBEC</small></span></a>
      <a className="club-admin-return" href={PUBLIC_SITE_URL}>Voir le site</a>
    </div></header>
    <main className="site-container club-admin-main" id="administration">
      <div className="club-admin-intro"><span className="club-admin-eyebrow"><Settings size={18}/> L’ADMINISTRATION DU SITE</span><h1>Faire vivre le site.<br/><span>Depuis GitHub.</span></h1><p>Les contenus sont enregistrés dans le dépôt GitHub du club, Durstyone/Hippocampes. Pages CMS est l’éditeur relié à ce dépôt.</p></div>
      <div className="club-admin-grid">
        <section className="club-admin-card"><span className="club-admin-icon"><FilePenLine size={26}/></span><h2>Le contenu du site</h2><p>Publiez les nouvelles du club, ajoutez des photos et actualisez les informations pratiques.</p>
          <ul><li><FilePenLine size={18}/>Actualités et récits</li><li><Images size={18}/>Photos et albums</li><li><CalendarDays size={18}/>Agenda et horaires</li><li><Settings size={18}/>Coordonnées et présentation</li></ul>
          <a className="club-admin-button" href={EDITOR_URL} target="_blank" rel="noopener noreferrer">Modifier le site avec Pages CMS <ExternalLink size={16}/></a>
          <div className="club-admin-first"><LockKeyhole size={17}/><p><strong>Connexion avec GitHub</strong>Utilisez le compte du club, Durstyone. Choisissez une rubrique puis enregistrez vos modifications : elles sont sauvegardées dans le dépôt et lancent la publication.</p></div>
        </section>
        <section className="club-admin-card"><span className="club-admin-icon"><Settings size={26}/></span><h2>Le dépôt GitHub</h2><p>Retrouvez les fichiers du site et l’historique des modifications directement dans Hippocampes.</p>
          <ul><li><Check size={18}/>Sources et contenus publics</li><li><Check size={18}/>Historique des changements</li><li><Check size={18}/>Suivi des publications</li><li><LockKeyhole size={18}/>Droits d’écriture gérés par GitHub</li></ul>
          <a className="club-admin-button club-admin-button-secondary" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">Ouvrir le dépôt GitHub <ExternalLink size={16}/></a>
          <p className="club-admin-footnote">Pour modifier les actualités, les photos ou l’agenda sans éditer les fichiers, utilisez Pages CMS. Les deux accès utilisent le même dépôt.</p>
        </section>
      </div>
      <section className="club-admin-publishing"><div><h2>De l’idée à la publication</h2><p>Chaque enregistrement dans l’éditeur lance la mise à jour sur GitHub Pages. Les photos sont conservées avec le site pour le moment. L’éditeur s’ouvre dans un autre onglet : celui du site reste disponible.</p><p className="club-admin-private-note">Cette administration concerne les contenus publics du site. Les comptes adhérents, paiements et documents confidentiels ne font pas partie de ce dépôt public.</p></div><a href={PUBLICATION_URL} target="_blank" rel="noopener noreferrer">Suivre une publication <ExternalLink size={15}/></a></section>
    </main>
    <footer className="club-admin-footer"><span>Les Hippocampes du Robec · Darnétal</span><a href={PUBLIC_SITE_URL}>Retour au site</a></footer>
  </div>;
}
