/** Real GitHub collaboration on two fixed personal repositories, never a client-only role matrix. */
export type ClubAccessScope = 'site' | 'private';
export const CLUB_ACCESS_OWNER = 'Durstyone';
export const CLUB_ACCESS_REPOSITORIES: Record<ClubAccessScope, string> = { site: 'Durstyone/Hippocampes', private: 'Durstyone/Hippocampes-prive' };
export interface ClubAccessUser { id: number; login: string; name: string; avatarUrl: string; profileUrl: string }
export interface ClubCollaborator { user: ClubAccessUser; owner: boolean }
export interface ClubInvitation { id: number; user: ClubAccessUser | null; createdAt: string }
export interface ClubRepositoryAccess { scope: ClubAccessScope; repository: string; collaborators: ClubCollaborator[]; invitations: ClubInvitation[] }
export type ClubAccessSnapshot = Record<ClubAccessScope, ClubRepositoryAccess>;
export type ClubAccessOutcome = 'invited' | 'active' | 'already-invited' | 'already-active' | 'removed' | 'cancelled' | 'missing' | 'failed';
export interface ClubAccessResult { scope: ClubAccessScope; outcome: ClubAccessOutcome; message: string }
export class ClubAccessError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'ClubAccessError'; this.code = code; }
}
const API = 'https://api.github.com';
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
function invalid(message: string): never { throw new ClubAccessError('validation', message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ClubAccessError('response', 'GitHub a renvoyé une réponse invalide.');
  return value as Record<string, unknown>;
}
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new ClubAccessError('response', 'GitHub a renvoyé un identifiant invalide.'); return value; }
export function validateGitHubLogin(value: string): string {
  const login = value.trim().replace(/^@/, '');
  if (!LOGIN.test(login) || /--/.test(login)) invalid('Indiquez un identifiant GitHub valide, sans adresse email ni URL.');
  return login;
}
function scope(value: ClubAccessScope): ClubAccessScope { if (value !== 'site' && value !== 'private') invalid('Choisissez un périmètre du club.'); return value; }
function parseUser(value: unknown, requirePerson = false): ClubAccessUser {
  const raw = object(value);
  if (typeof raw.login !== 'string' || !LOGIN.test(raw.login) || /--/.test(raw.login) || (requirePerson && raw.type !== 'User')) throw new ClubAccessError('identity', 'Ce compte GitHub ne correspond pas à un compte personnel vérifié.');
  return { id: number(raw.id), login: raw.login, name: typeof raw.name === 'string' ? raw.name.slice(0, 200) : '', avatarUrl: typeof raw.avatar_url === 'string' && /^https:\/\/avatars\.githubusercontent\.com\//.test(raw.avatar_url) ? raw.avatar_url : '', profileUrl: `https://github.com/${raw.login}` };
}
function sameUser(first: ClubAccessUser, second: ClubAccessUser) { return first.id === second.id && first.login.toLowerCase() === second.login.toLowerCase(); }

export class GitHubClubAccessClient {
  #token: string;
  #fetch: typeof fetch;
  #controller = new AbortController();
  #connected = false;
  #mutating = false;
  constructor(token: string, fetcher: typeof fetch = fetch) {
    const value = token.trim();
    if (!/^github_pat_[A-Za-z0-9_]{20,250}$/.test(value)) invalid('Pour gérer les droits, utilisez un jeton à accès fin du propriétaire Durstyone.');
    this.#token = value; this.#fetch = fetcher;
  }
  destroy() { this.#token = ''; this.#connected = false; this.#controller.abort(); }
  async #request(path: string, method = 'GET', body?: unknown, allow404 = false): Promise<{ status: number; data: unknown }> {
    if (!this.#token || this.#controller.signal.aborted) throw new ClubAccessError('authentication', 'Reconnectez le compte propriétaire pour gérer les droits.');
    let response: Response;
    try { response = await this.#fetch(API + path, { method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.#token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error', signal: this.#controller.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { throw new ClubAccessError('network', this.#controller.signal.aborted ? 'La connexion aux droits a été fermée.' : 'GitHub n’a pas confirmé l’opération. Actualisez les accès avant de réessayer.'); }
    if (allow404 && response.status === 404) return { status: 404, data: null };
    if (!response.ok) {
      if (response.status === 401) throw new ClubAccessError('authentication', 'Le jeton est invalide ou a expiré.');
      if (response.status === 403 || response.status === 429) throw new ClubAccessError('permission', response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0' ? 'GitHub limite temporairement les requêtes. Réessayez plus tard.' : 'GitHub refuse l’opération. Le propriétaire doit autoriser Administration en lecture et écriture sur les dépôts concernés.');
      if (response.status === 404) throw new ClubAccessError('not-found', 'Ce compte, ce dépôt ou cette invitation est introuvable avec cet accès.');
      if (response.status === 422) throw new ClubAccessError('rejected', 'GitHub a refusé cette invitation ou la limite d’invitations a été atteinte. Actualisez les accès avant de réessayer.');
      throw new ClubAccessError('service', 'GitHub n’a pas confirmé l’opération. Actualisez les accès avant de réessayer.');
    }
    if (response.status === 204) return { status: 204, data: null };
    try { return { status: response.status, data: await response.json() }; } catch { throw new ClubAccessError('response', 'La réponse de GitHub est illisible. Actualisez les accès.'); }
  }
  async #repository(value: ClubAccessScope) {
    const repository = CLUB_ACCESS_REPOSITORIES[scope(value)];
    const result = object((await this.#request(`/repos/${repository}`)).data);
    const owner = object(result.owner);
    if (result.full_name !== repository || owner.login !== CLUB_ACCESS_OWNER || owner.type !== 'User') throw new ClubAccessError('repository', 'Le dépôt ne correspond plus au compte personnel du club.');
    if (value === 'site' && (result.private !== false || (result.visibility !== undefined && result.visibility !== 'public'))) throw new ClubAccessError('repository', 'La visibilité du dépôt du site a changé. Vérifiez ses réglages GitHub avant de modifier les accès.');
    if (value === 'private' && (result.private !== true || (result.visibility !== undefined && result.visibility !== 'private') || result.has_pages === true)) throw new ClubAccessError('privacy', 'L’accès est bloqué : le dépôt des dossiers doit rester privé et ne doit pas publier de site.');
    if (result.archived === true || result.disabled === true || (result.permissions !== undefined && object(result.permissions).admin !== true)) throw new ClubAccessError('permission', 'Le compte connecté ne dispose pas des droits du propriétaire sur ce dépôt.');
    return repository;
  }
  async #repoRequest(value: ClubAccessScope, path: string, method = 'GET', body?: unknown, allow404 = false) {
    if (!this.#connected) await this.connect();
    const repository = await this.#repository(value);
    return this.#request(`/repos/${repository}${path}`, method, body, allow404);
  }
  async connect(): Promise<ClubAccessUser> {
    const user = parseUser((await this.#request('/user')).data, true);
    if (user.login.toLowerCase() !== CLUB_ACCESS_OWNER.toLowerCase()) throw new ClubAccessError('owner', 'Seul le compte propriétaire Durstyone peut inviter ou retirer des responsables.');
    await this.#repository('site'); await this.#repository('private');
    this.#connected = true; return user;
  }
  async #list(value: ClubAccessScope, suffix: '/collaborators' | '/invitations'): Promise<unknown[]> {
    const items: unknown[] = [];
    for (let page = 1; page <= 10; page++) {
      const response = await this.#repoRequest(value, `${suffix}?per_page=100&page=${page}`);
      if (!Array.isArray(response.data) || response.data.length > 100) throw new ClubAccessError('response', 'La liste des accès GitHub est invalide.');
      items.push(...response.data);
      if (response.data.length < 100) return items;
    }
    throw new ClubAccessError('response', 'La liste des accès est trop longue pour cet écran. Consultez les réglages GitHub.');
  }
  async #loadRepository(value: ClubAccessScope): Promise<ClubRepositoryAccess> {
    const collaborators = (await this.#list(value, '/collaborators')).map(raw => { const user = parseUser(raw); return { user, owner: user.login.toLowerCase() === CLUB_ACCESS_OWNER.toLowerCase() }; });
    const invitations = (await this.#list(value, '/invitations')).map(raw => {
      const item = object(raw);
      if (item.repository !== undefined && object(item.repository).full_name !== CLUB_ACCESS_REPOSITORIES[value]) throw new ClubAccessError('response', 'Une invitation ne correspond pas au dépôt demandé.');
      return { id: number(item.id), user: item.invitee === null || item.invitee === undefined ? null : parseUser(item.invitee), createdAt: typeof item.created_at === 'string' && Number.isFinite(Date.parse(item.created_at)) ? item.created_at : '' };
    });
    if (new Set(collaborators.map(item => item.user.id)).size !== collaborators.length || new Set(invitations.map(item => item.id)).size !== invitations.length) throw new ClubAccessError('response', 'La liste des accès a changé pendant sa lecture. Actualisez-la.');
    return { scope: value, repository: CLUB_ACCESS_REPOSITORIES[value], collaborators, invitations };
  }
  async load(): Promise<ClubAccessSnapshot> { return { site: await this.#loadRepository('site'), private: await this.#loadRepository('private') }; }
  async lookupUser(input: string): Promise<ClubAccessUser> {
    if (!this.#connected) await this.connect();
    const login = validateGitHubLogin(input);
    const user = parseUser((await this.#request(`/users/${encodeURIComponent(login)}`)).data, true);
    if (user.login.toLowerCase() !== login.toLowerCase()) throw new ClubAccessError('identity', 'L’identifiant GitHub a changé. Vérifiez le compte à nouveau.');
    if (user.login.toLowerCase() === CLUB_ACCESS_OWNER.toLowerCase()) invalid('Le propriétaire dispose déjà de tous les accès.');
    return user;
  }
  async #verifyRecipient(expected: ClubAccessUser) {
    const current = await this.lookupUser(expected.login);
    if (!sameUser(expected, current)) throw new ClubAccessError('identity', 'Le compte GitHub a changé depuis sa vérification. Vérifiez à nouveau le destinataire.');
    return current;
  }
  async invite(expected: ClubAccessUser, requestedScopes: ClubAccessScope[]): Promise<ClubAccessResult[]> {
    if (this.#mutating) throw new ClubAccessError('busy', 'Une modification des accès est déjà en cours.');
    if (!Array.isArray(requestedScopes) || !requestedScopes.length || requestedScopes.length > 2 || new Set(requestedScopes).size !== requestedScopes.length) invalid('Choisissez un ou deux périmètres distincts.');
    requestedScopes.forEach(scope);
    this.#mutating = true;
    const results: ClubAccessResult[] = [];
    try {
      const user = await this.#verifyRecipient(expected);
      for (const value of requestedScopes) {
        try {
          const current = await this.#loadRepository(value);
          if (current.collaborators.some(item => item.user.id === user.id)) { results.push({ scope: value, outcome: 'already-active', message: 'Ce compte dispose déjà de cet accès.' }); continue; }
          if (current.invitations.some(item => item.user?.id === user.id)) { results.push({ scope: value, outcome: 'already-invited', message: 'Une invitation est déjà en attente pour ce compte.' }); continue; }
          // Personal repositories have a single collaborator write role. Do not send fictitious granular permissions.
          const response = await this.#repoRequest(value, `/collaborators/${encodeURIComponent(user.login)}`, 'PUT', {});
          if (response.status === 201) {
            const invitation = object(response.data); number(invitation.id);
            if (!sameUser(parseUser(invitation.invitee, true), user)) throw new ClubAccessError('response', 'La réponse ne confirme pas le destinataire attendu. Vérifiez les invitations GitHub.');
            results.push({ scope: value, outcome: 'invited', message: 'Invitation envoyée. Le destinataire doit l’accepter sur GitHub.' });
          } else if (response.status === 204) results.push({ scope: value, outcome: 'active', message: 'GitHub confirme que ce compte dispose de cet accès.' });
          else throw new ClubAccessError('response', 'GitHub n’a pas confirmé l’invitation. Actualisez les accès.');
        } catch (error) { results.push({ scope: value, outcome: 'failed', message: error instanceof ClubAccessError ? error.message : 'L’opération n’a pas été confirmée. Actualisez les accès.' }); }
      }
      return results;
    } finally { this.#mutating = false; }
  }
  async removeCollaborator(value: ClubAccessScope, expected: ClubAccessUser): Promise<ClubAccessResult> {
    scope(value);
    if (this.#mutating) throw new ClubAccessError('busy', 'Une modification des accès est déjà en cours.');
    this.#mutating = true;
    try {
      const user = await this.#verifyRecipient(expected);
      const current = await this.#loadRepository(value);
      if (!current.collaborators.some(item => item.user.id === user.id && !item.owner)) return { scope: value, outcome: 'missing', message: 'Ce compte ne figure plus dans les accès actifs. La liste a été actualisée.' };
      const response = await this.#repoRequest(value, `/collaborators/${encodeURIComponent(user.login)}`, 'DELETE');
      if (response.status !== 204) throw new ClubAccessError('response', 'GitHub n’a pas confirmé le retrait de l’accès.');
      return { scope: value, outcome: 'removed', message: 'Accès retiré sur ce dépôt. Les copies déjà téléchargées ne sont pas effacées.' };
    } finally { this.#mutating = false; }
  }
  async cancelInvitation(value: ClubAccessScope, invitation: ClubInvitation): Promise<ClubAccessResult> {
    scope(value); number(invitation.id);
    if (this.#mutating) throw new ClubAccessError('busy', 'Une modification des accès est déjà en cours.');
    this.#mutating = true;
    try {
      const current = await this.#loadRepository(value);
      const found = current.invitations.find(item => item.id === invitation.id);
      if (!found) return { scope: value, outcome: 'missing', message: 'Cette invitation n’est plus en attente. Vérifiez les accès actifs.' };
      if ((found.user?.id ?? null) !== (invitation.user?.id ?? null)) throw new ClubAccessError('identity', 'Cette invitation a changé. Actualisez la liste avant de continuer.');
      const response = await this.#repoRequest(value, `/invitations/${invitation.id}`, 'DELETE');
      if (response.status !== 204) throw new ClubAccessError('response', 'GitHub n’a pas confirmé l’annulation.');
      return { scope: value, outcome: 'cancelled', message: 'Invitation annulée pour ce dépôt.' };
    } finally { this.#mutating = false; }
  }
}
