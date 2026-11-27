export interface PublicEvent {
  id: string;
  title: string;
  date: string;
  /** Inclusive last day; empty when no separate end date is supplied. */
  endDate: string;
  /** Local Europe/Paris times in HH:MM; empty when not known. */
  startTime: string;
  endTime: string;
  dateLabel: string;
  dateValue: string;
  category: string;
  calendarCategory: 'piscine' | 'formation' | 'sortie' | 'club' | 'ferie';
  status: 'scheduled' | 'confirmed' | 'tentative';
  timeLabel: string;
  description: string;
  contactSubject: string;
  location: string;
  calendarDescription: string;
  sourceUrl: string;
}
export interface PublicSiteSettings {
  contact: {
    email: string;
    venue: string;
    venueShort: string;
    addressLines: string[];
    accessUrl: string;
    trainingDays: string;
    hoursLines: string[];
    hoursSummary: string;
  };
  season: { name: string; startDate: string; endDate: string; calendarImage: string; agendaNote: string; registrationCaption: string };
  club: { titleLines: string[]; paragraphs: string[] };
  events: PublicEvent[];
  featuredNews: { title: string; date: string; category: string; image: string; alt: string; summary: string; url: string }[];
  faq: { question: string; answer: string }[];
}
export function validateSiteSettings(raw: unknown): PublicSiteSettings;
export function buildEventCalendar(event: PublicEvent, now?: Date): string;
/** Filters undated habitual slots; exports only the dated entries supplied. */
export function buildEventsCalendar(events: PublicEvent[], now?: Date): string;
