/** Shared validation for the public CMS fields and the Pages build. */
const fail = (field, message) => { throw new Error(`Réglages du site : ${field} ${message}`); };
function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, 'doit être un objet.');
  return value;
}
function text(value, field, max = 500, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max) fail(field, `doit être un texte${optional ? '' : ' non vide'} de ${max} caractères maximum.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail(field, 'contient un caractère non autorisé.');
  return value.trim();
}
function list(value, field, max, min = 0) {
  if (!Array.isArray(value) || value.length > max || value.length < min) fail(field, `doit contenir entre ${min} et ${max} éléments.`);
  return value;
}
function lines(value, field, max = 8, min = 1, maxLength = 1000) {
  return list(value, field, max, min).map((v, i) => text(v, `${field}[${i}]`, maxLength));
}
function publicUrl(value, field, optional = false) {
  const input = text(value, field, 2000, optional);
  if (!input && optional) return '';
  if (/[\s\\]/u.test(input) || input.startsWith('//')) fail(field, 'doit être un chemin du site ou une adresse HTTPS.');
  let url;
  try { url = new URL(input, 'https://site.invalid'); } catch { fail(field, 'contient une adresse invalide.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (!input.startsWith('/') && !input.startsWith('https://'))) fail(field, 'doit être un chemin du site ou une adresse HTTPS sans identifiants.');
  return input;
}
function imageUrl(value, field) {
  const input = publicUrl(value, field);
  if (input.startsWith('/') && !/^\/(?:images|media)\//.test(input)) fail(field, 'doit désigner une image dans /images/ ou /media/.');
  return input;
}
function dateValue(value, field) {
  const input = text(value, field, 10, true);
  if (!input) return '';
  const date = new Date(`${input}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) fail(field, 'doit être une date valide au format AAAA-MM-JJ.');
  return input;
}
function eventId(value, title, date, index) {
  const id = text(value, `events[${index}].id`, 120, true) || `${title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'evenement'}-${date || index + 1}`;
  if (!/^[a-z0-9][a-z0-9_-]{0,119}$/.test(id)) fail(`events[${index}].id`, 'doit utiliser uniquement des lettres minuscules, chiffres et tirets.');
  return id;
}

export function validateSiteSettings(raw) {
  const data = object(raw, 'contenu');
  const contact = object(data.contact, 'contact');
  const email = text(contact.email, 'contact.email', 180);
  if (!/^[^\s@<>?#%]+@[^\s@<>?#%]+\.[^\s@<>?#%]+$/.test(email)) fail('contact.email', 'doit être une adresse email valide.');
  const season = object(data.season, 'season');
  const club = object(data.club, 'club');
  const ids = new Set();
  return {
    contact: {
      email,
      venue: text(contact.venue, 'contact.venue', 160),
      venueShort: text(contact.venueShort, 'contact.venueShort', 120),
      addressLines: lines(contact.addressLines, 'contact.addressLines', 5, 1, 300),
      accessUrl: publicUrl(contact.accessUrl, 'contact.accessUrl'),
      trainingDays: text(contact.trainingDays, 'contact.trainingDays', 120),
      hoursLines: lines(contact.hoursLines, 'contact.hoursLines', 5, 1, 300),
      hoursSummary: text(contact.hoursSummary, 'contact.hoursSummary', 180),
    },
    season: {
      name: text(season.name, 'season.name', 80),
      calendarImage: imageUrl(season.calendarImage, 'season.calendarImage'),
      agendaNote: text(season.agendaNote, 'season.agendaNote', 1000),
      registrationCaption: text(season.registrationCaption, 'season.registrationCaption', 300),
    },
    club: {
      titleLines: lines(club.titleLines, 'club.titleLines', 3, 1, 160),
      paragraphs: lines(club.paragraphs, 'club.paragraphs', 8, 1, 3000),
    },
    events: list(data.events, 'events', 30).map((value, index) => {
      const event = object(value, `events[${index}]`);
      const field = key => `events[${index}].${key}`;
      const title = text(event.title, field('title'), 220);
      const date = dateValue(event.date, field('date'));
      const id = eventId(event.id, title, date, index);
      if (ids.has(id)) fail(field('id'), 'doit être unique.');
      ids.add(id);
      const day = date ? new Date(`${date}T12:00:00Z`) : null;
      return {
        id, title, date,
        dateLabel: day ? day.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).toLocaleUpperCase('fr-FR') : text(event.dateLabel, field('dateLabel'), 40),
        dateValue: day ? day.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: 'Europe/Paris' }) : text(event.dateValue, field('dateValue'), 24),
        category: text(event.category, field('category'), 100),
        timeLabel: text(event.timeLabel, field('timeLabel'), 160),
        description: text(event.description, field('description'), 1200),
        contactSubject: text(event.contactSubject, field('contactSubject'), 160, true) || title,
        location: text(event.location, field('location'), 300, true),
        calendarDescription: text(event.calendarDescription, field('calendarDescription'), 2000, true),
        sourceUrl: publicUrl(event.sourceUrl, field('sourceUrl'), true),
      };
    }),
    featuredNews: list(data.featuredNews, 'featuredNews', 12).map((value, index) => {
      const item = object(value, `featuredNews[${index}]`);
      const field = key => `featuredNews[${index}].${key}`;
      const category = text(item.category, field('category'), 80);
      if (!['Vie du club', 'Les sorties'].includes(category)) fail(field('category'), 'doit valoir « Vie du club » ou « Les sorties ».');
      return {
        title: text(item.title, field('title'), 220),
        date: text(item.date, field('date'), 80),
        category,
        image: imageUrl(item.image, field('image')),
        alt: text(item.alt, field('alt'), 500, true),
        summary: text(item.summary, field('summary'), 1200),
        url: publicUrl(item.url, field('url')),
      };
    }),
    faq: list(data.faq, 'faq', 20).map((value, index) => {
      const item = object(value, `faq[${index}]`);
      return { question: text(item.question, `faq[${index}].question`, 300), answer: text(item.answer, `faq[${index}].answer`, 3000) };
    }),
  };
}

const icsText = value => String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
// Fold by UTF-8 byte length, as required by iCalendar, preserving accents.
function foldIcsLine(line) {
  const encoder = new TextEncoder();
  let result = '', part = '', bytes = 0;
  for (const char of line) {
    const count = encoder.encode(char).length;
    if (bytes + count > 75) { result += `${part}\r\n`; part = ' '; bytes = 1; }
    part += char;
    bytes += count;
  }
  return result + part;
}

/** Date-only club events use all-day dates, independent of browser timezone. */
export function buildEventCalendar(event, now = new Date()) {
  const date = dateValue(event.date, 'événement.date');
  if (!date) throw new Error('Cet événement ne comporte pas de date à ajouter au calendrier.');
  const end = new Date(`${date}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hippocampes du Robec//Agenda//FR', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${icsText(event.id)}@hippocampes-robec`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText(event.location)}`,
    `DESCRIPTION:${icsText(event.calendarDescription || event.description)}`,
  ];
  if (event.sourceUrl?.startsWith('https://')) lines.push(`URL:${event.sourceUrl}`);
  return [...lines, 'END:VEVENT', 'END:VCALENDAR', ''].map(foldIcsLine).join('\r\n');
}
