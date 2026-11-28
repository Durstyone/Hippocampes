import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  GitHubPrivateClubClient, PrivateClubError, PRIVATE_CLUB_REPOSITORY,
  PRIVATE_CLUB_MEMBERS_PATH, PRIVATE_CLUB_DOCUMENTS_PATH, PRIVATE_CLUB_MAX_FILE_BYTES,
  validatePrivateMember, validatePrivateDocument, validatePrivateFile,
} from '../lib/github-private-club.ts';

// Fictional records and an in-memory Git implementation. No network or real data.
const token = 'github_pat_' + 'testonly'.repeat(8);
const sha = n => n.toString(16).padStart(40, '0');
const memberId = '11111111-1111-4111-8111-111111111111';
const documentId = '22222222-2222-4222-8222-222222222222';
const filePath = `club/files/${documentId}.png`;
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=';
const pngBytes = Buffer.from(png, 'base64');
const member = validatePrivateMember({ id: memberId, firstName: 'Élodie', lastName: 'Exemple', email: 'exemple@example.invalid', season: '2026–2027', groups: ['Apnée'], notes: 'Dossier fictif de vérification.' });
const document = validatePrivateDocument({ id: documentId, title: 'Document fictif', category: 'Adhésion', memberId, season: '2026–2027', description: 'Fichier de vérification.', filename: 'fiche.png', filePath, mimeType: 'image/png', size: pngBytes.length });
const serialize = (key, records) => JSON.stringify({ version: 1, [key]: records });
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function backend(options = {}) {
  const calls = [], blobs = new Map(), trees = new Map(), commits = new Map();
  let privateRepo = options.privateRepo ?? true, hasPages = options.hasPages ?? false;
  let counter = 1000, refReads = 0, head = sha(1), nextTree = sha(2);
  const blob = content => {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const digest = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    blobs.set(digest, bytes); return { sha: digest, size: bytes.length, mode: '100644', type: 'blob' };
  };
  const entries = [{ path: 'README.md', ...blob('Private test repository') }];
  if (!options.empty) entries.push({ path: PRIVATE_CLUB_MEMBERS_PATH, ...blob(serialize('members', [member])) });
  if (options.withDocument) {
    entries.push({ path: PRIVATE_CLUB_DOCUMENTS_PATH, ...blob(serialize('documents', [document])) });
    entries.push({ path: filePath, ...blob(pngBytes) });
  }
  if (options.symlink) entries.push({ path: 'club/files/33333333-3333-4333-8333-333333333333.pdf', mode: '120000', type: 'blob', sha: sha(33), size: 30 });
  if (options.externalRef) entries.push({ path: 'club/data', mode: '160000', type: 'commit', sha: sha(34) });
  trees.set(nextTree, entries); commits.set(head, { tree: nextTree });
  function changeFile(path, contents) {
    const current = trees.get(commits.get(head).tree);
    nextTree = sha(++counter);
    trees.set(nextTree, [...current.filter(entry => entry.path !== path), { path, ...blob(contents) }]);
    head = sha(++counter); commits.set(head, { tree: nextTree });
  }
  const fetcher = async (url, request) => {
    assert.ok(String(url).startsWith('https://api.github.com/'));
    assert.ok(!String(url).includes(token));
    assert.equal(request.headers.Authorization, `Bearer ${options.token ?? token}`);
    assert.equal(request.credentials, 'omit'); assert.equal(request.cache, 'no-store');
    assert.equal(request.referrerPolicy, 'no-referrer'); assert.equal(request.redirect, 'error');
    const path = new URL(url).pathname, method = request.method;
    const body = request.body ? JSON.parse(request.body) : undefined;
    if (path.startsWith(`/repos/${PRIVATE_CLUB_REPOSITORY}/`)) {
      assert.equal(calls.at(-1)?.path, `/repos/${PRIVATE_CLUB_REPOSITORY}`, 'Every content request must follow a fresh privacy check.');
      assert.equal(calls.at(-1)?.method, 'GET');
    }
    calls.push({ path, method, body });
    if (options.errorStatus) return jsonResponse({ message: `Private server detail ${token}` }, options.errorStatus);
    if (path === '/user') return jsonResponse({ login: options.login ?? 'Durstyone', avatar_url: 'https://avatars.githubusercontent.com/u/1' });
    assert.ok(path.startsWith(`/repos/${PRIVATE_CLUB_REPOSITORY}`), 'A request escaped the private repository.');
    if (path === `/repos/${PRIVATE_CLUB_REPOSITORY}`) return jsonResponse({ full_name: PRIVATE_CLUB_REPOSITORY, private: privateRepo, visibility: privateRepo ? 'private' : 'public', has_pages: hasPages, ...(options.permissions === null ? {} : { permissions: options.permissions ?? { push: true } }) });
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) {
      refReads++;
      if (refReads === 2 && options.conflict) changeFile(PRIVATE_CLUB_MEMBERS_PATH, serialize('members', [{ ...member, phone: 'Changed elsewhere' }]));
      if (refReads === 2 && options.unrelated) changeFile('README.md', 'Unrelated update');
      return jsonResponse({ object: { type: 'commit', sha: head } });
    }
    if (method === 'GET' && /\/git\/commits\//.test(path)) return jsonResponse({ tree: { sha: commits.get(path.split('/').at(-1)).tree } });
    if (method === 'GET' && /\/git\/trees\//.test(path)) return jsonResponse({ truncated: false, tree: trees.get(path.split('/').at(-1)) });
    if (method === 'GET' && /\/git\/blobs\//.test(path)) {
      const bytes = blobs.get(path.split('/').at(-1));
      return jsonResponse({ encoding: 'base64', content: bytes.toString('base64'), size: options.badBlobSize ? bytes.length + 1 : bytes.length });
    }
    if (method === 'POST' && path.endsWith('/git/blobs')) {
      assert.equal(body.encoding, 'base64');
      const result = blob(Buffer.from(body.content, 'base64'));
      if (options.flipAfterUpload) privateRepo = false;
      return jsonResponse({ sha: result.sha }, 201);
    }
    if (method === 'POST' && path.endsWith('/git/trees')) {
      const base = trees.get(body.base_tree);
      const result = [...base];
      for (const entry of body.tree) {
        const index = result.findIndex(item => item.path === entry.path);
        const next = { path: entry.path, ...(entry.content === undefined ? { sha: entry.sha, mode: entry.mode, type: entry.type, size: blobs.get(entry.sha).length } : blob(entry.content)) };
        if (index < 0) result.push(next); else result[index] = next;
      }
      const treeSha = sha(++counter); trees.set(treeSha, result);
      return jsonResponse({ sha: treeSha }, 201);
    }
    if (method === 'POST' && path.endsWith('/git/commits')) {
      assert.ok(!body.message.includes(member.firstName) && !body.message.includes(member.lastName) && !body.message.includes(document.title), 'No personal data may enter a commit summary.');
      const commitSha = sha(++counter); commits.set(commitSha, { tree: body.tree, parent: body.parents[0] });
      return jsonResponse({ sha: commitSha }, 201);
    }
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/main')) {
      assert.equal(body.force, false);
      if (options.race) return jsonResponse({ message: `Server detail ${token}` }, 422);
      assert.equal(commits.get(body.sha).parent, head);
      head = body.sha; return jsonResponse({ object: { sha: head } });
    }
    throw new Error(`Unexpected mock endpoint ${method} ${path}`);
  };
  return { calls, fetcher, changeFile, setPrivate: value => { privateRepo = value; }, writes: () => calls.filter(call => call.method !== 'GET'), head: () => head, bytes: path => blobs.get(trees.get(commits.get(head).tree).find(entry => entry.path === path)?.sha), latestTree: () => trees.get(commits.get(head).tree) };
}

