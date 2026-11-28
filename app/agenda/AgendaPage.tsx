'use client';

import { CalendarDays, ExternalLink, Mail } from 'lucide-react';
import { publicSiteSettings as settings } from '../../lib/public-site-content';
import { mediaUrl } from '../../lib/site-delivery';
import { PublicHeader } from '../site/PublicLayout';
import ClubCalendar from './ClubCalendar';
import '../site/site.css';
import './calendar.css';

export default function AgendaPage() {
  return <div className="site-page agenda-page">
    <a className="site-skip" href="#agenda-contenu">Aller au calendrier</a>
    <PublicHeader current="agenda" />

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
