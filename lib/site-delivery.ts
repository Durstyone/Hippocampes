/** Public-site URL handling shared by the hosted application and Pages export.
 * Only the static build defines __SITE_DELIVERY__. No credentials belong here.
 */
type SiteDelivery = {
  static: boolean;
  basePath: string;
  mediaBaseUrl: string;
  mediaMap: Record<string, string>;
  localMedia?: string[];
  clubUrl: string;
};

declare const __SITE_DELIVERY__: SiteDelivery | undefined;

const delivery = typeof __SITE_DELIVERY__ === 'undefined' ? undefined : __SITE_DELIVERY__;
export const isStaticSite = delivery?.static === true;
const basePath = isStaticSite ? (delivery?.basePath || '').replace(/\/$/, '') : '';
const externalMediaBase = isStaticSite ? (delivery?.mediaBaseUrl || '').replace(/\/$/, '') : '';
const localMedia = new Set(isStaticSite ? delivery?.localMedia || [] : []);

/** Strip the deployment prefix without changing an external URL or a fragment. */
export function localSitePath(path: string) {
  if (!basePath || basePath === '/' || !path.startsWith('/')) return path;
  return path === basePath || path.startsWith(basePath + '/') || path.startsWith(basePath + '?') || path.startsWith(basePath + '#')
    ? path.slice(basePath.length) || '/'
    : path;
}

export function siteUrl(path: string) {
  if (!isStaticSite || !path.startsWith('/') || path.startsWith('//')) return path;
  const local = localSitePath(path);
  // Pages serves these routes from physical directories. Link to their
  // canonical slash form directly so redirects cannot discard filter queries.
  const match = local.match(/^(\/(?:archives|actualites|admin|agenda)(?:\/[^/?#]+)?)([?#].*)?$/);
  const canonical = match ? match[1] + '/' + (match[2] || '') : local;
  return (basePath === '/' ? '' : basePath) + canonical;
}

/** Explicitly retained article images stay on the site, including under a repository path. */
export function mediaUrl(path: string) {
  if (!isStaticSite || !path.startsWith('/') || path.startsWith('//')) return path;
  const local = localSitePath(path);
  if (localMedia.has(local.split(/[?#]/, 1)[0])) return siteUrl(local);
  const mapped = delivery?.mediaMap?.[local];
  if (mapped) return mapped;
  if (externalMediaBase && /^\/(?:images|videos|media)\//.test(local) && /\.(?:avif|gif|jpe?g|png|svg|webp|mp4|webm|mov|m4v)(?:[?#]|$)/i.test(local)) return externalMediaBase + local;
  return siteUrl(local);
}

export const clubPortalUrl = isStaticSite ? (delivery?.clubUrl || '') : '/club';

export function publicFeedUrl(kind: 'club' | 'media') {
  return isStaticSite ? siteUrl('/content/public-' + kind + '.json') : '/api/public/' + kind;
}