assert.equal(member.firstName, 'Élodie');
assert.throws(() => validatePrivateMember({ ...member, url: 'https://example.invalid' }), /champ/);
assert.throws(() => validatePrivateMember({ ...member, id: '../private' }), /identifiant/);
assert.throws(() => validatePrivateMember({ ...member, caciExpiry: '2026-02-30' }), /date valide/);
assert.throws(() => validatePrivateMember({ ...member, updatedAt: '2026-02-30T12:00:00.000Z' }), /modification/);
assert.throws(() => validatePrivateMember({ ...member, role: 'superadmin' }), /statut/);
assert.throws(() => validatePrivateDocument({ ...document, visibility: 'public' }), /champ/);
assert.throws(() => validatePrivateDocument({ ...document, filename: '../dossier.png' }), /nom du fichier/);
assert.throws(() => validatePrivateDocument({ ...document, filePath: 'https://example.invalid/file.png' }), /dossier privé/);
assert.throws(() => validatePrivateDocument({ ...document, size: PRIVATE_CLUB_MAX_FILE_BYTES + 1 }), /5 Mio/);
assert.throws(() => validatePrivateDocument({ ...document, mimeType: 'text/html' }), /extension/);
assert.equal(validatePrivateFile(pngBytes, filePath), 'image/png');
assert.throws(() => validatePrivateFile(Buffer.from('<html>Not a PNG</html>'), filePath), /véritable/);
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
assert.equal(validatePrivateFile(pdf, filePath.replace('.png', '.pdf')), 'application/pdf');
assert.throws(() => validatePrivateFile(Buffer.from('%PDF-1.7 incomplete'), filePath.replace('.png', '.pdf')), /véritable/);

