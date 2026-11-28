'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, MapPin, Waves, X } from 'lucide-react';
import { PublicHeader, PublicFooter } from './PublicLayout';
import { isStaticSite, mediaUrl, publicFeedUrl, siteUrl } from '../../lib/site-delivery';
import { publicSiteSettings as settings } from '../../lib/public-site-content';
import type { PublicNews } from '../actualites/NewsPage';
import { newsDate } from '../actualites/NewsPage';
import './apnea-home.css';

const BLOG = 'https://les-hippocampes-du-robec.over-blog.com/';
const practices = [
  { title: 'Apnée & palmes', label: 'Les sensations, simplement.', description: 'Prendre le temps, écouter ses sensations et partager l’entraînement en piscine.', href: '/activites/#apnee' },
  { title: 'Plongée bouteille', label: 'Un nouveau regard sous l’eau.', description: 'Du baptême aux formations, découvrir la plongée et progresser avec les encadrants du club.', href: '/activites/#plongee' },
  { title: 'Sorties & découvertes', label: 'L’envie de prendre le large.', description: 'Fosses, mer et voyages : prolonger les rencontres et explorer d’autres horizons.', href: '/activites/#sorties' },
];

function todayInParis() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}-${parts.find(part => part.type === 'day')?.value}`;
}

export default function ClubWebsite() {
  const [publishedNews, setPublishedNews] = useState<PublicNews[]>([]);
  const [today, setToday] = useState(todayInParis);
  const [info, setInfo] = useState<'privacy' | 'sources' | null>(null);
  const infoRef = useRef<HTMLDialogElement>(null);
  const upcoming = settings.events.filter(event => event.date && event.calendarCategory !== 'ferie' && (event.endDate || event.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title, 'fr')).slice(0, 3);
  const news = [
    ...publishedNews.map(item => ({ title: item.title, date: newsDate(item.date), category: 'Vie du club', image: item.image, alt: '', summary: item.excerpt, url: '/actualites/' + encodeURIComponent(item.id) + '/' })),
    ...settings.featuredNews,
  ].slice(0, 3);

  useEffect(() => {
    const refresh = () => setToday(todayInParis());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(publicFeedUrl('club') + (isStaticSite ? '' : '?summary=1&limit=3'), { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (response.ok) { const data = await response.json() as { news?: PublicNews[] }; setPublishedNews((data.news || []).slice(0, 3)); } }).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (info) infoRef.current?.showModal(); else infoRef.current?.close();
    document.body.style.overflow = info ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [info]);

  return <div className="site-page apnea-home">
    <a className="site-skip" href="#contenu">Aller au contenu</a>
    <PublicHeader />
    <main id="contenu">
      <section className="apnea-home-hero">
        <div className="site-container apnea-home-hero-inner">
          <div className="apnea-home-hero-copy">
            <p className="apnea-kicker">APNÉE & PLONGÉE · DARNÉTAL</p>
            <h1>Un souffle.<br /><span>Un autre monde.</span></h1>
            <p className="apnea-home-lead">Sous la surface, le temps change.<br />Près de Rouen, vivez l’eau à votre rythme<br className="apnea-desktop-break" /> avec les Hippocampes du Robec.</p>
            <div className="apnea-home-actions">
              <a className="apnea-home-button apnea-home-button-primary" href={siteUrl('/activites/')}>Découvrir nos activités</a>
              <a className="apnea-home-button" href={siteUrl('/le-club/')}>Rencontrer le club</a>
            </div>
          </div>
          <div className="apnea-home-hero-note"><span>Une passion qui nous rassemble</span><strong>Club associatif depuis 2001</strong></div>
        </div>
      </section>

      <div className="apnea-home-meeting"><div className="site-container"><p><MapPin size={19} /><span>{settings.contact.venueShort}</span></p><p>{settings.contact.hoursSummary}</p><a href={siteUrl('/le-club/#contact')}>Préparer une première rencontre</a></div></div>

      <section className="site-container apnea-home-section apnea-home-intro" aria-labelledby="home-club-title">
        <div>
          <p className="apnea-kicker">LE PLAISIR D’ÊTRE ENSEMBLE</p>
          <h2 id="home-club-title">On vient pour l’eau.<br /><span>On reste pour le club.</span></h2>
          <p>Depuis 2001, les Hippocampes du Robec se retrouvent à Darnétal. Des premières découvertes aux sorties en mer, la passion se transmet et les liens se tissent.</p>
          <a className="apnea-home-text-link" href={siteUrl('/le-club/')}>Notre histoire, notre équipe</a>
        </div>
        <figure><img src={mediaUrl('/images/reprise-club-2026.jpg')} alt="Les adhérents équipés de bouteilles et de palmes à la piscine de Darnétal, septembre 2026." width="1600" height="720" loading="lazy" /><figcaption>Retrouvailles à la piscine · septembre 2026</figcaption></figure>
      </section>

      <section className="site-container apnea-home-section apnea-home-practices" aria-labelledby="home-practices-title">
        <div className="apnea-home-section-heading"><div><p className="apnea-kicker">PLUSIEURS FAÇONS DE VIVRE L’EAU</p><h2 id="home-practices-title">À chacun son immersion.</h2></div><a className="apnea-home-text-link" href={siteUrl('/activites/')}>Toutes nos activités</a></div>
        <div className="apnea-home-practice-grid">{practices.map(practice => <a href={siteUrl(practice.href)} key={practice.title} className="apnea-home-practice"><p>{practice.label}</p><h3>{practice.title}</h3><span>{practice.description}</span><strong>Découvrir la pratique</strong></a>)}</div>
      </section>

      <section className="apnea-home-rendezvous" aria-labelledby="home-agenda-title"><div className="site-container apnea-home-agenda-grid">
        <div><p className="apnea-kicker">LA PROCHAINE FOIS, ENSEMBLE</p><h2 id="home-agenda-title">On se retrouve<br /><span>dans l’eau.</span></h2><p>Entraînements, formations et moments du club : les prochains rendez-vous de la saison {settings.season.name}.</p><a className="apnea-home-button" href={siteUrl('/agenda/')}><CalendarDays size={18} />Ouvrir le calendrier</a></div>
        <div className="apnea-home-events">{upcoming.length ? upcoming.map(event => <a className="apnea-home-event" href={siteUrl('/agenda/?month=' + event.date.slice(0, 7))} key={event.id}><time dateTime={event.date}><strong>{event.dateValue}</strong><span>{event.dateLabel}</span></time><div><p>{event.category}{event.status === 'tentative' && <span className="apnea-home-tentative">À confirmer</span>}</p><h3>{event.title}</h3><span>{event.timeLabel}</span></div></a>) : <p>Retrouvez les entraînements et le programme de la saison dans le calendrier.</p>}</div>
      </div></section>

      <section className="site-container apnea-home-section" aria-labelledby="home-news-title">
        <div className="apnea-home-section-heading"><div><p className="apnea-kicker">LE JOURNAL DU CLUB</p><h2 id="home-news-title">À la surface,<br /><span>il s’en passe aussi.</span></h2></div><a className="apnea-home-text-link" href={siteUrl('/actualites/')}>Toutes les actualités</a></div>
        <div className="apnea-home-news-grid">{news.map(item => <a className="apnea-home-news-story" key={item.title + item.url} href={siteUrl(item.url)}><div className="apnea-home-news-image">{item.image ? <img src={mediaUrl(item.image)} alt={item.alt} width="600" height="400" loading="lazy" /> : <Waves size={48} strokeWidth={1.2} />}</div><p className="apnea-home-story-meta">{item.category} · {item.date}</p><h3>{item.title}</h3><p>{item.summary}</p><span className="apnea-home-text-link">Lire le récit</span></a>)}</div>
      </section>

      <section className="site-container apnea-home-invitation"><div><p className="apnea-kicker">LE PREMIER PAS SE FAIT AU BORD DE L’EAU</p><h2>Et si on se rencontrait ?</h2><p>Une question, une envie de découvrir l’apnée ou de faire un baptême ? Parlons-en.</p></div><a className="apnea-home-button apnea-home-button-primary" href={siteUrl('/le-club/#contact')}>Contacter le club</a></section>
    </main>
    <PublicFooter onPrivacy={() => setInfo('privacy')} onSources={() => setInfo('sources')} />
    <dialog ref={infoRef} className="site-dialog site-info-dialog" aria-labelledby="home-info-title" onCancel={() => setInfo(null)} onClick={event => { if (event.target === event.currentTarget) setInfo(null); }}>
      <button className="site-dialog-close" aria-label="Fermer les informations" onClick={() => setInfo(null)}><X /></button>
      <div className="site-dialog-body">{info === 'sources' ? <>
        <p className="apnea-kicker">L’HISTOIRE DU CLUB, PRÉSERVÉE</p><h2 id="home-info-title">Crédits & sources</h2>
        <p>Les fonds sous-marins sont des illustrations décoratives créées pour cette refonte. Ils sont distincts des photographies documentaires du club.</p>
        <p>Les informations, le logo et les photographies des activités proviennent du site des Hippocampes du Robec. Les photos sous-marines et sur le bateau sont des archives de Marseille en 2010. Les photos de reprise, de Némo–Todi et de la sortie en fosse sont datées de 2026.</p>
        <p>Les horaires suivent l’annonce du 5 septembre 2026. Le calendrier de saison a été publié le 24 septembre 2026 ; la sortie à Conflans est confirmée pour le 11 avril 2027.</p>
        <p><a href={siteUrl('/archives/')}>Parcourir les archives</a> · <a href={BLOG} target="_blank" rel="noreferrer">Consulter le blog d’origine</a></p>
        <p>La collection rassemble les pages, récits et albums déjà repris du blog. Les dates et les sources sont conservées ; les informations anciennes peuvent nécessiter une confirmation auprès du club.</p>
      </> : <>
        <p className="apnea-kicker">LES INFORMATIONS DU SITE</p><h2 id="home-info-title">Informations & confidentialité</h2>
        <p>Ce site présente le club à partir de ses informations publiques. Les coordonnées de l’éditeur et les mentions légales complètes doivent être précisées par le club.</p>
        <p>Le formulaire de contact prépare un email sur votre appareil. Il n’enregistre pas son contenu sur ce site. Aucun outil de suivi publicitaire n’est ajouté à ces pages.</p>
        <p>Les demandes d’inscription et les questions personnelles sont à adresser directement au club.</p>
        <a href={'mailto:' + settings.contact.email}>Contacter le club</a>
      </>}</div>
    </dialog>
  </div>;
}
