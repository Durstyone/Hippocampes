import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GitHubAdminClient, GitHubAdminError, ADMIN_SETTINGS_PATH, validateAdminNews, validateAdminPhoto } from '../lib/github-admin.ts';

// All requests below use this in-memory fake. No GitHub request or write occurs.
const token = 'github_pat_' + 'testonly'.repeat(8);
const sha = n => n.toString(16).padStart(40, '0');
const settings = JSON.parse(await readFile(new URL('../github-pages/content/site-settings.json', import.meta.url), 'utf8'));
const fixture = { title: 'Une plongée à Darnétal', date: '2026-11-28', excerpt: 'Un récit partagé.', body: 'Un premier paragraphe.\n\nUne belle journée !', image: '', url: '' };
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=';
const newsPath = 'github-pages/content/news/sortie.json';
const imagePath = 'public/images/publications/une-sortie.png';
const headers = { 'Content-Type': 'application/json' };
function result(value, status = 200, otherHeaders = {}) { return new Response(JSON.stringify(value), { status, headers: { ...headers, ...otherHeaders } }); }

function backend({ changedNews = false, unrelatedUpdate = false, racingUpdate = false, errorStatus = 0, permissions = { push: true }, login = 'Durstyone' } = {}) {
  const calls = [];
  let reads = 0;
  let current = false;
  const mediaPaths = new Set([settings.season.calendarImage, ...settings.featuredNews.map(item => item.image)].filter(path => path.startsWith('/')));
  const entries = [
    { path: ADMIN_SETTINGS_PATH, sha: sha(3), type: 'blob', mode: '100644' },
    { path: newsPath, sha: sha(4), type: 'blob', mode: '100644' },
    ...[...mediaPaths].map((path, i) => ({ path: 'public' + path, sha: sha(100 + i), type: 'blob', mode: '100644', size: 100 })),
  ];
  const fetcher = async (url, options) => {
    assert.ok(String(url).startsWith('https://api.github.com/'), 'A request escaped GitHub’s API.');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.ok(!String(url).includes(token));
    const method = options.method;
    const path = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method, path, body });
    if (errorStatus) return result({ message: token + ' should never appear in a public error' }, errorStatus);
    if (path === '/user') return result({ login, avatar_url: 'https://avatars.githubusercontent.com/u/1' });
    if (path === '/repos/Durstyone/Hippocampes') return result({ full_name: 'Durstyone/Hippocampes', ...(permissions === null ? {} : { permissions }) });
    if (path.endsWith('/git/ref/heads/main')) { reads++; current = reads > 1; return result({ object: { sha: sha(current && unrelatedUpdate ? 21 : 1) } }); }
    if (method === 'GET' && /\/git\/commits\//.test(path)) return result({ tree: { sha: sha(current && unrelatedUpdate ? 22 : 2) } });
    if (method === 'GET' && /\/git\/trees\//.test(path)) return result({ truncated: false, tree: entries.map(item => item.path === newsPath && current && changedNews ? { ...item, sha: sha(44) } : item) });
    if (method === 'GET' && /\/git\/blobs\//.test(path)) {
      const value = path.endsWith(sha(3)) ? settings : fixture;
      const bytes = Buffer.from(JSON.stringify(value));
      return result({ encoding: 'base64', size: bytes.byteLength, content: bytes.toString('base64') });
    }
    if (path.endsWith('/git/blobs') && method === 'POST') return result({ sha: sha(8) }, 201);
    if (path.endsWith('/git/trees') && method === 'POST') return result({ sha: sha(9) }, 201);
    if (path.endsWith('/git/commits') && method === 'POST') return result({ sha: sha(10) }, 201);
    if (path.endsWith('/git/refs/heads/main') && method === 'PATCH') return result(racingUpdate ? { message: token } : { object: { sha: sha(10) } }, racingUpdate ? 422 : 200);
    throw new Error(`Unexpected mocked request ${method} ${path}`);
  };
  return { calls, fetcher, writes: () => calls.filter(call => call.method !== 'GET') };
}

assert.equal(validateAdminNews(fixture).title, fixture.title);
assert.throws(() => validateAdminNews({ ...fixture, date: '2026-02-30' }), /date valide/);
assert.throws(() => validateAdminNews({ ...fixture, image: 'javascript:alert(1)' }), /HTTPS/);
assert.throws(() => validateAdminNews({ ...fixture, url: 'https://user:password@example.com/' }), /sans identifiants/);
assert.throws(() => validateAdminNews({ ...fixture, published: false }), /champs non pris en charge/);
assert.throws(() => validateAdminNews({ ...fixture, privateNotes: 'confidential' }), /champs non pris en charge/);
assert.throws(() => validateAdminPhoto({ title: 'Photo', image: 'https://example.org/photo.jpg', order: 0 }), /photothèque/);
assert.throws(() => validateAdminPhoto({ title: 'Photo', image: '/images/publications/photo.jpg', order: -1 }), /entier/);

