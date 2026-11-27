import raw from '../github-pages/content/site-settings.json';
import { validateSiteSettings } from './public-site-settings.mjs';

export { buildEventCalendar } from './public-site-settings.mjs';
export type { PublicEvent } from './public-site-settings.mjs';
export const publicSiteSettings = validateSiteSettings(raw);
