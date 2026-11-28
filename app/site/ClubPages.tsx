'use client';

import { Fragment, useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Clock3, Copy, FileText, Mail, MapPin, ShieldCheck, Users, Waves } from 'lucide-react';
import { clubPortalUrl, mediaUrl, siteUrl } from '../../lib/site-delivery';
import { publicSiteSettings as settings } from '../../lib/public-site-content';
import archiveHome from './archive-links.json';
import { PublicHeader, PublicFooter } from './PublicLayout';
import './club-pages.css';

const EMAIL = settings.contact.email;
const CONTACT_SUBJECTS = [
  'Découvrir l’apnée', 'Faire un baptême de plongée', 'Découvrir la plongée',
  'Rejoindre le club', 'Reprendre la plongée', 'Me renseigner sur les entraînements',
  'Me renseigner sur les formations', 'Participer à une sortie', 'La vie du club', 'Autre question',
];

function contactHref(subject: string) {
  return siteUrl('/le-club/') + '?sujet=' + encodeURIComponent(subject) + '#contact';
}

function ContactSection() {
  const [subject, setSubject] = useState('Rejoindre le club');
  const [mailPrepared, setMailPrepared] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const requestedSubject = new URLSearchParams(window.location.search).get('sujet');
    if (requestedSubject && requestedSubject.length <= 160) setSubject(requestedSubject);
  }, []);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopyStatus('Adresse copiée');
    } catch {
      setCopyStatus('Vous pouvez sélectionner l’adresse ci-dessus pour la copier.');
    }
  }

  function prepareEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = `Bonjour les Hippocampes,\n\n${form.get('message')}\n\nNom : ${form.get('name')}\nEmail : ${form.get('email')}\nIntérêt : ${subject}\n\nÀ bientôt !`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject + ' — Prise de contact')}&body=${encodeURIComponent(body)}`;
    setMailPrepared(true);
  }

  return <section className="cp-contact" id="contact" aria-labelledby="contact-title">
    <div className="cp-container cp-contact-grid">
      <div className="cp-contact-copy">
        <p className="cp-kicker">RENCONTRONS-NOUS</p>
        <h2 id="contact-title">On commence<br/>par un bonjour.</h2>
        <p>Une envie de découvrir l’apnée, un premier baptême ou une reprise ? Écrivez-nous pour préparer votre venue.</p>
        <div className="cp-contact-detail"><MapPin aria-hidden="true"/><div>
          <strong>{settings.contact.venue}</strong>
          <p>{settings.contact.addressLines.map((line, index) => <Fragment key={line}>{index > 0 && <br/>}{line}</Fragment>)}</p>
          <a href={siteUrl(settings.contact.accessUrl)} target="_blank" rel="noreferrer">Consulter les informations d’accès</a>
        </div></div>
        <div className="cp-contact-detail"><Clock3 aria-hidden="true"/><div>
          <strong>{settings.contact.trainingDays}</strong>
          <p>{settings.contact.hoursLines.map((line, index) => <Fragment key={line}>{index > 0 && <br/>}{line}</Fragment>)}</p>
        </div></div>
        <div className="cp-contact-detail"><Mail aria-hidden="true"/><div>
          <a className="cp-email" href={'mailto:' + EMAIL}>{EMAIL}</a>
          <button className="cp-copy" type="button" onClick={copyEmail}>{copyStatus === 'Adresse copiée' ? <Check size={16}/> : <Copy size={16}/>}Copier l’adresse</button>
          {copyStatus && <p className="cp-small" role="status">{copyStatus}</p>}
        </div></div>
      </div>
      <form className="cp-contact-form" onSubmit={prepareEmail}>
        <h3>Préparons votre rencontre.</h3>
        <p>Quelques mots sur vous, votre expérience et vos envies.</p>
        <div className="cp-form-row">
          <label>Votre nom<input name="name" autoComplete="name" required maxLength={100} placeholder="Prénom et nom"/></label>
          <label>Votre email<input name="email" type="email" autoComplete="email" required maxLength={180} placeholder="vous@exemple.fr"/></label>
        </div>
        <label>J’aimerais…<span className="cp-select"><select name="interest" value={subject} onChange={event => setSubject(event.target.value)}>{Array.from(new Set([...CONTACT_SUBJECTS, subject])).map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={18} aria-hidden="true"/></span></label>
        <label>Votre message<textarea name="message" rows={5} required maxLength={3000} placeholder="Présentez-vous et posez vos questions…"/></label>
        <button className="cp-button cp-button-primary" type="submit"><Mail size={18} aria-hidden="true"/>Préparer mon email</button>
        <p className="cp-form-note">Ce formulaire ouvre votre messagerie. Relisez le message, puis envoyez-le depuis celle-ci. Son contenu n’est pas enregistré sur le site.</p>
        {mailPrepared && <p className="cp-form-feedback" role="status">Le message est préparé. Si votre messagerie ne s’ouvre pas, écrivez à <a href={'mailto:' + EMAIL}>{EMAIL}</a>.</p>}
      </form>
    </div>
  </section>;
}

export function ClubPage() {
  const resources = [
    { href: archiveHome.links.registration, title: 'Le dossier d’inscription', detail: settings.season.registrationCaption, icon: FileText },
    { href: archiveHome.links.team, title: 'L’équipe du club', detail: 'Les personnes qui font vivre l’association.', icon: Users },
    { href: archiveHome.links.rules, title: 'Le règlement intérieur', detail: 'Les repères pour vivre le club ensemble.', icon: ShieldCheck },
    { href: archiveHome.links.statutes, title: 'Les statuts de l’association', detail: 'Le fonctionnement des Hippocampes du Robec.', icon: FileText },
    { href: archiveHome.links.tiv, title: 'La documentation TIV', detail: 'Les ressources techniques conservées dans les archives.', icon: FileText },
  ];

  return <div className="site-page apnea-page club-page">
    <a className="site-skip" href="#contenu">Aller au contenu</a>
    <PublicHeader current="club"/>
    <main id="contenu">
      <section className="cp-club-hero">
        <div className="cp-container">
          <nav className="cp-breadcrumb" aria-label="Fil d’Ariane"><a href={siteUrl('/')}>Accueil</a><span aria-hidden="true">/</span><span>Le club</span></nav>
          <div className="cp-club-intro">
            <div>
              <p className="cp-kicker">LES HIPPOCAMPES DU ROBEC · DARNÉTAL</p>
              <h1>{settings.club.titleLines.map((line, index) => <Fragment key={index}>{index > 0 && <br/>}{index === settings.club.titleLines.length - 1 ? <em>{line}</em> : line}</Fragment>)}</h1>
              <p className="cp-lead">Une association, des rencontres et le plaisir de se retrouver dans l’eau. Près de Rouen, les Hippocampes partagent bien plus que leurs entraînements.</p>
              <a className="cp-button cp-button-primary" href="#contact"><Mail size={18} aria-hidden="true"/>Rencontrer le club</a>
            </div>
            <figure className="cp-club-photo">
              <img src={mediaUrl('/images/reprise-club-2026.jpg')} alt="Les adhérents des Hippocampes du Robec réunis à la piscine de Darnétal pour la reprise de septembre 2026." width="1600" height="720" fetchPriority="high"/>
              <figcaption><span>Les visages du club</span>Reprise à la piscine · septembre 2026</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="cp-story cp-container" aria-labelledby="story-title">
        <div className="cp-story-label"><p className="cp-kicker">UNE HISTOIRE COLLECTIVE</p><h2 id="story-title">Depuis 2001,<br/>l’eau nous rassemble.</h2><a className="cp-text-link" href={siteUrl(archiveHome.links.history)}>Découvrir notre histoire</a></div>
        <div className="cp-story-copy">{settings.club.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<div className="cp-values"><span>L’esprit associatif</span><span>La transmission</span><span>La convivialité</span></div><p className="cp-affiliation">Club affilié à la FFESSM · Darnétal, Normandie</p></div>
      </section>

      <section className="cp-rendezvous" aria-labelledby="rendezvous-title">
        <div className="cp-container cp-rendezvous-inner">
          <div><p className="cp-kicker">NOTRE POINT DE RENCONTRE</p><h2 id="rendezvous-title">{settings.contact.venueShort}</h2><p>{settings.contact.addressLines.join(' · ')}</p></div>
          <div className="cp-rendezvous-time"><Clock3 aria-hidden="true"/><div><strong>{settings.contact.trainingDays}</strong>{settings.contact.hoursLines.map(line => <span key={line}>{line}</span>)}</div></div>
          <a className="cp-button cp-button-outline" href={siteUrl('/agenda/')}><CalendarDays size={18} aria-hidden="true"/>Les rendez-vous du club</a>
        </div>
      </section>

      <section className="cp-membership cp-container" id="rejoindre" aria-labelledby="membership-title">
        <div className="cp-membership-intro"><p className="cp-kicker">REJOINDRE LES HIPPOCAMPES</p><h2 id="membership-title">Le premier pas<br/>se fait ensemble.</h2><p>Une question, un baptême ou une envie de reprendre ? Contactez le club pour choisir votre activité et préparer votre inscription.</p><p>Retrouvez ici les documents et les informations de l’association pour la saison {settings.season.name}.</p><a className="cp-text-link" href={siteUrl('/activites/')}>Découvrir les activités</a>{clubPortalUrl && <a className="cp-member-access" href={clubPortalUrl}><Users size={22} aria-hidden="true"/><span><strong>Déjà membre ?</strong>Retrouver l’espace club</span></a>}</div>
        <div className="cp-resource-list">{resources.map(resource => <a key={resource.href} href={siteUrl(resource.href)} className="cp-resource"><resource.icon size={22} aria-hidden="true"/><span><strong>{resource.title}</strong><small>{resource.detail}</small></span><span className="cp-resource-open">Consulter</span></a>)}<a className="cp-resource-all" href={siteUrl('/archives?type=page')}>Tous les documents et les pages du club</a></div>
      </section>

      <section className="cp-questions cp-container" aria-labelledby="questions-title">
        <div><p className="cp-kicker">AVANT DE NOUS REJOINDRE</p><h2 id="questions-title">Vos premières<br/>questions.</h2></div>
        <div className="cp-faq">{settings.faq.map(({ question, answer }, index) => <details key={question} open={index === 0 ? true : undefined}><summary>{question}<ChevronDown size={20} aria-hidden="true"/></summary><p>{answer.replace('ci-dessous', 'sur cette page')}</p>{question === 'Comment rejoindre le club ?' && <a className="cp-text-link" href={siteUrl(archiveHome.links.registration)}>Ouvrir le dossier d’inscription</a>}</details>)}</div>
      </section>
      <ContactSection/>
    </main>
    <PublicFooter/>
  </div>;
}

export function ActivitiesPage() {
  return <div className="site-page apnea-page activities-page">
    <a className="site-skip" href="#contenu">Aller au contenu</a>
    <PublicHeader current="activities"/>
    <main id="contenu">
      <section className="cp-activities-hero cp-container">
        <nav className="cp-breadcrumb" aria-label="Fil d’Ariane"><a href={siteUrl('/')}>Accueil</a><span aria-hidden="true">/</span><span>Nos activités</span></nav>
        <p className="cp-kicker">APNÉE · PLONGÉE · EXPLORATION</p>
        <div className="cp-activities-heading"><h1>À chacun<br/><em>son immersion.</em></h1><p className="cp-lead">Prendre le temps sous l’eau, découvrir la plongée, partir ensemble. Trois façons de vivre notre passion, avec le même esprit de club.</p></div>
      </section>

      <section className="cp-activity cp-container cp-activity-apnea" id="apnee" aria-labelledby="apnea-title">
        <div className="cp-apnea-visual" aria-hidden="true"><div><Waves size={38} strokeWidth={1}/><span>Prendre le temps.<br/>Ressentir l’eau.</span></div></div>
        <div className="cp-activity-copy"><p className="cp-kicker">LE CALME, LES SENSATIONS</p><h2 id="apnea-title">Apnée<br/>& palmes.</h2><p className="cp-activity-lead">Une autre manière de vivre l’eau.</p><p>Les séances du club accueillent la pratique de l’apnée et l’entraînement avec palmes, masque et tuba. Prendre le temps, travailler ses sensations et partager les entraînements en piscine, dans un cadre collectif.</p><div className="cp-activity-note"><strong>En pratique</strong><p>Le programme du mardi dépend des encadrants présents. Contactez le club pour connaître les séances adaptées à votre pratique.</p></div><a className="cp-button cp-button-primary" href={contactHref('Découvrir l’apnée')}>Découvrir l’apnée au club</a></div>
      </section>

      <section className="cp-activity cp-container cp-activity-bottle" id="plongee" aria-labelledby="bottle-title">
        <div className="cp-activity-copy"><p className="cp-kicker">DÉCOUVRIR & PROGRESSER</p><h2 id="bottle-title">Plongée<br/>bouteille.</h2><p className="cp-activity-lead">Du premier souffle aux nouvelles aventures.</p><p>Envie de découvrir les sensations de la plongée ? Le club propose des baptêmes en piscine ainsi que des formations aux niveaux 1, 2 et 3.</p><p>Les entraînements permettent de découvrir le matériel, de prendre ses repères et de progresser avec les encadrants, à son rythme.</p><div className="cp-activity-note"><strong>Pour commencer</strong><p>Pour un baptême ou une inscription, contactez le club afin de convenir d’une séance et de connaître les conditions d’accueil.</p></div><a className="cp-button cp-button-outline" href={contactHref('Faire un baptême de plongée')}>Préparer mon baptême</a></div>
        <figure className="cp-activity-photo"><img src={mediaUrl('/images/plongee-sous-marine.jpg')} alt="Plongeur en combinaison noire et masque jaune en immersion au large de Marseille." width="800" height="600" loading="lazy"/><figcaption>Marseille · archives du club, 2010</figcaption></figure>
      </section>

      <section className="cp-outings" id="sorties" aria-labelledby="outings-title">
        <div className="cp-container"><div className="cp-outings-heading"><div><p className="cp-kicker">EXPLORER & PARTAGER</p><h2 id="outings-title">L’appel du large.<br/><em>Et le plaisir d’être ensemble.</em></h2></div><p>Fosses, mer et voyages : on se retrouve aussi loin du bord de la piscine.</p></div>
          <div className="cp-outings-grid"><figure className="cp-outing-main"><img src={mediaUrl('/images/sortie-en-mer.jpg')} alt="Des plongeurs des Hippocampes du Robec équipés sur un bateau à Marseille." width="800" height="600" loading="lazy"/><figcaption>Sur le bateau · Marseille, 2010</figcaption></figure><div className="cp-outings-copy"><p>Le club organise des sorties en fosse, des plongées en milieu naturel et des voyages. Les archives racontent des moments à Marseille, à Némo et à Todi, entre apprentissage, découverte et convivialité.</p><p>Les projets et les dates se précisent au fil de la saison. Retrouvez les prochaines sorties dans l’agenda du club.</p><div className="cp-inline-links"><a className="cp-text-link" href={siteUrl('/agenda/')}>Voir les prochaines sorties</a><a className="cp-text-link" href={siteUrl('/archives?type=album')}>Parcourir les albums</a></div><figure className="cp-outing-small"><img src={mediaUrl('/images/sortie-nemo-2026.jpg')} alt="Le groupe des Hippocampes du Robec devant un petit sous-marin jaune lors de la sortie Némo et Todi." width="1600" height="1200" loading="lazy"/><figcaption>Todi & Némo · mars 2026</figcaption></figure></div></div>
        </div>
      </section>

      <section className="cp-activity-close cp-container"><Waves size={32} strokeWidth={1.5} aria-hidden="true"/><div><p className="cp-kicker">À VOTRE RYTHME</p><h2>Votre prochaine immersion<br/>commence par une rencontre.</h2><p>Dites-nous ce qui vous attire et ce que vous avez envie de découvrir.</p></div><a className="cp-button cp-button-primary" href={contactHref('Me renseigner sur les entraînements')}>Échanger avec le club</a></section>
    </main>
    <PublicFooter/>
  </div>;
}
