'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CalendarRange, Check, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, List, Mail, MapPin, Search, SlidersHorizontal, Waves, X } from 'lucide-react';
import { buildEventCalendar, buildEventsCalendar, type PublicEvent, type PublicSiteSettings } from '../../lib/public-site-content';

type Category = PublicEvent['calendarCategory'];
type CalendarView = 'month' | 'agenda';
type Selection = { kind: 'event'; event: PublicEvent } | { kind: 'day'; date: string; events: PublicEvent[] };

const CATEGORIES: { id: Category; label: string; shortLabel: string }[] = [
  { id: 'piscine', label: 'Piscine & entraînement', shortLabel: 'Piscine' },
  { id: 'formation', label: 'Formations', shortLabel: 'Formation' },
  { id: 'sortie', label: 'Sorties & voyages', shortLabel: 'Sortie' },
  { id: 'club', label: 'La vie du club', shortLabel: 'Vie du club' },
  { id: 'ferie', label: 'Jours fériés', shortLabel: 'Jour férié' },
];
const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const ALL_CATEGORIES = CATEGORIES.map(category => category.id);
const MONTH_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const FULL_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' });
const SHORT_MONTH_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

function asDate(date: string) { return new Date(`${date}T12:00:00Z`); }
function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
function monthStart(month: string) { return `${month}-01`; }
function monthEnd(month: string) {
  const date = asDate(monthStart(month));
  return dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)));
}
function moveMonth(month: string, offset: number) {
  const date = asDate(monthStart(month));
  return dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1, 12))).slice(0, 7);
}
function todayInParis() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}-${parts.find(part => part.type === 'day')?.value}`;
}
function includesDate(event: PublicEvent, day: string) { return event.date <= day && (event.endDate || event.date) >= day; }
function overlapsMonth(event: PublicEvent, month: string) { return event.date <= monthEnd(month) && (event.endDate || event.date) >= monthStart(month); }
function regularDay(event: PublicEvent) {
  const abbreviatedDays: Record<string, string> = { 'LUN.': 'Lundi', 'MAR.': 'Mardi', 'MER.': 'Mercredi', 'JEU.': 'Jeudi', 'VEN.': 'Vendredi', 'SAM.': 'Samedi', 'DIM.': 'Dimanche' };
  return abbreviatedDays[event.dateValue.toUpperCase()] || event.dateValue || event.dateLabel || event.title;
}
function eventDate(event: PublicEvent) {
  if (!event.date) return regularDay(event);
  if (event.endDate && event.endDate !== event.date) {
    const start = asDate(event.date);
    const end = asDate(event.endDate);
    const startFormat = start.getUTCFullYear() === end.getUTCFullYear() ? SHORT_DATE_FORMAT.format(start) : FULL_DATE_FORMAT.format(start);
    return `Du ${startFormat} au ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(end)}`;
  }
  return FULL_DATE_FORMAT.format(asDate(event.date));
}
function eventTime(event: PublicEvent) {
  const clock = (value: string) => value.replace(':', ' h ');
  if (event.startTime) return event.endTime ? `${clock(event.startTime)} – ${clock(event.endTime)}` : `À ${clock(event.startTime)}`;
  if (event.calendarCategory === 'ferie') return 'Journée entière';
  return event.timeLabel && !/^(date confirmée|à confirmer)$/i.test(event.timeLabel.trim()) ? event.timeLabel : 'Horaires à préciser';
}
function statusLabel(status: PublicEvent['status']) {
  return status === 'confirmed' ? 'Confirmé' : status === 'tentative' ? 'À confirmer' : 'Au programme';
}
function categoryLabel(category: Category) { return CATEGORIES.find(item => item.id === category)?.shortLabel || 'Vie du club'; }
function compareEvents(left: PublicEvent, right: PublicEvent) {
  return left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime) || left.title.localeCompare(right.title, 'fr');
}
function downloadCalendar(events: PublicEvent[], filename: string, individual = false) {
  if (!events.length) return;
  const content = individual ? buildEventCalendar(events[0]) : buildEventsCalendar(events);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Status({ event }: { event: PublicEvent }) {
  return <span className={`calendar-status calendar-status-${event.status}`}><span aria-hidden="true" />{statusLabel(event.status)}</span>;
}

function EventRow({ event, open }: { event: PublicEvent; open: (event: PublicEvent, trigger: HTMLElement) => void }) {
  return <button className={`calendar-event-row calendar-category-${event.calendarCategory}`} onClick={click => open(event, click.currentTarget)}>
    <span className="calendar-event-row-marker" aria-hidden="true" />
    <span className="calendar-event-row-content">
      <span className="calendar-event-row-top"><span className="calendar-event-category">{event.category || categoryLabel(event.calendarCategory)}</span><Status event={event} /></span>
      <strong>{event.title}</strong>
      <span className="calendar-event-row-meta"><span><Clock3 size={14} />{eventTime(event)}</span>{event.location && <span><MapPin size={14} />{event.location}</span>}</span>
      {event.endDate && event.endDate !== event.date && <span className="calendar-event-range">{eventDate(event)}</span>}
    </span>
    <ChevronRight className="calendar-event-row-chevron" size={18} aria-hidden="true" />
  </button>;
}

export default function ClubCalendar({ settings }: { settings: PublicSiteSettings }) {
  const [today, setToday] = useState(todayInParis);
  const datedEvents = useMemo(() => settings.events.filter(event => event.date).sort(compareEvents), [settings.events]);
  const firstEventDate = datedEvents[0]?.date;
  const lastEventDate = datedEvents.reduce((latest, event) => {
    const end = event.endDate || event.date;
    return end > latest ? end : latest;
  }, '');
  // Season bounds are optional in older content and can be cleared in the CMS.
  // Keep the calendar usable with the known event range, or the current year.
  const seasonStartDate = settings.season.startDate || firstEventDate || `${today.slice(0, 4)}-01-01`;
  const proposedEndDate = settings.season.endDate || lastEventDate || `${today.slice(0, 4)}-12-31`;
  const seasonEndDate = proposedEndDate < seasonStartDate ? seasonStartDate : proposedEndDate;
  const seasonStart = seasonStartDate.slice(0, 7);
  const seasonEnd = seasonEndDate.slice(0, 7);
  const [month, setMonth] = useState(() => {
    const requestedMonth = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('month') : null;
    if (requestedMonth && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(requestedMonth) && requestedMonth >= seasonStart && requestedMonth <= seasonEnd) return requestedMonth;
    return today >= seasonStartDate && today <= seasonEndDate ? today.slice(0, 7) : seasonStart;
  });
  const [view, setView] = useState<CalendarView>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches ? 'agenda' : 'month');
  const [activeCategories, setActiveCategories] = useState<Category[]>(ALL_CATEGORIES);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [exportNotice, setExportNotice] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const dialogOpen = selection !== null;

  const regularSessions = useMemo(() => settings.events.filter(event => !event.date), [settings.events]);
  const monthEvents = useMemo(() => datedEvents.filter(event => overlapsMonth(event, month)), [datedEvents, month]);
  const visibleEvents = useMemo(() => {
    const search = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
    return monthEvents.filter(event => activeCategories.includes(event.calendarCategory) && (!search || `${event.title} ${event.category} ${event.description} ${event.location}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').includes(search)));
  }, [monthEvents, activeCategories, query]);
  const monthTitle = MONTH_FORMAT.format(asDate(monthStart(month)));
  const filtersActive = activeCategories.length !== CATEGORIES.length || query.trim() !== '';
  const seasonEvents = datedEvents.filter(event => event.date <= seasonEndDate && (event.endDate || event.date) >= seasonStartDate);
  const monthOptions: string[] = [];
  for (let value = seasonStart, count = 0; value <= seasonEnd && count < 36; value = moveMonth(value, 1), count++) monthOptions.push(value);
  if (!monthOptions.includes(month)) monthOptions.push(month);
  monthOptions.sort();

  const firstDay = asDate(monthStart(month));
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - (firstDay.getUTCDay() + 6) % 7);
  const dayCount = asDate(monthEnd(month)).getUTCDate();
  const rowCount = Math.ceil(((firstDay.getUTCDay() + 6) % 7 + dayCount) / 7);
  const weeks = Array.from({ length: rowCount }, (_, week) => Array.from({ length: 7 }, (_, day) => {
    const date = new Date(gridStart);
    date.setUTCDate(date.getUTCDate() + week * 7 + day);
    return dateKey(date);
  }));
  const agendaGroups = useMemo(() => {
    const grouped = new Map<string, PublicEvent[]>();
    visibleEvents.forEach(event => {
      const day = event.date < monthStart(month) ? monthStart(month) : event.date;
      grouped.set(day, [...(grouped.get(day) || []), event]);
    });
    return [...grouped.entries()];
  }, [visibleEvents, month]);

  useEffect(() => {
    const refreshToday = () => setToday(todayInParis());
    window.addEventListener('focus', refreshToday);
    return () => window.removeEventListener('focus', refreshToday);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      const trigger = returnFocusRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [dialogOpen]);

  function openEvent(event: PublicEvent, trigger: HTMLElement) {
    if (!dialogOpen) returnFocusRef.current = trigger;
    setSelection({ kind: 'event', event });
  }
  function openDay(date: string, events: PublicEvent[], trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setSelection({ kind: 'day', date, events });
  }
  function toggleCategory(category: Category) {
    setActiveCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category]);
  }
  function resetFilters() { setActiveCategories(ALL_CATEGORIES); setQuery(''); }
  function exportEvents(events: PublicEvent[], filename: string, label: string, individual = false) {
    downloadCalendar(events, filename, individual);
    setExportNotice(`Le fichier ${label} est prêt. Importez-le dans votre agenda.`);
  }

  return <section className="club-calendar" aria-label={`Calendrier du club, saison ${settings.season.name}`}>
    <div className="calendar-workspace">
      <aside className="calendar-sidebar" aria-label="Filtres et informations du calendrier">
        <div className="calendar-sidebar-heading"><CalendarDays size={20} /><span>Au fil de la saison<small>{settings.season.name}</small></span></div>
        <label className="calendar-month-select-label" htmlFor="calendar-month-select">Aller au mois de</label>
        <select id="calendar-month-select" className="calendar-month-select" value={month} onChange={event => setMonth(event.target.value)}>{monthOptions.map(value => <option value={value} key={value}>{MONTH_FORMAT.format(asDate(monthStart(value)))}</option>)}</select>

        <fieldset className="calendar-filters">
          <legend><SlidersHorizontal size={14} /> À afficher</legend>
          {CATEGORIES.map(category => <label className={`calendar-filter calendar-category-${category.id}`} key={category.id}>
            <input type="checkbox" checked={activeCategories.includes(category.id)} onChange={() => toggleCategory(category.id)} />
            <span className="calendar-filter-check" aria-hidden="true">{activeCategories.includes(category.id) && <Check size={12} strokeWidth={3} />}</span>
            <span>{category.label}</span>
            <small>{monthEvents.filter(event => event.calendarCategory === category.id).length}</small>
          </label>)}
          {activeCategories.length !== CATEGORIES.length && <button className="calendar-reset" onClick={() => setActiveCategories(ALL_CATEGORIES)}>Tout afficher</button>}
        </fieldset>

        {regularSessions.length > 0 && <section className="calendar-regular" aria-labelledby="regular-title">
          <span className="calendar-regular-icon"><Waves size={21} /></span>
          <h2 id="regular-title">Le rendez-vous<br />de la piscine</h2>
          <p className="calendar-regular-location">{settings.contact.venueShort}</p>
          <div className="calendar-regular-list">{regularSessions.map(event => <button key={event.id} onClick={click => openEvent(event, click.currentTarget)}><span>{regularDay(event)}</span><small>{eventTime(event)}</small><ChevronRight size={15} aria-hidden="true" /></button>)}</div>
          <p className="calendar-regular-note">Créneaux habituels. La tenue des séances dépend des encadrants et des périodes de fermeture : contactez le club avant de venir.</p>
        </section>}

        <button className="calendar-season-export" onClick={() => exportEvents(seasonEvents, `hippocampes-saison-${settings.season.name}.ics`, 'de la saison')} disabled={!seasonEvents.length}><Download size={16} /><span>Exporter la saison<small>Toutes les dates · fichier .ics</small></span></button>
      </aside>

      <div className="calendar-main-panel">
        <div className="calendar-toolbar">
          <div className="calendar-toolbar-month"><div className="calendar-month-navigation"><button aria-label="Mois précédent" onClick={() => setMonth(moveMonth(month, -1))}><ChevronLeft size={19} /></button><button aria-label="Mois suivant" onClick={() => setMonth(moveMonth(month, 1))}><ChevronRight size={19} /></button></div><h2 className="calendar-month-title" aria-live="polite">{monthTitle}</h2></div>
          <div className="calendar-toolbar-actions"><button className="calendar-today" onClick={() => setMonth(todayInParis().slice(0, 7))}>Aujourd’hui</button><div className="calendar-view-switch" aria-label="Affichage du calendrier"><button aria-pressed={view === 'month'} onClick={() => setView('month')}><CalendarDays size={15} /><span>Mois</span></button><button aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}><List size={16} /><span>Agenda</span></button></div></div>
        </div>

        <div className="calendar-tools-row">
          <label className="calendar-search"><Search size={16} /><span className="calendar-sr-only">Rechercher dans les rendez-vous du mois</span><input type="search" placeholder="Rechercher un rendez-vous…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Effacer la recherche" onClick={() => setQuery('')}><X size={14} /></button>}</label>
          <button className="calendar-month-export" title="Exporter tous les rendez-vous du mois, y compris les catégories masquées" disabled={!monthEvents.length} onClick={() => exportEvents(monthEvents, `hippocampes-${month}.ics`, `de ${monthTitle}`)}><Download size={15} /><span>Exporter ce mois <small>(.ics)</small></span></button>
        </div>

        <div className="calendar-results-bar"><p aria-live="polite"><strong>{visibleEvents.length}</strong> rendez-vous {filtersActive ? `affiché${visibleEvents.length > 1 ? 's' : ''}` : 'dans le mois'}</p><span><span className="calendar-tentative-dot" /> Pointillés : date à confirmer</span></div>

        {view === 'month' ? <div className="calendar-month-wrap"><table className="calendar-month-table" aria-label={`Calendrier de ${monthTitle}`}>
          <thead><tr>{WEEKDAYS.map(day => <th scope="col" key={day}><abbr title={day}>{day.slice(0, 3)}.</abbr></th>)}</tr></thead>
          <tbody>{weeks.map((week, weekIndex) => <tr key={weekIndex}>{week.map(day => {
            const isCurrentMonth = day.slice(0, 7) === month;
            const events = isCurrentMonth ? visibleEvents.filter(event => includesDate(event, day)) : [];
            const isToday = day === today;
            return <td key={day} className={`${isCurrentMonth ? '' : 'calendar-day-outside'} ${isToday ? 'calendar-day-today' : ''}`}>
              <div className="calendar-day-heading"><span className="calendar-day-number" aria-label={`${FULL_DATE_FORMAT.format(asDate(day))}${isToday ? ', aujourd’hui' : ''}`} aria-current={isToday ? 'date' : undefined}>{Number(day.slice(8))}</span>{isToday && <span className="calendar-today-label">Aujourd’hui</span>}</div>
              <div className="calendar-day-events">{events.slice(0, 3).map(event => <button key={event.id} className={`calendar-event-pill calendar-category-${event.calendarCategory}${event.status === 'tentative' ? ' calendar-event-tentative' : ''}`} onClick={click => openEvent(event, click.currentTarget)} aria-label={`${event.title}, ${FULL_DATE_FORMAT.format(asDate(day))}, ${statusLabel(event.status)}`}><span className="calendar-pill-text">{event.startTime && <span className="calendar-pill-time">{event.startTime} </span>}{event.title}</span>{event.status === 'tentative' && <span className="calendar-pill-status">À confirmer</span>}</button>)}{events.length > 3 && <button className="calendar-more-events" onClick={click => openDay(day, events, click.currentTarget)}>+ {events.length - 3} autre{events.length > 4 ? 's' : ''}</button>}</div>
            </td>;
          })}</tr>)}</tbody>
        </table>{!visibleEvents.length && <div className="calendar-grid-empty"><CalendarRange size={22} /><p>{filtersActive ? 'Aucun rendez-vous ne correspond à ces filtres.' : 'Aucun rendez-vous daté pour ce mois.'}</p>{filtersActive && <button onClick={resetFilters}>Réinitialiser les filtres</button>}</div>}</div> : <div className="calendar-agenda-list" aria-label={`Rendez-vous de ${monthTitle}`}>
          {agendaGroups.length ? agendaGroups.map(([day, events]) => <section className={`calendar-agenda-day${day === today ? ' calendar-agenda-day-today' : ''}`} key={day} aria-label={FULL_DATE_FORMAT.format(asDate(day))}>
            <div className="calendar-agenda-date"><span>{DAY_FORMAT.format(asDate(day))}</span><strong>{Number(day.slice(8))}</strong><small>{SHORT_MONTH_FORMAT.format(asDate(day))}</small>{day === today && <span className="calendar-agenda-today">Aujourd’hui</span>}</div>
            <div className="calendar-agenda-events">{events.map(event => <EventRow event={event} open={openEvent} key={event.id} />)}</div>
          </section>) : <div className="calendar-list-empty"><CalendarRange size={35} /><h3>{filtersActive ? 'Aucun rendez-vous trouvé' : 'Un mois encore libre'}</h3><p>{filtersActive ? 'Essayez une autre recherche ou affichez toutes les catégories.' : 'Aucune date n’est inscrite au programme pour ce mois. Les créneaux habituels de piscine figurent dans l’encart dédié.'}</p>{filtersActive ? <button className="calendar-outline-button" onClick={resetFilters}>Réinitialiser les filtres</button> : <button className="calendar-outline-button" onClick={() => setMonth(seasonStart)}>Revenir au début de la saison</button>}</div>}
        </div>}

        <div className="calendar-bottom-note"><span className="calendar-note-dot" aria-hidden="true" /><p>{settings.season.agendaNote || 'Le programme peut évoluer. Contactez le club pour confirmer votre participation.'}</p></div>
      </div>
    </div>
    <p className="calendar-export-notice" role="status">{exportNotice}</p>

    <dialog className="club-calendar-dialog" ref={dialogRef} aria-labelledby="calendar-dialog-title" onCancel={event => { event.preventDefault(); setSelection(null); }} onClick={event => { if (event.target === event.currentTarget) setSelection(null); }}>
      <div className={`calendar-dialog-content${selection?.kind === 'event' ? ` calendar-category-${selection.event.calendarCategory}` : ''}`}>
        <button className="calendar-dialog-close" ref={closeRef} aria-label="Fermer les détails" onClick={() => setSelection(null)}><X size={21} /></button>
        {selection?.kind === 'event' ? <>
          <div className="calendar-dialog-eyebrow"><span className="calendar-event-category">{selection.event.category || categoryLabel(selection.event.calendarCategory)}</span>{selection.event.date ? <Status event={selection.event} /> : <span className="calendar-regular-badge">Créneau habituel</span>}</div>
          <h2 id="calendar-dialog-title">{selection.event.title}</h2>
          <div className="calendar-dialog-facts">
            <div><CalendarDays size={19} /><span>{selection.event.date ? eventDate(selection.event) : `${regularDay(selection.event)} · créneau habituel`}</span></div>
            <div><Clock3 size={19} /><span>{eventTime(selection.event)}</span></div>
            {selection.event.location && <div><MapPin size={19} /><span>{selection.event.location}</span></div>}
          </div>
          <p className="calendar-dialog-description">{selection.event.description}</p>
          {selection.event.status === 'tentative' && <p className="calendar-dialog-warning">Cette date reste à confirmer par le club. Vérifiez le programme avant de prévoir votre déplacement.</p>}
          {!selection.event.date && <p className="calendar-dialog-warning">Ce créneau indique les horaires habituels. Il ne confirme pas une séance à une date précise : la présence des encadrants et les fermetures peuvent modifier le programme.</p>}
          <div className="calendar-dialog-actions">{selection.event.date && <button className="calendar-primary-button" onClick={() => exportEvents([selection.event], `hippocampes-${selection.event.id}.ics`, 'du rendez-vous', true)}><Download size={16} /> Ajouter à mon agenda (.ics)</button>}<a className="calendar-outline-button" href={`mailto:${settings.contact.email}?subject=${encodeURIComponent(selection.event.contactSubject || selection.event.title)}`}><Mail size={16} /> Contacter le club</a></div>
          {selection.event.date && <p className="calendar-ics-hint">Fichier à importer dans Google Agenda, Apple Calendrier ou Outlook. Les mises à jour du programme ne sont pas synchronisées automatiquement.</p>}
          {selection.event.sourceUrl && <a className="calendar-source-link" href={selection.event.sourceUrl} target="_blank" rel="noopener noreferrer">Consulter la publication du club <ExternalLink size={13} /><span className="calendar-sr-only"> (nouvel onglet)</span></a>}
        </> : selection?.kind === 'day' ? <>
          <p className="calendar-dialog-eyebrow">LES RENDEZ-VOUS DU JOUR</p><h2 id="calendar-dialog-title">{FULL_DATE_FORMAT.format(asDate(selection.date))}</h2><div className="calendar-dialog-day-events">{selection.events.map(event => <EventRow event={event} open={openEvent} key={event.id} />)}</div>
        </> : null}
      </div>
    </dialog>
  </section>;
}