{
  const api = backend({ unrelatedUpdate: true });
  const client = new GitHubAdminClient(token, api.fetcher);
  const account = await client.connect();
  assert.equal(account.login, 'Durstyone');
  const snapshot = await client.load();
  // The unauthenticated build snapshot deliberately omits head/tree SHAs.
  // Exact file SHAs suffice; the commit must use the fresh live head/tree.
  snapshot.headSha = '';
  snapshot.treeSha = '';
  assert.equal(snapshot.news[0].data.title, fixture.title, 'Unicode JSON was not decoded faithfully.');
  const saved = await client.commit([
    { path: imagePath, encoding: 'base64', content: png },
    { path: newsPath, content: JSON.stringify({ ...fixture, image: imagePath.slice(6), body: 'Récit modifié — apnée.' }) },
  ], 'Mettre à jour le récit', snapshot);
  assert.equal(saved.sha, sha(10));
  assert.equal(saved.url, `https://github.com/Durstyone/Hippocampes/commit/${sha(10)}`);
  const tree = api.writes().find(call => call.path.endsWith('/git/trees')).body;
  assert.equal(tree.base_tree, sha(22), 'Unrelated updates must be retained.');
  assert.equal(tree.tree.length, 2);
  assert.match(tree.tree.find(item => item.path === newsPath).content, /Récit modifié — apnée/);
  const commit = api.writes().find(call => call.path.endsWith('/git/commits')).body;
  assert.deepEqual(commit.parents, [sha(21)]);
  assert.deepEqual(api.writes().at(-1).body, { sha: sha(10), force: false });
  assert.equal(api.writes().filter(call => call.method === 'PATCH').length, 1, 'An image and its article must be published in one branch update.');
  client.destroy();
  const count = api.calls.length;
  await assert.rejects(() => client.load(), /Reconnectez-vous/);
  assert.equal(api.calls.length, count, 'Destroyed clients must not send another credential.');
}

{
  const api = backend({ changedNews: true });
  const client = new GitHubAdminClient(token, api.fetcher);
  const snapshot = await client.load();
  await assert.rejects(() => client.commit([{ path: newsPath, content: JSON.stringify(fixture) }], 'Éditer', snapshot), error => error instanceof GitHubAdminError && error.code === 'conflict');
  assert.equal(api.writes().length, 0, 'A conflict must be detected before uploading any object.');
}

{
  const api = backend({ racingUpdate: true });
  const client = new GitHubAdminClient(token, api.fetcher);
  const snapshot = await client.load();
  await assert.rejects(() => client.commit([{ path: newsPath, content: JSON.stringify(fixture) }], 'Éditer', snapshot), error => error.code === 'conflict' && !error.message.includes(token));
  assert.equal(api.writes().at(-1).body.force, false, 'A racing update must never be forced.');
}

{
  const api = backend();
  const client = new GitHubAdminClient(token, api.fetcher);
  const snapshot = await client.load();
  for (const changes of [
    [{ path: '.github/workflows/pages.yml', content: 'unsafe' }],
    [{ path: 'github-pages/content/news/../site-settings.json', content: '{}' }],
    [{ path: ADMIN_SETTINGS_PATH, content: null }],
    [{ path: imagePath, encoding: 'base64', content: Buffer.from('<html>Not an image</html>').toString('base64') }],
    [{ path: newsPath, content: JSON.stringify({ ...fixture, image: '/images/publications/missing.png' }) }],
  ]) {
    await assert.rejects(() => client.commit(changes, 'Vérification', snapshot));
    assert.equal(api.writes().length, 0);
  }
  const usedImage = settings.featuredNews[0].image;
  await assert.rejects(() => client.commit([{ path: 'public' + usedImage, content: null }], 'Supprimer une image utilisée', snapshot), /image choisie est absente/);
  assert.equal(api.writes().length, 0, 'An image referenced by unchanged content must not be removed.');
}

{
  const api = backend({ errorStatus: 401 });
  const client = new GitHubAdminClient(token, api.fetcher);
  await assert.rejects(() => client.connect(), error => error.code === 'authentication' && !error.message.includes(token));
}

{
  const api = backend({ permissions: null });
  assert.equal((await new GitHubAdminClient(token, api.fetcher).connect()).login, 'Durstyone', 'The verified owner must not be rejected when GitHub omits the optional permissions field.');
  const forbidden = backend({ permissions: { push: false } });
  await assert.rejects(() => new GitHubAdminClient(token, forbidden.fetcher).connect(), error => error.code === 'permission');
  const unknownAccount = backend({ permissions: null, login: 'DifferentAccount' });
  await assert.rejects(() => new GitHubAdminClient(token, unknownAccount.fetcher).connect(), error => error.code === 'permission');
}

console.log('GitHub admin: validation, restricted paths, UTF-8, atomic publication, conflict protection, raster checks and credential cleanup passed. No network or repository writes.');
