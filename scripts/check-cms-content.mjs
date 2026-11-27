import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CMS_MAX_IMAGE_BYTES, inspectCmsImages, readCmsCollection } from './cms-content.mjs';
import { inspectPagesMediaConfiguration } from './check-pages-media-config.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(join(tmpdir(), 'hippocampes-cms-check-'));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=', 'base64');
const json = value => JSON.stringify(value, null, 2) + '\n';
const cleanEnvironment = { ...process.env };
for (const key of Object.keys(cleanEnvironment)) if (key.startsWith('PAGES_') || key.startsWith('GITHUB_')) delete cleanEnvironment[key];

function run(directory, script, shouldPass = true) {
  const result = spawnSync(process.execPath, [resolve(directory, script)], { cwd: directory, env: cleanEnvironment, encoding: 'utf8' });
  const output = (result.stdout || '') + (result.stderr || '');
  if (shouldPass) assert.equal(result.status, 0, output);
  else assert.notEqual(result.status, 0, 'Un contenu invalide a été accepté.');
  return output;
}

try {
  const fixture = resolve(temporary, 'validation');
  const uploads = resolve(fixture, 'public/images/publications');
  const content = resolve(fixture, 'github-pages/content/news');
  await mkdir(uploads, { recursive: true });
  await mkdir(content, { recursive: true });
  await writeFile(resolve(uploads, '.gitkeep'), '');
  await writeFile(resolve(uploads, 'photo.png'), png);
  await writeFile(resolve(fixture, 'public/images/retained.png'), png);
  await writeFile(resolve(fixture, 'github-pages/site.config.json'), json({ mediaBaseUrl: '', mediaMap: {} }));
  await writeFile(resolve(fixture, 'github-pages/local-media.json'), json({ files: ['/images/retained.png'] }));
  await writeFile(resolve(fixture, 'github-pages/media-inventory.json'), json({ files: [{ path: '/images/retained.png' }] }));
  const images = await inspectCmsImages(fixture);
  assert.deepEqual(images.get('/images/publications/photo.png'), { width: 1, height: 1, format: 'png', bytes: png.length });
  assert.deepEqual(await inspectPagesMediaConfiguration({ projectRoot: fixture, env: {} }), { ready: true, total: 0, local: 2, configured: 0, missing: [] });

  // Each rejected upload must be excluded before a deployment can be produced.
  for (const [name, data, error] of [
    ['page.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), /Format d’image interdit/],
    ['pretend.jpg', Buffer.from('<!doctype html><script>alert(1)</script>'), /fichier JPG/],
    ['too-large.png', Buffer.alloc(CMS_MAX_IMAGE_BYTES + 1), /5 Mio/],
    ['unsafe name.png', png, /Nom de fichier/],
  ]) {
    const filename = resolve(uploads, name);
    await writeFile(filename, data);
    await assert.rejects(() => inspectPagesMediaConfiguration({ projectRoot: fixture, env: {} }), error);
    await rm(filename);
  }
  await symlink(resolve(fixture, 'public/images/retained.png'), resolve(uploads, 'linked.png'));
  await assert.rejects(() => inspectCmsImages(fixture), /Lien symbolique/);
  await rm(resolve(uploads, 'linked.png'));
  await writeFile(resolve(content, 'stable-slug.json'), json({ title: 'Un titre modifiable', id: 'ignored-id' }));
  assert.equal((await readCmsCollection(fixture, 'news'))[0].id, 'stable-slug');
  await writeFile(resolve(content, 'draft.json'), json({ title: 'Exemple', published: false }));
  await assert.rejects(() => readCmsCollection(fixture, 'news'), /brouillons privés/);

  // Build an isolated copy with real publication fixtures. Nothing is added to the real site.
  const buildProject = resolve(temporary, 'site');
  await cp(project, buildProject, {
    recursive: true,
    filter: filename => {
      const top = relative(project, filename).split(sep)[0];
      return !['node_modules', 'outputs', '.git'].includes(top) && !top.startsWith('.env');
    },
  });
  const dependencies = process.env.CMS_TEST_NODE_MODULES || resolve(project, 'node_modules');
  assert.ok(existsSync(dependencies), 'Installer les dépendances avant de vérifier le CMS.');
  await symlink(dependencies, resolve(buildProject, 'node_modules'), 'dir');
  for (const directory of ['public/images/publications', 'github-pages/content/news', 'github-pages/content/photos']) await mkdir(resolve(buildProject, directory), { recursive: true });
  const fixtureImage = '/images/publications/qa-cms-fixture.png';
  await writeFile(resolve(buildProject, 'public', '.' + fixtureImage), png);
  const fixtureNews = { title: 'Actualité de vérification', date: '2026-11-27', excerpt: 'Extrait de vérification.', body: 'Premier paragraphe.\n\nDeuxième paragraphe.', image: fixtureImage, url: 'https://example.org/club', privateNotes: 'fixture-never-published' };
  const newsPath = resolve(buildProject, 'github-pages/content/news/qa-cms-fixture.json');
  await writeFile(newsPath, json(fixtureNews));
  await writeFile(resolve(buildProject, 'github-pages/content/photos/qa-cms-fixture.json'), json({ title: 'Photo de vérification', alt: 'Une image de test', album: 'Album de vérification', date: '2026-11-27', description: 'Légende de vérification', image: fixtureImage, order: 2, privateNotes: 'fixture-never-published' }));
  const legacyNewsPath = resolve(buildProject, 'github-pages/content/public-club.json');
  const legacyNews = JSON.parse(await readFile(legacyNewsPath, 'utf8'));
  legacyNews.news.push({ ...fixtureNews, id: 'qa-legacy-fixture', title: 'Publication antérieure conservée' });
  await writeFile(legacyNewsPath, json(legacyNews));
  const legacyPhotosPath = resolve(buildProject, 'github-pages/content/public-media.json');
  const legacyPhotos = JSON.parse(await readFile(legacyPhotosPath, 'utf8'));
  legacyPhotos.photos.push({ id: 'qa-legacy-fixture', title: 'Photo antérieure conservée', published: true, secureUrl: 'https://res.cloudinary.com/example/image/upload/v1/hippocampes-du-robec/01234567-abcd.jpg', width: 1200, height: 800 });
  await writeFile(legacyPhotosPath, json(legacyPhotos));
  run(buildProject, 'scripts/build-github-pages.mjs');
  run(buildProject, 'scripts/check-github-pages.mjs');
  const published = resolve(buildProject, 'outputs/hippocampes-github-pages/www');
  const newsFeed = JSON.parse(await readFile(resolve(published, 'content/public-club.json'), 'utf8'));
  const photoFeed = JSON.parse(await readFile(resolve(published, 'content/public-media.json'), 'utf8'));
  const article = newsFeed.news.find(item => item.id === 'qa-cms-fixture');
  const photo = photoFeed.photos.find(item => item.id === 'qa-cms-fixture');
  assert.equal(article.body, fixtureNews.body);
  assert.equal(article.image, fixtureImage);
  assert.equal(photo.caption, 'Légende de vérification');
  assert.equal(photo.secureUrl, fixtureImage);
  assert.equal(photo.width, 1);
  assert.equal(photo.height, 1);
  assert.equal(photo.bytes, png.length);
  assert.equal(photo.publicId, 'local/qa-cms-fixture');
  assert.equal(photo.published, true);
  assert.ok(newsFeed.news.some(item => item.id === 'qa-legacy-fixture'));
  assert.ok(photoFeed.photos.some(item => item.id === 'qa-legacy-fixture'));
  assert.ok(!('privateNotes' in article) && !('privateNotes' in photo));
  assert.ok(existsSync(resolve(published, 'actualites/qa-cms-fixture/index.html')));
  assert.deepEqual(await readFile(resolve(published, '.' + fixtureImage)), png);

  await writeFile(newsPath, json({ ...fixtureNews, image: 'javascript:alert(1)' }));
  assert.match(run(buildProject, 'scripts/build-github-pages.mjs', false), /URL HTTPS/);
  await writeFile(newsPath, json({ ...fixtureNews, date: '2026-02-30' }));
  assert.match(run(buildProject, 'scripts/build-github-pages.mjs', false), /date de calendrier invalide/);
  console.log(JSON.stringify({ ok: true, checks: ['CMS images auto-published without Cloudinary', 'image type/size/path/symlink rejection', 'stable IDs from filenames', 'public-only news/photo feed projection', 'new article route and local album image', 'unsafe image URL and impossible date rejection'], fixturesPersisted: false }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
