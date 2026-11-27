import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { domainToASCII, fileURLToPath } from 'node:url';
import { inspectCmsImages, inspectLocalRaster, readCmsCollection } from './cms-content.mjs';
import { validateSiteSettings } from '../lib/public-site-settings.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(project, 'public');
const args = new Set(process.argv.slice(2));
if ([...args].some(arg => arg !== '--preview-local-media')) throw new Error('Option inconnue. Seul --preview-local-media est accepté pour une vérification locale.');
const preview = args.has('--preview-local-media');
const outputName = preview ? 'hippocampes-github-pages-preview' : 'hippocampes-github-pages';
const outputs = resolve(project, 'outputs');
const destination = resolve(outputs, outputName);
const staging = resolve(outputs, '.' + outputName + '-building');
const www = resolve(staging, 'www');
const imagePattern = /\.(?:avif|gif|jpe?g|png|webp|bmp|tiff?|heic|heif)$/i;
const videoPattern = /\.(?:mp4|webm|mov|m4v|mkv|avi|ogv)$/i;
const routeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,219}$/;
const title = 'Les Hippocampes du Robec — Plongée & apnée à Darnétal';
const description = 'Plongée, apnée et esprit club à Darnétal. Découvrez les Hippocampes du Robec.';

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} doit être un objet JSON.`);
  return value;
}

async function readJson(filename) {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { throw new Error(`Impossible de lire le fichier JSON ${relative(project, filename)} : ${error.code || 'JSON invalide'}.`); }
}

function textValue(value, label, { optional = false, limit = 300000 } = {}) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > limit || /\u0000/.test(value)) throw new Error(`${label} doit être un texte valide.`);
  return value;
}

function httpsUrl(value, label, { optional = true, base = false } = {}) {
  if (optional && !value) return '';
  textValue(value, label, { limit: 8192 });
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} doit être une URL HTTPS absolue.`); }
  if (url.protocol !== 'https:' || url.username || url.password || /[\u0000-\u0020<>"\\]/.test(value) || /^(?:localhost|127\.|0\.|\[?::1\]?$)/i.test(url.hostname)) throw new Error(`${label} doit être une URL HTTPS publique, sans identifiants.`);
  if (base && (url.search || url.hash)) throw new Error(`${label} ne doit pas contenir de paramètres ni de fragment.`);
  return base ? url.href.replace(/\/+$/, '') : url.href;
}

function normalizeBase(value) {
  if (typeof value !== 'string') throw new Error('basePath doit être un chemin, par exemple /nom-du-depot/.');
  const base = '/' + value.replace(/^\/+|\/+$/g, '') + '/';
  if (base === '//') return '/';
  if (!/^\/(?:[A-Za-z0-9._-]+\/)+$/.test(base) || base.split('/').some(part => part === '.' || part === '..')) throw new Error('basePath contient un segment invalide. Utilisez / ou /nom-du-depot/.');
  return base;
}

function normalizeDomain(value) {
  if (!value) return '';
  if (typeof value !== 'string' || /[\s/:@?#*]/.test(value)) throw new Error('domain doit contenir uniquement le nom de domaine, sans https:// ni chemin.');
  const domain = domainToASCII(value.replace(/\.$/, '')).toLowerCase();
  if (domain.length > 253 || !domain.includes('.') || !domain.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) || /^\d+(?:\.\d+){3}$/.test(domain)) throw new Error('Le nom de domaine est invalide.');
  return domain;
}

function routeId(value, label) {
  if (typeof value !== 'string' || !routeIdPattern.test(value) || value === '.' || value === '..') throw new Error(`${label} contient un identifiant de page invalide.`);
  return value;
}

function validDate(value, label, optional = false) {
  if (optional && !value) return '';
  textValue(value, label, { limit: 40 });
  if (!/^\d{4}-\d{2}-\d{2}(?:T[^\s]+)?$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${label} doit contenir une date ISO valide.`);
  if (value.length === 10 && new Date(value).toISOString().slice(0, 10) !== value) throw new Error(`${label} contient une date de calendrier invalide.`);
  return value;
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function asPublicPath(filename) { return '/' + relative(publicDir, filename).split(sep).join('/'); }
async function filesIn(directory) {
  if (!existsSync(directory)) return [];
  const all = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Lien symbolique interdit dans les fichiers publics : ${asPublicPath(filename)}`);
    if (entry.isDirectory()) all.push(...await filesIn(filename));
    else if (entry.isFile()) all.push(filename);
  }
  return all.sort();
}

for (const protectedName of ['.env', 'data', 'club.sqlite']) {
  if (existsSync(resolve(destination, protectedName))) throw new Error(`L’export existant contient ${protectedName}. Déplacez ces données hors du dossier généré avant de reconstruire.`);
}

const config = object(await readJson(resolve(project, 'github-pages/site.config.json')), 'site.config.json');
const siteSettings = validateSiteSettings(await readJson(resolve(project, 'github-pages/content/site-settings.json')));
const domain = normalizeDomain(process.env.PAGES_DOMAIN || config.domain || '');
const basePath = domain ? '/' : normalizeBase(process.env.PAGES_BASE_PATH ?? config.basePath ?? '/');
const mediaBaseUrl = httpsUrl(process.env.PAGES_MEDIA_BASE_URL || config.mediaBaseUrl || '', 'mediaBaseUrl', { base: true });
const clubUrl = httpsUrl(process.env.PAGES_CLUB_URL || config.clubUrl || '', 'clubUrl');
const mediaFiles = (await Promise.all(['images', 'media/archive'].map(path => filesIn(resolve(publicDir, path))))).flat().filter(filename => imagePattern.test(filename) || videoPattern.test(filename));
const mediaPaths = new Set(mediaFiles.map(asPublicPath));
const cmsImages = await inspectCmsImages(project);
const inventoryFile = resolve(project, 'github-pages/media-inventory.json');
if (!existsSync(inventoryFile)) throw new Error('Conservez github-pages/media-inventory.json : il décrit aussi les médias hébergés ailleurs.');
{
  const inventory = object(await readJson(inventoryFile), 'media-inventory.json');
  if (!Array.isArray(inventory.files) || !inventory.files.length) throw new Error('media-inventory.json doit contenir un tableau files non vide.');
  for (const item of inventory.files) {
    const path = item?.path;
    if (typeof path !== 'string' || !/^\/(?:images|media\/archive)\//.test(path) || /[\u0000-\u0020?#\\]/.test(path) || path.split('/').some(part => part === '.' || part === '..') || !(imagePattern.test(path) || videoPattern.test(path))) throw new Error('media-inventory.json contient un chemin de média invalide.');
    mediaPaths.add(path);
  }
}
if (!mediaPaths.size) throw new Error('L’inventaire des médias est absent. Conservez github-pages/media-inventory.json dans le dépôt public, même lorsque les images sont hébergées ailleurs.');
const localMedia = new Set();
const localMediaFile = resolve(project, 'github-pages/local-media.json');
if (existsSync(localMediaFile)) {
  const retained = object(await readJson(localMediaFile), 'local-media.json');
  if (!Array.isArray(retained.files)) throw new Error('local-media.json doit contenir un tableau files.');
  const availableFiles = new Set(mediaFiles.map(asPublicPath));
  for (const path of retained.files) {
    if (typeof path !== 'string' || !/^\/(?:images|media\/archive)\//.test(path) || /[\u0000-\u0020?#\\]/.test(path) || path.split('/').some(part => part === '.' || part === '..') || !imagePattern.test(path)) throw new Error('local-media.json contient un chemin d’image invalide. Les vidéos restent externes.');
    if (localMedia.has(path)) throw new Error(`Image locale déclarée deux fois : ${path}.`);
    if (!availableFiles.has(path)) throw new Error(`L’image à conserver dans le site est absente : ${path}.`);
    localMedia.add(path);
  }
}
for (const path of cmsImages.keys()) localMedia.add(path);
const externalMediaPaths = [...mediaPaths].filter(path => !localMedia.has(path));
if (preview && [...mediaPaths].some(path => !existsSync(resolve(publicDir, '.' + path)))) throw new Error('L’aperçu avec médias locaux nécessite les fichiers d’origine. Configurez les adresses externes et utilisez le build normal depuis le dépôt GitHub allégé.');
const configuredMap = object(config.mediaMap ?? {}, 'mediaMap');
const additionalMap = process.env.PAGES_MEDIA_MAP_FILE ? object(await readJson(resolve(project, process.env.PAGES_MEDIA_MAP_FILE)), 'PAGES_MEDIA_MAP_FILE') : {};
const mediaMap = Object.create(null);
for (const [path, url] of Object.entries({ ...configuredMap, ...additionalMap })) {
  if (!mediaPaths.has(path)) throw new Error(`Clé mediaMap inconnue : ${path}. Utilisez le chemin exact d’un média public existant.`);
  if (localMedia.has(path)) continue;
  mediaMap[path] = httpsUrl(url, `mediaMap[${path}]`, { optional: false });
}
const missingMedia = externalMediaPaths.filter(path => !mediaBaseUrl && !mediaMap[path]);
if (!preview && missingMedia.length) {
  throw new Error(`${missingMedia.length} médias n’ont pas d’adresse externe. Configurez PAGES_MEDIA_BASE_URL (en conservant les dossiers images/ et media/archive/) ou PAGES_MEDIA_MAP_FILE. Aucun site de production n’a été généré. Pour une vérification locale uniquement : --preview-local-media.`);
}
const siteUrlInput = domain ? `https://${domain}` : process.env.PAGES_SITE_URL || config.siteUrl || '';
const siteUrl = httpsUrl(siteUrlInput, 'PAGES_SITE_URL', { base: true });
if (siteUrl) {
  const expectedPath = basePath;
  const actualPath = new URL(siteUrl).pathname.replace(/\/?$/, '/');
  if (actualPath !== expectedPath) throw new Error('Le chemin de PAGES_SITE_URL doit correspondre à basePath, par exemple https://compte.github.io/depot/ avec /depot/.');
}

function resolveMedia(path) { return localMedia.has(path) ? basePath + path.replace(/^\//, '') : mediaMap[path] || (mediaBaseUrl && mediaPaths.has(path) ? mediaBaseUrl + path : basePath + path.replace(/^\//, '')); }
function publicImage(value, label) {
  if (!value) return '';
  if (typeof value === 'string' && mediaPaths.has(value)) return value;
  return httpsUrl(value, label, { optional: false });
}
publicImage(siteSettings.season.calendarImage, 'Le calendrier de la saison');
for (const [index, item] of siteSettings.featuredNews.entries()) publicImage(item.image, `Actualité mise en avant ${index + 1}`);

const rawNews = object(await readJson(resolve(project, 'github-pages/content/public-club.json')), 'public-club.json');
if (!Array.isArray(rawNews.news)) throw new Error('public-club.json doit contenir un tableau news.');
const cmsNews = await readCmsCollection(project, 'news');
const news = [...rawNews.news, ...cmsNews].map((item, i) => {
  object(item, `news[${i}]`);
  if (item.published === false) throw new Error(`news[${i}] n’est pas publié. Retirez ce brouillon du fichier public.`);
  return {
    id: routeId(item.id, `news[${i}]`),
    title: textValue(item.title, `news[${i}].title`, { limit: 1000 }),
    date: validDate(item.date, `news[${i}].date`),
    excerpt: textValue(item.excerpt, `news[${i}].excerpt`, { optional: true, limit: 10000 }),
    body: textValue(item.body, `news[${i}].body`, { optional: true }),
    image: publicImage(item.image, `news[${i}].image`),
    url: httpsUrl(item.url, `news[${i}].url`),
  };
});
if (new Set(news.map(item => item.id)).size !== news.length) throw new Error('Les identifiants des actualités doivent être uniques.');
news.sort((a, b) => b.date.localeCompare(a.date));

const rawMedia = object(await readJson(resolve(project, 'github-pages/content/public-media.json')), 'public-media.json');
if (!Array.isArray(rawMedia.photos)) throw new Error('public-media.json doit contenir un tableau photos.');
const cmsPhotos = [];
for (const item of await readCmsCollection(project, 'photos')) {
  const label = `Photo ${item.id}`;
  if (typeof item.image !== 'string' || !localMedia.has(item.image)) throw new Error(`${label} doit utiliser une image locale autorisée et présente dans le site.`);
  if (item.order !== undefined && item.order !== null && (!Number.isSafeInteger(item.order) || item.order < 0 || item.order > 1000000)) throw new Error(`${label} : l’ordre doit être un entier entre 0 et 1 000 000.`);
  const takenAt = validDate(item.date, `${label}.date`, true);
  if (takenAt && !/^\d{4}-\d{2}-\d{2}$/.test(takenAt)) throw new Error(`${label} : la date doit être au format AAAA-MM-JJ.`);
  const metadata = cmsImages.get(item.image) || await inspectLocalRaster(resolve(publicDir, '.' + item.image));
  cmsPhotos.push({
    id: item.id,
    title: item.title,
    alt: item.alt,
    album: item.album,
    caption: item.description,
    credit: item.credit,
    takenAt,
    order: item.order ?? 0,
    secureUrl: item.image,
    publicId: `local/${item.id}`,
    cloudName: '',
    published: true,
    version: 1,
    createdAt: takenAt,
    updatedAt: '',
    ...metadata,
  });
}
cmsPhotos.sort((a, b) => a.order - b.order || b.takenAt.localeCompare(a.takenAt) || a.id.localeCompare(b.id));
const photos = [...cmsPhotos, ...rawMedia.photos].map((photo, i) => {
  object(photo, `photos[${i}]`);
  if (photo.published !== true) throw new Error(`photos[${i}] doit être explicitement publiée avant de figurer dans le site public.`);
  const isLocalPhoto = typeof photo.secureUrl === 'string' && localMedia.has(photo.secureUrl);
  const secureUrl = isLocalPhoto ? photo.secureUrl : httpsUrl(photo.secureUrl, `photos[${i}].secureUrl`, { optional: false });
  if (isLocalPhoto && !/\.(?:jpe?g|png|webp|gif)$/i.test(secureUrl)) throw new Error(`photos[${i}] doit utiliser un fichier JPG, PNG, WebP ou GIF.`);
  if (photo.takenAt && (typeof photo.takenAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(photo.takenAt))) throw new Error(`photos[${i}].takenAt doit contenir une date au format AAAA-MM-JJ.`);
  if (!isLocalPhoto && !/^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/v\d+\/hippocampes-du-robec\/[0-9a-f-]+\.(?:jpg|png|webp)$/.test(secureUrl)) throw new Error(`photos[${i}].secureUrl doit correspondre à une image locale autorisée ou à la photothèque Cloudinary du club.`);
  for (const key of ['width', 'height']) if (!Number.isSafeInteger(photo[key]) || photo[key] <= 0 || photo[key] > 100000) throw new Error(`photos[${i}].${key} est invalide.`);
  return {
    id: routeId(photo.id, `photos[${i}]`),
    version: Number.isSafeInteger(photo.version) && photo.version > 0 ? photo.version : 1,
    title: textValue(photo.title, `photos[${i}].title`, { limit: 1000 }),
    alt: textValue(photo.alt, `photos[${i}].alt`, { optional: true, limit: 2000 }),
    caption: textValue(photo.caption, `photos[${i}].caption`, { optional: true, limit: 10000 }),
    credit: textValue(photo.credit, `photos[${i}].credit`, { optional: true, limit: 1000 }),
    album: textValue(photo.album, `photos[${i}].album`, { optional: true, limit: 1000 }),
    takenAt: validDate(photo.takenAt, `photos[${i}].takenAt`, true),
    published: true,
    secureUrl,
    publicId: textValue(photo.publicId, `photos[${i}].publicId`, { optional: true, limit: 1000 }),
    cloudName: textValue(photo.cloudName, `photos[${i}].cloudName`, { optional: true, limit: 200 }),
    width: photo.width,
    height: photo.height,
    bytes: Number.isSafeInteger(photo.bytes) && photo.bytes >= 0 ? photo.bytes : 0,
    format: secureUrl.match(/\.(jpe?g|png|webp|gif)$/i)[1].toLowerCase().replace('jpeg', 'jpg'),
    createdAt: validDate(photo.createdAt, `photos[${i}].createdAt`, true),
    updatedAt: validDate(photo.updatedAt, `photos[${i}].updatedAt`, true),
  };
});
if (new Set(photos.map(photo => photo.id)).size !== photos.length) throw new Error('Les identifiants de la photothèque doivent être uniques.');

const archiveIndex = object(await readJson(resolve(publicDir, 'content/archive-index.json')), 'archive-index.json');
if (!Array.isArray(archiveIndex.entries)) throw new Error('L’index des archives est invalide.');
const archiveEntries = [];
for (const entry of archiveIndex.entries) {
  const id = routeId(entry.id, 'archive-index.json');
  const filename = resolve(publicDir, 'content/entries', id + '.json');
  const detail = object(await readJson(filename), `archive ${id}`);
  if (detail.id !== id) throw new Error(`L’identifiant du contenu ${id} ne correspond pas à son fichier.`);
  archiveEntries.push({ id, title: textValue(entry.title, `archive ${id}.title`, { limit: 5000 }), filename });
}
if (new Set(archiveEntries.map(entry => entry.id)).size !== archiveEntries.length) throw new Error('L’index des archives contient des identifiants en double.');

await mkdir(outputs, { recursive: true });
await rm(staging, { recursive: true, force: true });
await mkdir(www, { recursive: true });
const delivery = { static: true, basePath, mediaBaseUrl, mediaMap, localMedia: [...localMedia].sort(), clubUrl };
await build({
  configFile: false,
  root: resolve(project, 'github-pages/client'),
  base: basePath,
  publicDir: false,
  resolve: { alias: { '@': project } },
  plugins: [react()],
  define: { __SITE_DELIVERY__: JSON.stringify(delivery) },
  css: { postcss: project },
  build: { outDir: www, emptyOutDir: true, sourcemap: false, target: 'es2022' },
});

await mkdir(resolve(www, 'content/entries'), { recursive: true });
await cp(resolve(publicDir, 'favicon.svg'), resolve(www, 'favicon.svg'));
await cp(resolve(publicDir, 'content/archive-index.json'), resolve(www, 'content/archive-index.json'));
for (const entry of archiveEntries) await cp(entry.filename, resolve(www, 'content/entries', entry.id + '.json'));
for (const filename of await filesIn(resolve(publicDir, 'media/archive'))) {
  if (!['.pdf', '.ics'].includes(extname(filename).toLowerCase())) continue;
  const target = resolve(www, relative(publicDir, filename));
  await mkdir(dirname(target), { recursive: true });
  await cp(filename, target);
}
for (const filename of await filesIn(resolve(publicDir, 'images'))) {
  if (extname(filename).toLowerCase() !== '.svg') continue;
  const target = resolve(www, relative(publicDir, filename));
  await mkdir(dirname(target), { recursive: true });
  await cp(filename, target);
}
for (const filename of mediaFiles) {
  if (preview || localMedia.has(asPublicPath(filename))) {
    const target = resolve(www, relative(publicDir, filename));
    await mkdir(dirname(target), { recursive: true });
    await cp(filename, target);
  }
}
if (preview) {
  await writeFile(resolve(www, 'PREVIEW-ONLY.txt'), 'Vérification locale uniquement. Ce dossier contient les médias locaux et ne doit pas être publié sur GitHub Pages.\n');
}
await writeFile(resolve(www, 'content/public-club.json'), JSON.stringify({ news }, null, 2) + '\n');
await writeFile(resolve(www, 'content/public-media.json'), JSON.stringify({ photos }, null, 2) + '\n');
await writeFile(resolve(www, '.nojekyll'), '');
if (domain && !preview) await writeFile(resolve(www, 'CNAME'), domain + '\n');

const template = await readFile(resolve(www, 'index.html'), 'utf8');
const background = resolveMedia('/images/fond-manta-robec.png');
const backgroundCss = `:root{--site-ocean-image:url(${JSON.stringify(background).replace(/</g, '\\3c ').replace(/>/g, '\\3e ')})}`;
const routeRecords = [
  { path: '/', title },
  { path: '/archives/', title: 'Les archives — Les Hippocampes du Robec' },
  { path: '/actualites/', title: 'Les actualités — Les Hippocampes du Robec' },
  { path: '/agenda/', title: `Agenda ${siteSettings.season.name} — Les Hippocampes du Robec`, description: `Le calendrier ${siteSettings.season.name} des Hippocampes du Robec : entraînements, formations, sorties et vie du club. Consultez les dates et ajoutez les rendez-vous à votre agenda.` },
  { path: '/admin/', title: 'Administration — Les Hippocampes du Robec', noindex: true },
  ...archiveEntries.map(entry => ({ path: '/archives/' + entry.id + '/', title: entry.title + ' — Les Hippocampes du Robec' })),
  ...news.map(item => ({ path: '/actualites/' + item.id + '/', title: item.title + ' — Les Hippocampes du Robec' })),
];
for (const record of routeRecords) {
  const canonical = siteUrl && !preview ? siteUrl.replace(/\/$/, '') + record.path : '';
  const metadata = [`<style>${backgroundCss}</style>`, preview || record.noindex ? '<meta name="robots" content="noindex,nofollow" />' : '', canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : ''].filter(Boolean).join('\n    ');
  const html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(record.title)}</title>`).replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(record.description || description)}" />`).replace('<!-- PAGES_METADATA -->', metadata);
  const target = resolve(www, '.' + record.path, 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

const home = basePath;
await writeFile(resolve(www, '404.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page introuvable — Les Hippocampes du Robec</title><style>body{margin:0;padding:12vh 24px;font:18px/1.6 system-ui,sans-serif;background:#06323a;color:#eaf5f3}main{max-width:640px;margin:auto;padding:36px;background:#0b3039;border:1px solid #27515a;border-radius:16px}h1{font-size:2rem;line-height:1.2}a{color:#8be5d5}</style></head><body><main><h1>Cette page n’est pas disponible.</h1><p>Retrouvez les informations, les photos et les récits du club depuis l’accueil.</p><p><a href="${escapeHtml(home)}">Retour au site du club</a></p></main></body></html>\n`);
if (siteUrl && !preview) {
  const origin = siteUrl.replace(/\/$/, '');
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + routeRecords.filter(record => !record.noindex).map(record => `  <url><loc>${escapeHtml(origin + record.path)}</loc></url>`).join('\n') + '\n</urlset>\n';
  await writeFile(resolve(www, 'sitemap.xml'), sitemap);
  await writeFile(resolve(www, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
} else await writeFile(resolve(www, 'robots.txt'), preview ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n');

const outputFiles = await filesIn(www);
const publishedMedia = outputFiles.filter(filename => imagePattern.test(filename) || videoPattern.test(filename));
const unexpectedMedia = publishedMedia.filter(filename => !localMedia.has('/' + relative(www, filename).split(sep).join('/')));
if (!preview && unexpectedMedia.length) throw new Error('L’export de production contient des médias locaux non autorisés. Publication interrompue.');
const mediaBytes = (await Promise.all(publishedMedia.map(filename => stat(filename)))).reduce((total, file) => total + file.size, 0);
const outputBytes = (await Promise.all(outputFiles.map(filename => stat(filename)))).reduce((total, file) => total + file.size, 0);
await writeFile(resolve(staging, 'BUILD-INFO.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  target: 'github-pages',
  mode: preview ? 'preview-local-media' : 'production',
  publishable: !preview,
  previewOnly: preview,
  basePath,
  domain: preview ? '' : domain,
  canonicalSiteUrl: preview ? '' : siteUrl,
  publicRoutes: routeRecords.length,
  archivedEntries: archiveEntries.length,
  publishedNews: news.length,
  publishedPhotos: photos.length,
  externalMediaFiles: externalMediaPaths.length,
  localMediaFiles: localMedia.size,
  localMediaPaths: [...localMedia].sort(),
  mediaBytesInPublication: mediaBytes,
  files: outputFiles.length,
  bytes: outputBytes,
  clubPortalConfigured: Boolean(clubUrl),
  privateDataIncluded: false,
  credentialsIncluded: false,
  description,
}, null, 2) + '\n');
await rm(destination, { recursive: true, force: true });
await rename(staging, destination);
console.log(`${preview ? 'Aperçu local non publiable' : 'Export GitHub Pages prêt'} : ${destination}/www\n${routeRecords.length} pages, ${archiveEntries.length} contenus d’archives. ${preview ? 'Médias locaux conservés pour la vérification uniquement.' : `${localMedia.size} images conservées dans le site ; ${externalMediaPaths.length} médias servis par les adresses externes configurées.`}`);
