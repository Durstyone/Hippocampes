import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSiteSettings, buildEventCalendar, buildEventsCalendar } from '../lib/public-site-settings.mjs';

const source = JSON.parse(await readFile(new URL('../github-pages/content/site-settings.json', import.meta.url), 'utf8'));
const now = new Date('2026-11-27T12:00:00Z');
const fixture = overrides => ({
  id: 'rendez-vous', title: 'Rendez-vous du club', date: '2027-01-10',
  category: 'Formation N2', description: 'Programme du club.', ...overrides,
});
const settings = events => validateSiteSettings({
  ...source, season: { ...source.season, startDate: '2026-09-01', endDate: '2027-08-31' }, events,
});
const event = overrides => settings([fixture(overrides)]).events[0];
const exportEvent = overrides => buildEventCalendar(event(overrides), now);

// Legacy entries retain their display fields; new calendar fields are normalized.
const legacy = event({ date: '', dateLabel: 'CHAQUE', dateValue: 'MAR.', category: 'Piscine', timeLabel: '20h15 – 22h30' });
assert.equal(legacy.calendarCategory, 'piscine');
assert.equal(legacy.status, 'scheduled');
assert.equal(legacy.startTime, '');
assert.equal(legacy.endTime, '');
assert.equal(legacy.endDate, '');
assert.equal(event().timeLabel, 'Horaire à préciser');
assert.equal(event().calendarCategory, 'formation');

// Inclusive dates become an exclusive ICS end, including month/year boundaries.
assert.match(exportEvent({ date: '2027-04-30' }), /DTEND;VALUE=DATE:20270501\r\n/);
const multiDay = exportEvent({ date: '2026-12-31', endDate: '2027-01-02', status: 'tentative' });
assert.match(multiDay, /DTSTART;VALUE=DATE:20261231\r\n/);
assert.match(multiDay, /DTEND;VALUE=DATE:20270103\r\n/);
assert.match(multiDay, /STATUS:TENTATIVE\r\n/);

// UTC exports reflect Paris summer/winter offsets and never invent a duration.
const winter = exportEvent({ startTime: '19:30' });
assert.match(winter, /DTSTART:20270110T183000Z\r\n/);
assert.doesNotMatch(winter, /DTEND/);
assert.doesNotMatch(winter, /STATUS:CONFIRMED/);
assert.match(exportEvent({ date: '2027-07-10', startTime: '19:30', status: 'confirmed' }), /DTSTART:20270710T173000Z\r\n/);
assert.match(exportEvent({ status: 'confirmed' }), /STATUS:CONFIRMED\r\n/);
const overnight = exportEvent({ date: '2027-03-27', endDate: '2027-03-28', startTime: '19:30', endTime: '08:00' });
assert.match(overnight, /DTSTART:20270327T183000Z\r\n/);
assert.match(overnight, /DTEND:20270328T060000Z\r\n/);
assert.throws(() => event({ date: '2027-03-28', startTime: '02:30' }), /n’existe pas/);
assert.throws(() => event({ date: '2026-10-25', startTime: '02:30' }), /ambiguë/);

// Invalid schedules fail during content validation, before publication.
assert.throws(() => event({ date: '2027-02-29' }), /date valide/);
assert.throws(() => event({ startTime: '24:00' }), /heure valide/);
assert.throws(() => event({ startTime: '9:30' }), /heure valide/);
assert.throws(() => event({ startTime: '19:30', endTime: '18:00' }), /postérieure/);
assert.throws(() => event({ endTime: '22:00' }), /heure de début/);
assert.throws(() => event({ endDate: '2027-01-09' }), /postérieure/);
assert.throws(() => event({ endDate: '2027-09-01' }), /saison/);
assert.throws(() => settings([fixture(), fixture()]), /unique/);
assert.equal(settings(Array.from({ length: 150 }, (_, i) => fixture({ id: `rendez-vous-${i}` }))).events.length, 150);
assert.throws(() => settings(Array.from({ length: 151 }, (_, i) => fixture({ id: `rendez-vous-${i}` }))), /150/);

// A season export excludes habitual slots, and holidays remain transparent markers.
const calendar = buildEventsCalendar([legacy, event({ calendarCategory: 'ferie' })], now);
assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 1);
assert.match(calendar, /TRANSP:TRANSPARENT\r\n/);
assert.throws(() => buildEventCalendar(legacy, now), /ne comporte pas de date/);
assert.equal((buildEventsCalendar([legacy], now).match(/BEGIN:VEVENT/g) || []).length, 0);

// Folding counts UTF-8 bytes, without breaking accents or escaped text.
const folded = exportEvent({ title: `Réunion, ${'été 🌊 '.repeat(20)}`, description: 'Info, suite; ligne\nDeuxième \\ partie' });
for (const line of folded.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
const unfolded = folded.replace(/\r\n /g, '');
assert.ok(unfolded.includes(`SUMMARY:Réunion\\, ${'été 🌊 '.repeat(20).trim()}`));
assert.ok(unfolded.includes('DESCRIPTION:Info\\, suite\\; ligne\\nDeuxième \\\\ partie'));
assert.ok(folded.endsWith('END:VCALENDAR\r\n'));
console.log('Calendrier : validation, créneaux sans date, export ICS, fuseau Paris et UTF-8 vérifiés.');
