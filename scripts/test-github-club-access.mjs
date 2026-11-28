import assert from 'node:assert/strict';
import { GitHubClubAccessClient, ClubAccessError, CLUB_ACCESS_REPOSITORIES, validateGitHubLogin } from '../lib/github-club-access.ts';

// Entirely in-memory API. These tests never send invitations or contact GitHub.
const token = 'github_pat_' + 'testonly'.repeat(8);
const owner = { id: 1, login: 'Durstyone', type: 'User', name: 'Owner fixture' };
const invitee = { id: 2, login: 'ClubTestAccount', type: 'User', name: 'Fictional test account' };
const result = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function backend(options = {}) {
  const calls = [];
  const collaborators = { site: [owner], private: [owner] }, invitations = { site: [], private: [] };
  let nextId = 10, privateRepo = options.privateRepo ?? true;
  const fetcher = async (url, request) => {
    assert.ok(String(url).startsWith('https://api.github.com/'));
    assert.ok(!String(url).includes(token));
    assert.equal(request.headers.Authorization, `Bearer ${token}`);
    assert.equal(request.cache, 'no-store'); assert.equal(request.credentials, 'omit');
    assert.equal(request.referrerPolicy, 'no-referrer'); assert.equal(request.redirect, 'error');
    const path = new URL(url).pathname, method = request.method, body = request.body ? JSON.parse(request.body) : undefined;
    if (method === 'PUT' || method === 'DELETE') assert.match(calls.at(-1)?.path || '', /^\/repos\/Durstyone\/Hippocampes(?:-prive)?$/, 'Every permission mutation must immediately follow a repository check.');
    calls.push({ path, method, body, query: new URL(url).search });
    if (options.errorStatus) return result({ message: `Never expose ${token}` }, options.errorStatus);
    if (path === '/user') return result({ ...owner, ...(options.ownerLogin ? { login: options.ownerLogin } : {}) });
    if (path.startsWith('/users/')) return result({ ...invitee, ...(options.changedIdentity ? { id: 999 } : {}), ...(options.organization ? { type: 'Organization' } : {}) });
    const scope = path.startsWith('/repos/Durstyone/Hippocampes-prive') ? 'private' : 'site';
    const repoPath = `/repos/${CLUB_ACCESS_REPOSITORIES[scope]}`;
    assert.ok(path === repoPath || path.startsWith(repoPath + '/'), 'Only the two club repositories may be requested.');
    if (path === repoPath) return result({ full_name: CLUB_ACCESS_REPOSITORIES[scope], owner, private: scope === 'private' ? privateRepo : false, visibility: scope === 'private' && privateRepo ? 'private' : 'public', has_pages: false, permissions: { admin: true } });
    if (method === 'GET' && path.endsWith('/collaborators')) return result(collaborators[scope]);
    if (method === 'GET' && path.endsWith('/invitations')) return result(invitations[scope]);
    if (method === 'PUT' && path.endsWith('/collaborators/' + invitee.login)) {
      assert.deepEqual(body, {}, 'Personal repositories must not claim granular role enforcement.');
      if (options.failScope === scope) return result({ message: token }, 403);
      if (options.active) { collaborators[scope].push(invitee); return result(null, 204); }
      const invitation = { id: nextId++, invitee, created_at: '2026-11-28T12:00:00Z', repository: { full_name: CLUB_ACCESS_REPOSITORIES[scope] } };
      invitations[scope].push(invitation); return result(invitation, 201);
    }
    if (method === 'DELETE' && path.endsWith('/collaborators/' + invitee.login)) { collaborators[scope] = collaborators[scope].filter(user => user.id !== invitee.id); return result(null, 204); }
    if (method === 'DELETE' && path.includes('/invitations/')) { invitations[scope] = invitations[scope].filter(invitation => invitation.id !== Number(path.split('/').at(-1))); return result(null, 204); }
    throw new Error(`Unexpected mocked request ${method} ${path}`);
  };
  return { calls, collaborators, invitations, fetcher, writes: () => calls.filter(call => ['PUT', 'DELETE', 'POST', 'PATCH'].includes(call.method)), setPrivate: value => { privateRepo = value; } };
}
assert.equal(validateGitHubLogin(' @ClubTestAccount '), 'ClubTestAccount');
for (const input of ['someone@example.invalid', '../Durstyone', 'https://github.com/user', 'a--b', '']) assert.throws(() => validateGitHubLogin(input));
assert.throws(() => new GitHubClubAccessClient('ghp_' + 'c'.repeat(36)), /accès fin/);
{
  const api = backend({ ownerLogin: 'NotTheOwner' });
  await assert.rejects(() => new GitHubClubAccessClient(token, api.fetcher).connect(), error => error.code === 'owner');
  assert.equal(api.calls.length, 1); assert.equal(api.writes().length, 0);
}
{
  const api = backend({ privateRepo: false });
  await assert.rejects(() => new GitHubClubAccessClient(token, api.fetcher).connect(), error => error.code === 'privacy');
  assert.equal(api.writes().length, 0);
}
{
  const api = backend();
  const client = new GitHubClubAccessClient(token, api.fetcher);
  assert.equal((await client.connect()).login, 'Durstyone');
  const snapshot = await client.load();
  assert.equal(snapshot.site.collaborators[0].owner, true);
  const checked = await client.lookupUser(invitee.login);
  assert.equal(checked.id, invitee.id); assert.equal(api.writes().length, 0, 'Looking up a person must never send an invitation.');
  const outcomes = await client.invite(checked, ['site', 'private']);
  assert.deepEqual(outcomes.map(item => item.outcome), ['invited', 'invited']);
  assert.deepEqual(api.writes().map(call => call.path), [`/repos/${CLUB_ACCESS_REPOSITORIES.site}/collaborators/${invitee.login}`, `/repos/${CLUB_ACCESS_REPOSITORIES.private}/collaborators/${invitee.login}`]);
  const again = await client.invite(checked, ['site', 'private']);
  assert.deepEqual(again.map(item => item.outcome), ['already-invited', 'already-invited']);
  assert.equal(api.writes().length, 2, 'Pending invitations must not be resent.');
  const refreshed = await client.load();
  assert.equal((await client.cancelInvitation('private', refreshed.private.invitations[0])).outcome, 'cancelled');
  assert.equal(api.invitations.private.length, 0);
  assert.equal(api.invitations.site.length, 1, 'Cancelling a private invite must not affect the site invitation.');
  client.destroy(); const count = api.calls.length;
  await assert.rejects(() => client.load(), error => error.code === 'authentication');
  assert.equal(api.calls.length, count, 'Disconnected clients must not transmit a token.');
}
{
  const api = backend({ failScope: 'private' });
  const client = new GitHubClubAccessClient(token, api.fetcher);
  const user = await client.lookupUser(invitee.login);
  const outcomes = await client.invite(user, ['site', 'private']);
  assert.deepEqual(outcomes.map(item => item.outcome), ['invited', 'failed']);
  assert.ok(!outcomes[1].message.includes(token));
  assert.equal(api.invitations.site.length, 1, 'The UI must report partial success; earlier invitations are not rolled back.');
  assert.equal(api.invitations.private.length, 0);
}
{
  const api = backend({ active: true });
  const client = new GitHubClubAccessClient(token, api.fetcher);
  const user = await client.lookupUser(invitee.login);
  assert.equal((await client.invite(user, ['site']))[0].outcome, 'active');
  assert.equal((await client.invite(user, ['site']))[0].outcome, 'already-active');
  assert.equal((await client.removeCollaborator('site', user)).outcome, 'removed');
  assert.deepEqual(api.collaborators.site, [owner]);
  assert.equal((await client.removeCollaborator('site', user)).outcome, 'missing');
}
{
  const api = backend({ organization: true });
  await assert.rejects(() => new GitHubClubAccessClient(token, api.fetcher).lookupUser(invitee.login), error => error.code === 'identity');
  assert.equal(api.writes().length, 0);
}
{
  const api = backend({ changedIdentity: true });
  const client = new GitHubClubAccessClient(token, api.fetcher);
  await assert.rejects(() => client.invite({ ...invitee, avatarUrl: '', profileUrl: 'https://github.com/' + invitee.login }, ['site']), error => error.code === 'identity');
  assert.equal(api.writes().length, 0, 'An account identity change must block permission changes.');
}
{
  const api = backend();
  const client = new GitHubClubAccessClient(token, api.fetcher);
  const user = await client.lookupUser(invitee.login); api.setPrivate(false);
  const result = await client.invite(user, ['private']);
  assert.equal(result[0].outcome, 'failed'); assert.match(result[0].message, /privé/); assert.equal(api.writes().length, 0);
  await assert.rejects(() => client.invite(user, ['other']));
}
{
  const api = backend({ errorStatus: 401 });
  await assert.rejects(() => new GitHubClubAccessClient(token, api.fetcher).connect(), error => error instanceof ClubAccessError && error.code === 'authentication' && !error.message.includes(token));
}
{
  const api = backend();
  let release, reached;
  const pending = new Promise(resolve => { release = resolve; });
  const uploading = new Promise(resolve => { reached = resolve; });
  const client = new GitHubClubAccessClient(token, async (url, request) => {
    if (request.method === 'PUT') { reached(); await pending; }
    return api.fetcher(url, request);
  });
  const user = await client.lookupUser(invitee.login);
  const first = client.invite(user, ['site']);
  await uploading;
  await assert.rejects(() => client.invite(user, ['private']), error => error.code === 'busy');
  release();
  assert.equal((await first)[0].outcome, 'invited');
  assert.equal(api.writes().length, 1, 'Concurrent permission actions must be locked.');
}
console.log('Club access: owner-only control, fixed repositories, recipient identity, private visibility, real collaborator rights, invitations, partial success, cancellation, revocation and token cleanup passed. No invitations sent and no network.');
