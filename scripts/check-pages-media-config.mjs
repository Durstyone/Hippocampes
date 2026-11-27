import { appendFile, readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultProject = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imagePattern = /\.(?:avif|gif|jpe?g|png|webp|bmp|tiff?|heic|heif)$/i;
const videoPattern = /\.(?:mp4|webm|mov|m4v|mkv|avi|ogv)$/i;

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} doit être un objet JSON.`);
  return value;
}

async function readJson(filename, project) {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { throw new Error(`Impossible de lire ${relative(project, filename)} : ${error.code || 'JSON invalide'}.`); }
}

// Same URL rules and environment/config precedence as build-github-pages.mjs.
function httpsUrl(value, label, { optional = true, base = false } = {}) {
  if (optional && !value) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > 8192 || /\u0000/.test(value)) throw new Error(`${label} doit être un texte valide.`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} doit être une URL HTTPS absolue.`); }
  if (url.protocol !== 'https:' || url.username || url.password || /[\u0000-\u0020<>"\\]/.test(value) || /^(?:localhost|127\.|0\.|\[?::1\]?$)/i.test(url.hostname)) throw new Error(`${label} doit être une URL HTTPS publique, sans identifiants.`);
  if (base && (url.search || url.hash)) throw new Error(`${label} ne doit pas contenir de paramètres ni de fragment.`);
  return base ? url.href.replace(/\/+$/, '') : url.href;
}

async function filesIn(directory, publicDir) {
  if (!existsSync(directory)) return [];
  const all = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Lien symbolique interdit dans les fichiers publics : ${relative(publicDir, filename)}`);
    if (entry.isDirectory()) all.push(...await filesIn(filename, publicDir));
    else if (entry.isFile()) all.push(filename);
  }
  return all;
}

export async function inspectPagesMediaConfiguration({ projectRoot = defaultProject, env = process.env } = {}) {
  const project = resolve(projectRoot);
  const publicDir = resolve(project, 'public');
  const config = object(await readJson(resolve(project, 'github-pages/site.config.json'), project), 'site.config.json');
  const mediaBaseUrl = httpsUrl(env.PAGES_MEDIA_BASE_URL || config.mediaBaseUrl || '', 'mediaBaseUrl', { base: true });
  const files = (await Promise.all(['images', 'media/archive'].map(path => filesIn(resolve(publicDir, path), publicDir)))).flat();
  const mediaPaths = new Set(files.filter(path => imagePattern.test(path) || videoPattern.test(path)).map(path => '/' + relative(publicDir, path).split(sep).join('/')));
  const inventoryFile = resolve(project, 'github-pages/media-inventory.json');
  if (!existsSync(inventoryFile)) throw new Error('media-inventory.json est obligatoire : il recense les images locales et les médias externes.');
  {
    const inventory = object(await readJson(inventoryFile, project), 'media-inventory.json');
    if (!Array.isArray(inventory.files) || !inventory.files.length) throw new Error('media-inventory.json doit contenir un tableau files non vide.');
    for (const item of inventory.files) {
      const path = item?.path;
      if (typeof path !== 'string' || !/^\/(?:images|media\/archive)\//.test(path) || /[\u0000-\u0020?#\\]/.test(path) || path.split('/').some(part => part === '.' || part === '..') || !(imagePattern.test(path) || videoPattern.test(path))) throw new Error('media-inventory.json contient un chemin de média invalide.');
      mediaPaths.add(path);
    }
  }
  if (!mediaPaths.size) throw new Error('L’inventaire des médias est absent. Conservez github-pages/media-inventory.json dans le dépôt public.');
  const localMediaPaths = new Set();
  const localMediaFile = resolve(project, 'github-pages/local-media.json');
  if (existsSync(localMediaFile)) {
    const localMedia = object(await readJson(localMediaFile, project), 'local-media.json');
    if (!Array.isArray(localMedia.files)) throw new Error('local-media.json doit contenir un tableau files.');
    for (const path of localMedia.files) {
      if (typeof path !== 'string' || !/^\/(?:images|media\/archive)\//.test(path) || /[\u0000-\u0020?#\\]/.test(path) || path.split('/').some(part => part === '.' || part === '..') || !imagePattern.test(path)) throw new Error('local-media.json doit contenir uniquement des chemins d’images valides, jamais de vidéos.');
      if (localMediaPaths.has(path)) throw new Error(`Image locale indiquée plusieurs fois : ${path}.`);
      if (!mediaPaths.has(path)) throw new Error(`Image locale inconnue : ${path}.`);
      const localFile = resolve(publicDir, '.' + path);
      if (!existsSync(localFile) || !(await stat(localFile)).isFile()) throw new Error(`Image à conserver absente du dépôt : ${path}.`);
      localMediaPaths.add(path);
    }
  }
  const configuredMap = object(config.mediaMap ?? {}, 'mediaMap');
  const additionalMap = env.PAGES_MEDIA_MAP_FILE ? object(await readJson(resolve(project, env.PAGES_MEDIA_MAP_FILE), project), 'PAGES_MEDIA_MAP_FILE') : {};
  const mediaMap = Object.create(null);
  for (const [path, url] of Object.entries({ ...configuredMap, ...additionalMap })) {
    if (!mediaPaths.has(path)) throw new Error(`Clé mediaMap inconnue : ${path}. Utilisez le chemin exact de l’inventaire.`);
    if (localMediaPaths.has(path)) continue;
    mediaMap[path] = httpsUrl(url, `mediaMap[${path}]`, { optional: false });
  }
  const externalMediaPaths = [...mediaPaths].filter(path => !localMediaPaths.has(path));
  const missing = externalMediaPaths.filter(path => !mediaBaseUrl && !mediaMap[path]);
  return { ready: missing.length === 0, total: externalMediaPaths.length, local: localMediaPaths.size, configured: externalMediaPaths.length - missing.length, missing };
}

async function output(result) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `ready=${result.ready}\nmedia_total=${result.total}\nmedia_local=${result.local}\nmedia_missing=${result.missing.length}\n`);
  const summary = result.ready
    ? `## Configuration des médias complète\n\n${result.local} images sont présentes dans le dépôt et seront servies par GitHub Pages. ${result.total ? `${result.total} médias externes ont aussi une adresse configurée.` : `Aucun hébergement média externe n’est nécessaire pour cette publication.`} La construction, les contrôles du dossier public et la publication peuvent maintenant s’exécuter. Ce contrôle ne constitue pas une publication.\n`
    : `## Publication en attente des médias\n\n**Le site n’est pas publié par cette exécution.**\n\n${result.local} image(s) sont conservées dans les fichiers du site. Parmi les ${result.total} médias à héberger ailleurs, ${result.missing.length} n’ont pas encore d’adresse externe (${result.configured} configuré(s)). Les étapes de configuration Pages, de construction, d’envoi de l’archive et de déploiement sont ignorées.\n\nTransférer les médias externes chez l’hébergeur choisi, puis renseigner une base HTTPS qui conserve leurs chemins dans \`PAGES_MEDIA_BASE_URL\` / \`mediaBaseUrl\`, ou une correspondance complète dans \`PAGES_MEDIA_MAP_FILE\` / \`mediaMap\`. Le guide \`docs/GITHUB-PAGES.md\` explique ces réglages. Enregistrer ensuite la configuration ou relancer ce workflow manuellement.\n\nUn contrôle de code réussi ne signifie pas que le site est en ligne.\n`;
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(JSON.stringify({ ready: result.ready, mediaTotal: result.total, mediaLocal: result.local, mediaConfigured: result.configured, mediaMissing: result.missing.length }));
  if (!result.ready) console.log(`::notice title=Publication en attente::${result.missing.length} médias sans adresse externe. Aucun site n’est publié par cette exécution.`);
}

async function main() {
  try { await output(await inspectPagesMediaConfiguration()); }
  catch (error) {
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'ready=false\n');
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, '## Publication bloquée\n\nLa configuration des médias est invalide. Aucun déploiement n’est autorisé ; consulter le journal du contrôle pour corriger le réglage.\n');
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
