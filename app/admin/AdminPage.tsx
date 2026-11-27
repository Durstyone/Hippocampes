import { useEffect } from 'react';
import { CalendarDays, Check, ExternalLink, FilePenLine, Images, LockKeyhole, Settings, ShieldCheck, Users, Waves } from 'lucide-react';
import { clubPortalUrl, mediaUrl, siteUrl } from '../../lib/site-delivery';
import './admin.css';

const EDITOR_URL = 'https://app.pagescms.org/';
const PUBLICATION_URL = 'https://github.com/Durstyone/Hippocampes/actions/workflows/pages.yml';

export default function AdminPage() {
  useEffect(() => { document.title = 'Administration — Les Hippocampes du Robec'; }, []);
  return <div className="club-admin-page">
    <a className="site-skip" href="#administration">Aller au contenu</a>
    <header className="site-header"><div className="site-container site-header-inner">
      <a className="site-brand" href={siteUrl('/')} aria-label="Les Hippocampes du Robec, accueil"><img src={mediaUrl('/images/logo-club.jpg')} alt="" width="50" height="50"/><span>Les Hippocampes<small>DU ROBEC</small></span></a>
      <a className="club-admin-return" href={siteUrl('/')}>Voir le site</a>
    </div></header>
    <main className="site-container club-admin-main" id="administration">
      <div className="club-admin-intro"><span className="club-admin-eyebrow"><Waves size={18}/> L’ESPACE DES RESPONSABLES</span><h1>Faire vivre le club.<br/><span>Partager ses nouvelles.</span></h1><p>Retrouvez la gestion du club et les outils pour faire évoluer son site.</p></div>
      <div className="club-admin-grid">
        <section className="club-admin-card"><span className="club-admin-icon"><FilePenLine size={26}/></span><h2>Le contenu du site</h2><p>Publiez les nouvelles du club, ajoutez des photos et actualisez les informations pratiques.</p>
          <ul><li><FilePenLine size={18}/>Actualités et récits</li><li><Images size={18}/>Photos et albums</li><li><CalendarDays size={18}/>Agenda et horaires</li><li><Settings size={18}/>Coordonnées et présentation</li></ul>
          <a className="club-admin-button" href={EDITOR_URL} target="_blank" rel="noopener noreferrer">Se connecter à l’éditeur <ExternalLink size={16}/></a>
          <div className="club-admin-first"><LockKeyhole size={17}/><p><strong>Première connexion</strong>L’éditeur Pages CMS doit être autorisé avec le compte GitHub du club, pour le dépôt Durstyone/Hippocampes. Cette activation reste à effectuer.</p></div>
        </section>
        <section className="club-admin-card club-admin-card-members"><span className="club-admin-icon"><Users size={26}/></span><h2>La gestion du club</h2><p>Retrouvez l’espace de gestion existant, avec ses accès réservés aux personnes autorisées.</p>
          <ul><li><Check size={18}/>Adhérents et inscriptions</li><li><Check size={18}/>Sorties, matériel et documents</li><li><Check size={18}/>Finances et vie associative</li><li><ShieldCheck size={18}/>Accès et droits des membres</li></ul>
          {clubPortalUrl && <a className="club-admin-button club-admin-button-secondary" href={clubPortalUrl} target="_blank" rel="noopener noreferrer">Ouvrir l’espace club <ExternalLink size={16}/></a>}
          <p className="club-admin-footnote">La connexion habituelle reste nécessaire. Pour mettre à jour le site public, utilisez l’éditeur de contenu : les publications de l’ancien espace ne sont pas synchronisées avec ce site.</p>
        </section>
      </div>
      <section className="club-admin-publishing"><div><h2>De l’idée à la publication</h2><p>Une fois l’éditeur activé, chaque enregistrement lance la mise à jour du site. Les photos sont conservées avec le site pour le moment.</p><p className="club-admin-private-note">L’éditeur sert au contenu public. Les coordonnées des adhérents et les documents privés restent dans l’espace club.</p></div><a href={PUBLICATION_URL} target="_blank" rel="noopener noreferrer">Suivre une publication <ExternalLink size={15}/></a></section>
    </main>
    <footer className="club-admin-footer"><span>Les Hippocampes du Robec · Darnétal</span><a href={siteUrl('/')}>Retour au site</a></footer>
  </div>;
}