{
  const api = backend({ empty: true });
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  const initial = await client.load();
  assert.deepEqual(initial.members, []); assert.deepEqual(initial.documents, []);
  const result = await client.saveMember(member, initial);
  assert.ok(result.url.startsWith(`https://github.com/${PRIVATE_CLUB_REPOSITORY}/commit/`));
  const loaded = await client.load();
  assert.equal(loaded.members[0].firstName, member.firstName);
  assert.equal(loaded.members[0].archived, false);
  await client.archiveMember(member.id, true, loaded);
  const archived = await client.load(); assert.equal(archived.members[0].archived, true);
  await client.archiveMember(member.id, false, archived);
  assert.equal((await client.load()).members[0].archived, false);
  client.destroy();
  const count = api.calls.length;
  await assert.rejects(() => client.load(), error => error.code === 'authentication');
  assert.equal(api.calls.length, count, 'Destroy must prevent all further credential transmission.');
}
{
  const api = backend({ unrelated: true });
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  const initial = await client.load();
  await client.saveMember({ ...initial.members[0], phone: 'Test' }, initial);
  assert.equal(api.bytes('README.md').toString(), 'Unrelated update');
  assert.equal((await client.load()).members[0].phone, 'Test');
  assert.equal(api.writes().at(-1).body.force, false);
}
{
  const api = backend({ conflict: true });
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  const initial = await client.load();
  await assert.rejects(() => client.saveMember({ ...member, phone: 'Test' }, initial), error => error instanceof PrivateClubError && error.code === 'conflict');
  assert.equal(api.writes().length, 0, 'Conflict must be detected before a private upload.');
}
{
  const api = backend({ race: true });
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  const initial = await client.load();
  await assert.rejects(() => client.saveMember(member, initial), error => error.code === 'conflict' && !error.message.includes(token));
  assert.equal(api.head(), initial.headSha);
  assert.equal(api.writes().at(-1).body.force, false);
}
{
  const api = backend();
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  const initial = await client.load();
  await client.saveDocument(document, png, initial);
  assert.equal(api.writes().filter(call => call.method === 'PATCH').length, 1, 'File and document metadata must share a single branch update.');
  const loaded = await client.load();
  assert.equal(loaded.documents[0].title, document.title);
  const download = await client.downloadDocument(document.id, loaded);
  assert.equal(download.type, 'image/png');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pngBytes);
  await client.archiveDocument(document.id, true, loaded);
  const archived = await client.load(); assert.equal(archived.documents[0].archived, true);
  assert.equal(archived.fileShas[filePath], loaded.fileShas[filePath], 'Archiving must preserve file data.');
  await client.archiveDocument(document.id, false, archived);
  assert.equal((await client.load()).documents[0].archived, false);
}
{
  const api = backend();
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  const initial = await client.load();
  await assert.rejects(() => client.saveDocument(document, Buffer.from('invalid').toString('base64'), initial));
  assert.equal(api.writes().length, 0);
  await assert.rejects(() => client.saveDocument(document, null, initial), /Sélectionnez/);
  assert.equal(api.writes().length, 0);
}
{
  const api = backend({ withDocument: true });
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  const initial = await client.load();
  api.changeFile(PRIVATE_CLUB_DOCUMENTS_PATH, serialize('documents', [{ ...document, title: 'Modified elsewhere' }]));
  await assert.rejects(() => client.downloadDocument(document.id, initial), error => error.code === 'conflict');
  const fresh = await client.load();
  api.changeFile(filePath, Buffer.from(pngBytes).fill(0, 40, 44));
  await assert.rejects(() => client.downloadDocument(document.id, fresh), error => error.code === 'conflict');
}
for (const options of [{ privateRepo: false }, { hasPages: true }, { permissions: { push: false } }, { permissions: null, login: 'SomeoneElse' }, { symlink: true }, { externalRef: true }, { badBlobSize: true }]) {
  const api = backend(options);
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  await assert.rejects(() => client.load()); assert.equal(api.writes().length, 0);
  if (options.privateRepo === false || options.hasPages) assert.ok(!api.calls.some(call => call.path.includes('/git/')), 'A public or published repository must never expose private content to the client.');
}
{
  const api = backend({ permissions: null });
  assert.equal((await new GitHubPrivateClubClient(token, api.fetcher).connect()).login, 'Durstyone');
}
{
  const classic = 'ghp_' + 'c'.repeat(36);
  const api = backend({ token: classic, login: 'AuthorizedCollaborator', permissions: { push: true } });
  const client = new GitHubPrivateClubClient(classic, api.fetcher);
  const snapshot = await client.load();
  await client.saveMember({ ...member, phone: 'Test collaborator' }, snapshot);
  assert.equal((await client.load()).members[0].phone, 'Test collaborator');
  const forbidden = backend({ token: classic, login: 'UnauthorizedCollaborator', permissions: { push: false } });
  await assert.rejects(() => new GitHubPrivateClubClient(classic, forbidden.fetcher).connect(), error => error.code === 'permission');
}
{
  const api = backend({ withDocument: true });
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  const initial = await client.load(); api.setPrivate(false);
  const count = api.calls.length;
  await assert.rejects(() => client.downloadDocument(document.id, initial), error => error.code === 'privacy');
  await assert.rejects(() => client.saveMember(member, initial), error => error.code === 'privacy');
  assert.ok(api.calls.slice(count).every(call => call.path === `/repos/${PRIVATE_CLUB_REPOSITORY}`));
  assert.equal(api.writes().length, 0);
}
{
  const api = backend({ flipAfterUpload: true });
  const client = new GitHubPrivateClubClient(token, api.fetcher);
  const initial = await client.load();
  await assert.rejects(() => client.saveDocument(document, png, initial), error => error.code === 'privacy');
  assert.equal(api.writes().length, 1, 'A visibility change during upload must stop further mutations.');
  assert.equal(api.head(), initial.headSha);
}
{
  const api = backend({ errorStatus: 401 });
  await assert.rejects(() => new GitHubPrivateClubClient(token, api.fetcher).connect(), error => error.code === 'authentication' && !error.message.includes(token));
}
console.log('Private club: private repository checks, schema and file validation, atomic saves, concurrent edits, archive/restore, authenticated downloads and token cleanup passed. No real network or member data.');
