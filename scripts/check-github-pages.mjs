import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCmsImages } from './cms-content.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preview = process.argv.includes('--preview');
if (process.argv.slice(2).some(arg => arg !== '--preview')) throw new Error('Option inconnue : utilisez --preview uniquement pour le dossier de vérification locale.');
const output = resolve(project, 'outputs', preview ? 'hippocampes-github-pages-preview' : 'hippocampes-github-pages');
const root = resolve(output, 'www');
const info = JSON.parse(await readFile(resolve(output, 'BUILD-INFO.json'), 'utf8'));
assert.equal(info.target, 'github-pages');
assert.equal(info.previewOnly, preview);
assert.equal(info.publishable, !preview, 'Un aperçu local ne peut pas être déployé par le workflow Pages.');
assert.equal(info.privateDataIncluded, false);
assert.equal(info.credentialsIncluded, false);
assert.equal(typeof info.basePath, 'string');
assert.ok(info.basePath.startsWith('/') && info.basePath.endsWith('/'));
const basePath = info.basePath;
const imagePattern = /\.(?:avif|gif|jpe?g|png|webp|bmp|tiff?|heic|heif)$/i;
const localMediaFile = resolve(project, 'github-pages/local-media.json');
const retained = existsSync(localMediaFile) ? JSON.parse(await readFile(localMediaFile, 'utf8')) : { files: [] };
assert.ok(retained && Array.isArray(retained.files), 'local-media.json doit contenir un tableau files.');
const localMedia = new Set();
for (const path of retained.files) {
  assert.ok(typeof path === 'string' && /^\/(?:images|media\/archive)\//.test(path) && !/[\u0000-\u0020?#\\]/.test(path) && !path.split('/').some(part => part === '.' || part === '..') && imagePattern.test(path), 'Image locale déclarée invalide.');
  assert.ok(!localMedia.has(path), `Image locale déclarée deux fois : ${path}`);
  localMedia.add(path);
}
for (const path of (await inspectCmsImages(project)).keys()) localMedia.add(path);
assert.equal(info.localMediaFiles, localMedia.size);
assert.deepEqual(info.localMediaPaths, [...localMedia].sort());

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Lien symbolique interdit dans la publication.');
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
    else assert.fail('Fichier spécial interdit.');
  }
  return files;
}

const files = await walk(root);
const paths = new Set(files.map(path => relative(root, path).split('\\').join('/')));
for (const name of ['index.html', '404.html', '.nojekyll', 'favicon.svg', 'content/archive-index.json', 'content/public-club.json', 'content/public-media.json', 'le-club/index.html', 'activites/index.html', 'archives/index.html', 'actualites/index.html', 'agenda/index.html', 'admin/index.html']) assert.ok(paths.has(name), `Fichier public absent : ${name}`);
const forbidden = /(?:^|\/)(?:\.git|\.env[^/]*|\.openai|\.wrangler|club\.sqlite[^/]*|auth\.mjs|server\.mjs|package\.json)(?:\/|$)|\.(?:sqlite(?:-wal|-shm)?|pem|map)$/i;
const mediaPattern = /\.(?:avif|gif|jpe?g|png|webp|bmp|tiff?|heic|heif|mp4|webm|mov|m4v|mkv|avi|ogv)$/i;
for (const path of paths) {
  assert.ok(!forbidden.test(path), `Fichier privé ou de développement dans la publication : ${path}`);
  if (!preview && mediaPattern.test(path)) assert.ok(localMedia.has('/' + path), `Média local non autorisé dans la publication : ${path}`);
}
assert.equal(paths.has('PREVIEW-ONLY.txt'), preview);
for (const path of localMedia) {
  assert.ok(paths.has(path.slice(1)), `Image locale conservée absente : ${path}`);
  const source = await readFile(resolve(project, 'public', '.' + path));
  const publication = await readFile(resolve(root, '.' + path));
  assert.equal(publication.length, source.length, `Taille de l’image conservée incorrecte : ${path}`);
  const digest = value => createHash('sha256').update(value).digest('hex');
  assert.equal(digest(publication), digest(source), `L’image conservée a été altérée : ${path}`);
}
const mediaFiles = files.filter(file => mediaPattern.test(file));
if (!preview) assert.equal(mediaFiles.length, localMedia.size);
const mediaBytes = (await Promise.all(mediaFiles.map(file => stat(file)))).reduce((sum, item) => sum + item.size, 0);
assert.equal(info.mediaBytesInPublication, mediaBytes);

