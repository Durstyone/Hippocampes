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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || input.startsWith('0000') || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) fail(field, 'doit être une date valide au format AAAA-MM-JJ.');
  return input;
}
function timeValue(value, field) {
  const input = text(value, field, 5, true);
  if (input && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input)) fail(field, 'doit être une heure valide au format HH:MM.');
  return input;
}
function choice(value, field, allowed, fallback) {
  const input = text(value, field, 30, true) || fallback;
  if (!allowed.includes(input)) fail(field, `doit valoir ${allowed.join(', ')}.`);
  return input;
}
function inferredCategory(category) {
  const label = category.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/ferie/.test(label)) return 'ferie';
  if (/piscine/.test(label)) return 'piscine';
  if (/formation|theorie|niveau/.test(label)) return 'formation';
  if (/sortie|voyage|fosse/.test(label)) return 'sortie';
  return 'club';
}

// Convert an explicitly entered Paris wall time with the runtime's IANA rules.
// Verifying every candidate avoids silently shifting a missing DST hour or
// choosing one of the two occurrences of an ambiguous autumn hour.
const parisFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function parisWallTime(timestamp) {
  const parts = Object.fromEntries(parisFormatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
function parisTimeToUtc(date, time, field) {
  const requested = `${date}T${time}:00`;
  const wall = Date.parse(`${requested}Z`);
  const offsets = new Set([-86400000, 0, 86400000].map(delta => {
    const sample = wall + delta;
    return Date.parse(`${parisWallTime(sample)}Z`) - sample;
  }));
  const matches = [...offsets].map(offset => wall - offset).filter(candidate => parisWallTime(candidate) === requested);
  if (matches.length !== 1) fail(field, matches.length ? 'est ambiguë lors du changement d’heure à Paris. Choisissez une heure non ambiguë.' : 'n’existe pas lors du changement d’heure à Paris.');
  return new Date(matches[0]);
}
function eventSchedule(event, field) {
  const date = dateValue(event.date, field('date'));
  const endDate = dateValue(event.endDate, field('endDate'));
  const startTime = timeValue(event.startTime, field('startTime'));
  const endTime = timeValue(event.endTime, field('endTime'));
  if (endDate && !date) fail(field('endDate'), 'nécessite une date de début.');
  if (endDate && endDate < date) fail(field('endDate'), 'doit être égale ou postérieure à la date de début.');
  if (endTime && !startTime) fail(field('endTime'), 'nécessite une heure de début.');
  if (endTime && (!endDate || endDate === date) && endTime <= startTime) fail(field('endTime'), 'doit être postérieure à l’heure de début ; pour une fin le lendemain, renseignez aussi la date de fin.');
  if (date && startTime) parisTimeToUtc(date, startTime, field('startTime'));
  if (date && endTime) parisTimeToUtc(endDate || date, endTime, field('endTime'));
  return { date, endDate, startTime, endTime };
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
  const seasonStart = dateValue(season.startDate, 'season.startDate');
  const seasonEnd = dateValue(season.endDate, 'season.endDate');
  if (Boolean(seasonStart) !== Boolean(seasonEnd)) fail('season', 'doit indiquer ensemble sa date de début et sa date de fin.');
  if (seasonStart && seasonEnd < seasonStart) fail('season.endDate', 'doit être égale ou postérieure à la date de début.');
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
      startDate: seasonStart,
      endDate: seasonEnd,
      calendarImage: imageUrl(season.calendarImage, 'season.calendarImage'),
      agendaNote: text(season.agendaNote, 'season.agendaNote', 1000),
      registrationCaption: text(season.registrationCaption, 'season.registrationCaption', 300),
    },
    club: {
      titleLines: lines(club.titleLines, 'club.titleLines', 3, 1, 160),
      paragraphs: lines(club.paragraphs, 'club.paragraphs', 8, 1, 3000),
    },
    events: list(data.events, 'events', 150).map((value, index) => {
      const event = object(value, `events[${index}]`);
      const field = key => `events[${index}].${key}`;
      const title = text(event.title, field('title'), 220);
      const schedule = eventSchedule(event, field);
      const { date, endDate, startTime, endTime } = schedule;
      if (date && seasonStart && (date < seasonStart || date > seasonEnd)) fail(field('date'), 'doit se trouver dans les dates de la saison.');
      if (endDate && seasonStart && endDate > seasonEnd) fail(field('endDate'), 'doit se trouver dans les dates de la saison.');
      const id = eventId(event.id, title, date, index);
      if (ids.has(id)) fail(field('id'), 'doit être unique.');
      ids.add(id);
      const day = date ? new Date(`${date}T12:00:00Z`) : null;
      const category = text(event.category, field('category'), 100);
      const calendarCategory = choice(event.calendarCategory, field('calendarCategory'), ['piscine', 'formation', 'sortie', 'club', 'ferie'], inferredCategory(category));
      const status = choice(event.status, field('status'), ['scheduled', 'confirmed', 'tentative'], 'scheduled');
      const timeLabel = text(event.timeLabel, field('timeLabel'), 160, true) || (startTime ? `${startTime.replace(':', 'h')}${endTime ? ` – ${endTime.replace(':', 'h')}` : ''}` : calendarCategory === 'ferie' ? 'Repère du calendrier' : 'Horaire à préciser');
      return {
        id, title, ...schedule,
        dateLabel: day ? day.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).toLocaleUpperCase('fr-FR') : text(event.dateLabel, field('dateLabel'), 40),
        dateValue: day ? day.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: 'Europe/Paris' }) : text(event.dateValue, field('dateValue'), 24),
        category, calendarCategory, status, timeLabel,
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

const icsTimestamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
function calendarEventLines(event, now) {
  const field = key => `événement.${key}`;
  const { date, endDate, startTime, endTime } = eventSchedule(object(event, 'événement'), field);
  if (!date) throw new Error('Cet événement ne comporte pas de date à ajouter au calendrier.');
  const title = text(event.title, field('title'), 220);
  const id = eventId(event.id, title, date, 0);
  const status = choice(event.status, field('status'), ['scheduled', 'confirmed', 'tentative'], 'scheduled');
  const category = choice(event.calendarCategory, field('calendarCategory'), ['piscine', 'formation', 'sortie', 'club', 'ferie'], inferredCategory(event.category || ''));
  const result = ['BEGIN:VEVENT', `UID:${id}@hippocampes-robec`, `DTSTAMP:${icsTimestamp(now)}`];
  if (startTime) {
    // UTC is unambiguous in every importing application. Conversion above uses
    // Europe/Paris rules for the event date, including summer/winter changes.
    result.push(`DTSTART:${icsTimestamp(parisTimeToUtc(date, startTime, field('startTime')))}`);
    if (endTime) result.push(`DTEND:${icsTimestamp(parisTimeToUtc(endDate || date, endTime, field('endTime')))}`);
  } else {
    const exclusiveEnd = new Date(`${endDate || date}T12:00:00Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    result.push(`DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${exclusiveEnd.toISOString().slice(0, 10).replace(/-/g, '')}`);
  }
  result.push(`SUMMARY:${icsText(title)}`);
  const location = text(event.location, field('location'), 300, true);
  if (location) result.push(`LOCATION:${icsText(location)}`);
  const description = text(event.calendarDescription || event.description, field('description'), 2000, true);
  if (description) result.push(`DESCRIPTION:${icsText(description)}`);
  if (status !== 'scheduled') result.push(`STATUS:${status === 'tentative' ? 'TENTATIVE' : 'CONFIRMED'}`);
  // A public holiday is a marker, not a club closure or a busy appointment.
  if (category === 'ferie') result.push('TRANSP:TRANSPARENT');
  const sourceUrl = publicUrl(event.sourceUrl, field('sourceUrl'), true);
  if (sourceUrl.startsWith('https://')) result.push(`URL:${sourceUrl}`);
  return [...result, 'END:VEVENT'];
}

/** Export dated entries only. Habitual, undated slots never become occurrences. */
export function buildEventsCalendar(events, now = new Date()) {
  const dated = list(events, 'événements à exporter', 150).filter(event => dateValue(object(event, 'événement').date, 'événement.date'));
  const ids = new Set();
  const entries = dated.flatMap(event => {
    const entry = calendarEventLines(event, now);
    const uid = entry[1];
    if (ids.has(uid)) fail('événement.id', 'doit être unique dans le calendrier.');
    ids.add(uid);
    return entry;
  });
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hippocampes du Robec//Agenda//FR',
    'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Les Hippocampes du Robec', 'X-WR-TIMEZONE:Europe/Paris',
    ...entries, 'END:VCALENDAR', '',
  ].map(foldIcsLine).join('\r\n');
}

/** Export one dated event; unlike the season export, undated entries are rejected. */
export function buildEventCalendar(event, now = new Date()) {
  if (!dateValue(object(event, 'événement').date, 'événement.date')) throw new Error('Cet événement ne comporte pas de date à ajouter au calendrier.');
  return buildEventsCalendar([event], now);
}
