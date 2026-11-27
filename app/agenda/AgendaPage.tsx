'use client';

import { CalendarDays, ExternalLink, Mail, Users } from 'lucide-react';
import { publicSiteSettings as settings } from '../../lib/public-site-content';
import { clubPortalUrl, mediaUrl, siteUrl } from '../../lib/site-delivery';
import ClubCalendar from './ClubCalendar';
import '../site/site.css';
import './calendar.css';

export default function AgendaPage() {
  return <div className="site-page agenda-page">
    <a className="site-skip" href="#agenda-contenu">Aller au calendrier</a>
    <header className="site-header">
      <div className="agenda-container site-header-inner">
        <a className="site-brand" href={siteUrl('/')} aria-label="Les Hippocampes du Robec, accueil">
          <img src={mediaUrl('/images/logo-club.jpg')} alt="" width="50" height="50" />
          <span>Les Hippocampes<small>DU ROBEC</small></span>
        </a>
        <nav className="agenda-header-nav" aria-label="Navigation principale">
          <a href={siteUrl('/')}>Accueil</a>
          <a href={siteUrl('/agenda/')} aria-current="page">L’agenda</a>
          <a className="agenda-header-secondary" href={siteUrl('/actualites/')}>Actualités</a>
          <a className="agenda-header-secondary" href={siteUrl('/archives/')}>Archives</a>
        </nav>
        {clubPortalUrl && <a className="site-member-link agenda-portal" href={clubPortalUrl}><Users size={17} /><span>Espace club</span></a>}
      </div>
    </header>

    <main className="agenda-container agenda-main" id="agenda-contenu">
      <section className="agenda-intro" aria-labelledby="agenda-title">
        <div>
          <p className="agenda-eyebrow"><span /> NOS PROCHAINS RENDEZ-VOUS</p>
          <h1 id="agenda-title">L’agenda du club<span>.</span></h1>
          <p className="agenda-intro-copy">Les entraînements, les formations, les sorties.<br className="agenda-intro-break" /> Toute la saison, au même endroit.</p>
        </div>
        <div className="agenda-intro-aside">
          <span className="agenda-season-pill"><CalendarDays size={17} /> Saison {settings.season.name}</span>
          <a href={`mailto:${settings.contact.email}?subject=${encodeURIComponent('Une question sur le planning du club')}`}><Mail size={15} /> Une question sur le programme ?</a>
        </div>
      </section>

      <ClubCalendar settings={settings} />

      <footer className="agenda-page-footer">
        <p>Les Hippocampes du Robec <span>·</span> {settings.contact.venueShort}</p>
        {settings.season.calendarImage && <a href={mediaUrl(settings.season.calendarImage)} target="_blank" rel="noopener noreferrer">Voir le planning d’origine <ExternalLink size={14} /><span className="calendar-sr-only"> (nouvel onglet)</span></a>}
      </footer>
    </main>
  </div>;
}