const index = JSON.parse(await readFile(resolve(root, 'content/archive-index.json'), 'utf8'));
for (const entry of index.entries) {
  assert.ok(paths.has(`archives/${entry.id}/index.html`), `Lien direct d’archive manquant : ${entry.id}`);
  assert.ok(paths.has(`content/entries/${entry.id}.json`), `Texte d’archive manquant : ${entry.id}`);
}
assert.equal(index.entries.length, info.archivedEntries);
const feed = JSON.parse(await readFile(resolve(root, 'content/public-club.json'), 'utf8'));
assert.deepEqual(Object.keys(feed), ['news'], 'Le fichier public ne doit pas contenir les données de gestion du club.');
assert.equal(feed.news.length, info.publishedNews);
for (const item of feed.news) assert.ok(paths.has(`actualites/${item.id}/index.html`));
const mediaFeed = JSON.parse(await readFile(resolve(root, 'content/public-media.json'), 'utf8'));
assert.deepEqual(Object.keys(mediaFeed), ['photos']);
assert.equal(mediaFeed.photos.length, info.publishedPhotos);
for (const photo of mediaFeed.photos) {
  assert.equal(photo.published, true);
  if (photo.secureUrl.startsWith('/')) {
    assert.ok(localMedia.has(photo.secureUrl), `Image de photothèque locale non autorisée : ${photo.secureUrl}`);
    assert.ok(paths.has(photo.secureUrl.slice(1)), `Image de photothèque absente : ${photo.secureUrl}`);
  }
}
assert.ok((await readFile(resolve(root, 'admin/index.html'), 'utf8')).includes('noindex'), 'L’accès à l’administration ne doit pas être indexé.');
const agendaHtml = await readFile(resolve(root, 'agenda/index.html'), 'utf8');
assert.match(agendaHtml, /<title>Agenda [^<]+ — Les Hippocampes du Robec<\/title>/, 'L’agenda doit avoir un titre de page dédié.');
assert.match(agendaHtml, /<meta name="description" content="Le calendrier [^"]+"\s*\/>/, 'L’agenda doit avoir sa propre description.');
const sectionHtml = new Map();
const sectionDescriptions = new Set();
for (const [slug, label] of [['le-club', 'Le club'], ['activites', 'Nos activités']]) {
  const html = await readFile(resolve(root, `${slug}/index.html`), 'utf8');
  assert.ok(html.includes(`<title>${label} — Les Hippocampes du Robec</title>`), `La page ${label} doit avoir un titre dédié.`);
  const pageDescription = html.match(/<meta name="description" content="([^"]+)"\s*\/>/)?.[1];
  assert.ok(pageDescription && pageDescription !== info.description, `La page ${label} doit avoir sa propre description.`);
  assert.ok(!sectionDescriptions.has(pageDescription), `La description de ${label} ne doit pas être celle d’une autre rubrique.`);
  sectionDescriptions.add(pageDescription);
  sectionHtml.set(slug, html);
}

let htmlPages = 0;
for (const file of files) {
  if (extname(file) === '.html') {
    htmlPages++;
    const html = await readFile(file, 'utf8');
    assert.ok(!html.includes('PAGES_METADATA'), 'Les métadonnées de publication ne sont pas résolues.');
    if (preview) assert.ok(html.includes('noindex'), 'Un aperçu local doit rester non indexable.');
    for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
      const url = match[1];
      if (url.startsWith('//')) continue;
      assert.ok(url.startsWith(basePath), `Chemin hors du dépôt ${basePath} : ${url}`);
      const local = decodeURIComponent(url.slice(basePath.length));
      assert.ok(paths.has(local) || paths.has(local.replace(/\/?$/, '/') + 'index.html') || (!local && paths.has('index.html')), `Lien HTML absent : ${url}`);
    }
  }
  if (extname(file) === '.js') {
    const js = await readFile(file, 'utf8');
    for (const marker of ['CLOUDINARY_API_SECRET', 'PORTABLE_SESSION_SECRET', 'hippocampes_session', 'x-openai-account-user-id', 'node:sqlite']) assert.ok(!js.includes(marker), `Code serveur détecté dans le navigateur : ${marker}`);
  }
}
assert.equal(htmlPages, info.publicRoutes + 1, 'Les pages publiées doivent comprendre les routes et la page 404.');
if (info.domain && !preview) assert.equal((await readFile(resolve(root, 'CNAME'), 'utf8')).trim(), info.domain);
if (info.canonicalSiteUrl && !preview) {
  assert.ok(paths.has('sitemap.xml'));
  const agendaUrl = info.canonicalSiteUrl.replace(/\/$/, '') + '/agenda/';
  assert.ok(agendaHtml.includes(`<link rel="canonical" href="${agendaUrl}"`), 'L’URL canonique de l’agenda doit conserver le chemin du dépôt.');
  const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
  assert.ok(sitemap.includes(`<loc>${agendaUrl}</loc>`), 'L’agenda doit apparaître dans le sitemap public.');
  for (const [slug, html] of sectionHtml) {
    const canonicalUrl = info.canonicalSiteUrl.replace(/\/$/, '') + `/${slug}/`;
    assert.ok(html.includes(`<link rel="canonical" href="${canonicalUrl}"`), `L’URL canonique de ${slug} doit conserver le chemin du dépôt.`);
    assert.ok(sitemap.includes(`<loc>${canonicalUrl}</loc>`), `La page ${slug} doit apparaître dans le sitemap public.`);
  }
}
const bytes = (await Promise.all(files.map(file => stat(file)))).reduce((sum, item) => sum + item.size, 0);
assert.equal(info.files, files.length);
assert.equal(info.bytes, bytes);
console.log(JSON.stringify({ ok: true, mode: preview ? 'preview-only' : 'production', basePath, pages: info.publicRoutes, archives: index.entries.length, files: files.length, bytes, localImages: localMedia.size, localMediaBytes: mediaBytes, externalMedia: info.externalMediaFiles, backendIncluded: false }));
