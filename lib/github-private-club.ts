/** Private club data never belongs in the public website repository or export. */
export const PRIVATE_CLUB_REPOSITORY = 'Durstyone/Hippocampes-prive';
export const PRIVATE_CLUB_BRANCH = 'main';
export const PRIVATE_CLUB_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PRIVATE_CLUB_MEMBERS_PATH = 'club/members.json';
export const PRIVATE_CLUB_DOCUMENTS_PATH = 'club/documents.json';
const MAX_REGISTER_BYTES = 1024 * 1024;
const MAX_RECORDS = 2000;
const API = 'https://api.github.com';
const REPO = `/repos/${PRIVATE_CLUB_REPOSITORY}`;
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_PATH = /^club\/files\/([0-9a-f-]{36})\.(pdf|jpg|jpeg|png|webp)$/i;
const MIME: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export interface PrivateMember {
  id: string; firstName: string; lastName: string; email: string; phone: string;
  emergencyContact: string; level: string; role: 'member' | 'instructor' | 'treasurer' | 'admin';
  groups: string[]; caciExpiry: string; licenseExpiry: string; licenseNumber: string;
  status: 'pending' | 'active' | 'inactive'; season: string; membershipFormReceived: boolean;
  notes: string; archived: boolean; updatedAt: string;
}
export interface PrivateDocument {
  id: string; title: string; category: string; memberId: string; season: string; description: string;
  filePath: string; filename: string; mimeType: string; size: number; archived: boolean; updatedAt: string;
}
export interface PrivateClubSnapshot {
  headSha: string; treeSha: string; members: PrivateMember[]; documents: PrivateDocument[];
  fileShas: Record<string, string>;
}
export interface PrivateClubCommit { sha: string; url: string }
export class PrivateClubError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'PrivateClubError'; this.code = code; }
}

function invalid(message = 'Les informations du dossier sont invalides.'): never { throw new PrivateClubError('validation', message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid('Le dossier contient un champ non pris en charge.');
}
function text(value: unknown, label: string, max: number, optional = true): string {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) invalid(`${label} est obligatoire ou dépasse la longueur autorisée.`);
  return value.trim();
}
function id(value: unknown, optional = false): string {
  if (optional && (value === '' || value === undefined)) return '';
  if (typeof value !== 'string' || !UUID.test(value)) invalid('L’identifiant du dossier est invalide.');
  return value.toLowerCase();
}
function bool(value: unknown, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') invalid('Une case à cocher contient une valeur invalide.');
  return value;
}
function choice<T extends string>(value: unknown, options: T[], fallback: T): T {
  const candidate = value ?? fallback;
  if (typeof candidate !== 'string' || !options.includes(candidate as T)) invalid('Un statut du dossier est invalide.');
  return candidate as T;
}
function day(value: unknown): string {
  const result = text(value, 'La date', 10);
  if (!result) return '';
  const date = new Date(`${result}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || result.startsWith('0000') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result) invalid('Renseignez une date valide au format AAAA-MM-JJ.');
  return result;
}
function timestamp(value: unknown): string {
  const result = text(value, 'La date de modification', 30);
  if (result) {
    const parsed = new Date(result);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(result) || result.startsWith('0000') || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== result.slice(0, 19)) invalid('La date de modification est invalide.');
  }
  return result;
}
function sha(value: unknown): string {
  if (typeof value !== 'string' || !SHA.test(value)) throw new PrivateClubError('response', 'GitHub a renvoyé une version invalide. Rechargez les dossiers.');
  return value;
}
function checkedFilePath(value: unknown, documentId?: string): { path: string; extension: string } {
  if (typeof value !== 'string') invalid('Le chemin du document privé est invalide.');
  const match = FILE_PATH.exec(value);
  if (!match || !UUID.test(match[1]) || value !== value.toLowerCase() || (documentId && match[1] !== documentId)) invalid('Le document doit être un fichier du dossier privé du club.');
  return { path: value, extension: match[2] };
}

export function validatePrivateMember(value: unknown): PrivateMember {
  const item = object(value);
  fields(item, ['id', 'firstName', 'lastName', 'email', 'phone', 'emergencyContact', 'level', 'role', 'groups', 'caciExpiry', 'licenseExpiry', 'licenseNumber', 'status', 'season', 'membershipFormReceived', 'notes', 'archived', 'updatedAt']);
  const email = text(item.email, 'L’adresse email', 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) invalid('L’adresse email est invalide.');
  const rawGroups = item.groups ?? [];
  if (!Array.isArray(rawGroups) || rawGroups.length > 20) invalid('Ajoutez au maximum 20 groupes.');
  const groups = [...new Set(rawGroups.map(value => text(value, 'Le groupe', 80, false)))];
  return {
    id: id(item.id), firstName: text(item.firstName, 'Le prénom', 80, false), lastName: text(item.lastName, 'Le nom', 80, false),
    email, phone: text(item.phone, 'Le téléphone', 50), emergencyContact: text(item.emergencyContact, 'La personne à prévenir', 250),
    level: text(item.level, 'Le niveau', 80), role: choice(item.role, ['member', 'instructor', 'treasurer', 'admin'], 'member'), groups,
    caciExpiry: day(item.caciExpiry), licenseExpiry: day(item.licenseExpiry), licenseNumber: text(item.licenseNumber, 'La licence', 80),
    status: choice(item.status, ['pending', 'active', 'inactive'], 'pending'), season: text(item.season, 'La saison', 40),
    membershipFormReceived: bool(item.membershipFormReceived), notes: text(item.notes, 'Les notes administratives', 4000),
    archived: bool(item.archived), updatedAt: timestamp(item.updatedAt),
  };
}

export function validatePrivateDocument(value: unknown): PrivateDocument {
  const item = object(value);
  fields(item, ['id', 'title', 'category', 'memberId', 'season', 'description', 'filePath', 'filename', 'mimeType', 'size', 'archived', 'updatedAt']);
  const documentId = id(item.id);
  const file = checkedFilePath(item.filePath, documentId);
  const filename = text(item.filename, 'Le nom du fichier', 180, false);
  if (/[\\/\u0000-\u001f]/u.test(filename) || filename.startsWith('.') || filename.split('.').at(-1)?.toLowerCase() !== file.extension) invalid('Le nom du fichier et son format ne correspondent pas.');
  if (item.mimeType !== MIME[file.extension]) invalid('Le type du document ne correspond pas à son extension.');
  if (typeof item.size !== 'number' || !Number.isSafeInteger(item.size) || item.size < 1 || item.size > PRIVATE_CLUB_MAX_FILE_BYTES) invalid('Le document doit peser entre 1 octet et 5 Mio.');
  return {
    id: documentId, title: text(item.title, 'Le titre', 200, false), category: text(item.category, 'La catégorie', 80),
    memberId: id(item.memberId, true), season: text(item.season, 'La saison', 40), description: text(item.description, 'La description', 4000),
    filePath: file.path, filename, mimeType: MIME[file.extension], size: item.size, archived: bool(item.archived), updatedAt: timestamp(item.updatedAt),
  };
}
function list<T extends { id: string }>(value: unknown, validate: (value: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > MAX_RECORDS) invalid('Le registre dépasse la capacité de cet espace.');
  const result = value.map(validate);
  if (new Set(result.map(item => item.id)).size !== result.length) invalid('Le registre contient des identifiants en double.');
  return result;
}
function decodeBase64(value: unknown, max: number): Uint8Array {
  if (typeof value !== 'string' || value.length > Math.ceil(max / 3) * 4 + Math.ceil(max / 40) + 8) invalid('Le fichier est trop volumineux ou invalide.');
  const compact = value.replace(/[\r\n]/g, '');
  if (!compact || compact.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) invalid('Le fichier n’a pas pu être préparé.');
  let binary: string;
  try { binary = atob(compact); } catch { return invalid('Le fichier n’a pas pu être préparé.'); }
  if (!binary.length || binary.length > max) invalid('Le fichier est vide ou trop volumineux.');
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
function dimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 30000 || height > 30000 || width * height > 100000000) invalid('Les dimensions de l’image sont invalides ou trop grandes.');
}
/** Download only. Never execute or embed uploaded documents as HTML. */
export function validatePrivateFile(bytes: Uint8Array, filePath: string): string {
  const { extension } = checkedFilePath(filePath);
  if (!bytes.length || bytes.length > PRIVATE_CLUB_MAX_FILE_BYTES) invalid('Le document doit peser au maximum 5 Mio.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  const u24 = (offset: number) => bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;
  if (extension === 'pdf' && bytes.length >= 16 && /^%PDF-[12]\.\d/.test(ascii(0, 8)) && ascii(Math.max(0, bytes.length - 2048), 2048).includes('%%EOF')) return MIME.pdf;
  if (extension === 'png' && bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) && ascii(12, 4) === 'IHDR' && view.getUint32(8) === 13) { dimensions(view.getUint32(16), view.getUint32(20)); return MIME.png; }
  if (['jpg', 'jpeg'].includes(extension) && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) { dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3)); return MIME[extension]; }
      offset += length;
    }
  }
  if (extension === 'webp' && bytes.length >= 25 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP' && view.getUint32(4, true) + 8 <= bytes.length) {
    const kind = ascii(12, 4);
    if (kind === 'VP8X' && bytes.length >= 30 && view.getUint32(16, true) >= 10) { dimensions(u24(24) + 1, u24(27) + 1); return MIME.webp; }
    if (kind === 'VP8L' && view.getUint32(16, true) >= 5 && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); return MIME.webp; }
    if (kind === 'VP8 ' && bytes.length >= 30 && [0x9d, 0x01, 0x2a].every((byte, i) => bytes[23 + i] === byte)) { dimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff); return MIME.webp; }
  }
  return invalid('Importez un véritable PDF, JPEG, PNG ou WebP avec l’extension correspondante.');
}
interface TreeEntry { path: string; sha: string; mode: string; size?: number }
interface GitState { headSha: string; treeSha: string; entries: TreeEntry[]; fileShas: Record<string, string> }
interface PendingFile { path: string; content: string; encoding?: 'base64' }

export class GitHubPrivateClubClient {
  #token: string;
  #fetch: typeof fetch;
  #controller = new AbortController();
  #login = '';
  #connected = false;
  #saving = false;

  constructor(token: string, fetcher: typeof fetch = fetch) {
    const value = token.trim();
    if (!/^github_pat_[A-Za-z0-9_]{20,250}$/.test(value) && !/^ghp_[A-Za-z0-9]{36,250}$/.test(value)) invalid('Utilisez un jeton GitHub valide : accès fin pour le propriétaire, ou classique pour un collaborateur déjà autorisé.');
    this.#token = value; this.#fetch = fetcher;
  }
  destroy() { this.#token = ''; this.#login = ''; this.#connected = false; this.#controller.abort(); }

  async #request(path: string, method = 'GET', body?: unknown): Promise<Record<string, unknown>> {
    if (!this.#token || this.#controller.signal.aborted) throw new PrivateClubError('authentication', 'Reconnectez-vous pour accéder aux dossiers privés.');
    let response: Response;
    try {
      response = await this.#fetch(API + path, {
        method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.#token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error', signal: this.#controller.signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new PrivateClubError('network', this.#controller.signal.aborted ? 'La connexion privée a été fermée.' : 'GitHub est momentanément inaccessible. Votre saisie reste ouverte.'); }
    if (!response.ok) {
      if (response.status === 401) throw new PrivateClubError('authentication', 'Le jeton GitHub est invalide ou a expiré. Reconnectez-vous.');
      if (response.status === 403 || response.status === 429) throw new PrivateClubError('permission', response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0' ? 'GitHub limite temporairement les requêtes. Réessayez dans un instant.' : 'GitHub refuse cet accès. Autorisez Contents en lecture et écriture sur Hippocampes-prive.');
      if (response.status === 404) throw new PrivateClubError('not-found', 'Le dépôt privé ou son contenu est introuvable. Vérifiez l’accès à Hippocampes-prive et sa branche main.');
      if (response.status === 409 || response.status === 422) throw new PrivateClubError('conflict', 'Le dossier a changé ou la modification a été refusée. Rechargez les données avant de réessayer. Votre saisie reste ouverte.');
      throw new PrivateClubError('service', 'GitHub n’a pas confirmé l’opération. Votre saisie reste ouverte.');
    }
    let result: unknown;
    try { result = await response.json(); } catch { throw new PrivateClubError('response', 'La réponse de GitHub est illisible.'); }
    return object(result);
  }

  async #verifyPrivate() {
    const repo = await this.#request(REPO);
    if (typeof repo.full_name !== 'string' || repo.full_name.toLowerCase() !== PRIVATE_CLUB_REPOSITORY.toLowerCase() || repo.private !== true || (repo.visibility !== undefined && repo.visibility !== 'private')) throw new PrivateClubError('privacy', 'L’accès est bloqué : le dépôt des adhérents doit être privé. Aucun dossier ne sera lu ou enregistré.');
    if (repo.has_pages === true) throw new PrivateClubError('privacy', 'Le dépôt privé ne doit pas publier de site GitHub Pages. Désactivez sa publication avant d’ouvrir les dossiers.');
    const owner = this.#login.toLowerCase() === PRIVATE_CLUB_REPOSITORY.split('/')[0].toLowerCase();
    const canWrite = repo.permissions === undefined ? owner : object(repo.permissions).push === true;
    if (!canWrite || repo.archived === true || repo.disabled === true) throw new PrivateClubError('permission', 'Ce compte ne dispose pas d’un accès d’écriture actif au dépôt privé.');
  }
  async #git(path: string, method = 'GET', body?: unknown) {
    // Check immediately before every content request, including each upload step.
    await this.#verifyPrivate();
    return this.#request(REPO + path, method, body);
  }
  async connect(): Promise<{ login: string; avatarUrl: string }> {
    const user = await this.#request('/user');
    if (typeof user.login !== 'string' || !/^[A-Za-z0-9-]{1,39}$/.test(user.login)) throw new PrivateClubError('response', 'L’identité GitHub n’a pas pu être vérifiée.');
    this.#login = user.login;
    await this.#verifyPrivate();
    this.#connected = true;
    return { login: user.login, avatarUrl: typeof user.avatar_url === 'string' && /^https:\/\/avatars\.githubusercontent\.com\//.test(user.avatar_url) ? user.avatar_url : '' };
  }
  async #state(): Promise<GitState> {
    if (!this.#connected) await this.connect();
    const ref = await this.#git(`/git/ref/heads/${PRIVATE_CLUB_BRANCH}`);
    const refObject = object(ref.object);
    if (refObject.type !== undefined && refObject.type !== 'commit') throw new PrivateClubError('response', 'La branche privée ne référence pas une version valide.');
    const headSha = sha(refObject.sha);
    const commit = await this.#git(`/git/commits/${headSha}`);
    const treeSha = sha(object(commit.tree).sha);
    const tree = await this.#git(`/git/trees/${treeSha}?recursive=1`);
    if (tree.truncated || !Array.isArray(tree.tree) || tree.tree.length > 10000) throw new PrivateClubError('response', 'La liste complète des dossiers privés n’a pas pu être chargée.');
    const entries: TreeEntry[] = [], fileShas: Record<string, string> = Object.create(null);
    for (const raw of tree.tree) {
      const item = object(raw);
      if (typeof item.path !== 'string' || typeof item.type !== 'string' || typeof item.mode !== 'string') throw new PrivateClubError('response', 'La liste des dossiers privés est invalide.');
      if (item.type === 'tree') continue;
      if (item.path.startsWith('club/') && (item.type !== 'blob' || item.mode !== '100644')) throw new PrivateClubError('response', 'Les liens et fichiers spéciaux sont interdits dans les dossiers privés.');
      if (item.type !== 'blob') continue;
      if (Object.hasOwn(fileShas, item.path)) throw new PrivateClubError('response', 'La liste des dossiers privés contient un doublon.');
      if (item.path.startsWith('club/') && item.path !== PRIVATE_CLUB_MEMBERS_PATH && item.path !== PRIVATE_CLUB_DOCUMENTS_PATH) checkedFilePath(item.path);
      const entry: TreeEntry = { path: item.path, sha: sha(item.sha), mode: item.mode };
      if (item.size !== undefined) {
        if (typeof item.size !== 'number' || !Number.isSafeInteger(item.size) || item.size < 0) throw new PrivateClubError('response', 'La taille d’un fichier privé est invalide.');
        entry.size = item.size;
      }
      entries.push(entry); fileShas[item.path] = entry.sha;
    }
    return { headSha, treeSha, entries, fileShas };
  }
  async #blob(fileSha: string, maximum: number): Promise<Uint8Array> {
    const blob = await this.#git(`/git/blobs/${sha(fileSha)}`);
    if (blob.encoding !== 'base64' || typeof blob.size !== 'number' || !Number.isSafeInteger(blob.size) || blob.size < 1 || blob.size > maximum) throw new PrivateClubError('response', 'Le fichier privé est vide, trop volumineux ou illisible.');
    const bytes = decodeBase64(blob.content, maximum);
    if (bytes.byteLength !== blob.size) throw new PrivateClubError('response', 'Le fichier privé reçu est incomplet.');
    return bytes;
  }
  async #register(state: GitState, path: string, key: 'members' | 'documents'): Promise<unknown[]> {
    const entry = state.entries.find(item => item.path === path);
    if (!entry) return [];
    if (entry.mode !== '100644' || (entry.size !== undefined && entry.size > MAX_REGISTER_BYTES)) throw new PrivateClubError('response', 'Le registre privé est invalide ou trop volumineux.');
    const bytes = await this.#blob(entry.sha, MAX_REGISTER_BYTES);
    let raw: unknown;
    try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new PrivateClubError('response', 'Le registre privé ne contient pas un texte valide.'); }
    const value = object(raw);
    fields(value, ['version', key]);
    if (value.version !== 1 || !Array.isArray(value[key])) throw new PrivateClubError('response', 'Le format du registre privé n’est pas pris en charge.');
    return value[key] as unknown[];
  }
  async #snapshot(state: GitState): Promise<PrivateClubSnapshot> {
    const members = list(await this.#register(state, PRIVATE_CLUB_MEMBERS_PATH, 'members'), validatePrivateMember);
    const documents = list(await this.#register(state, PRIVATE_CLUB_DOCUMENTS_PATH, 'documents'), validatePrivateDocument);
    const memberIds = new Set(members.map(member => member.id));
    for (const document of documents) {
      if (document.memberId && !memberIds.has(document.memberId)) throw new PrivateClubError('response', 'Un document est rattaché à un adhérent absent du registre.');
      const entry = state.entries.find(item => item.path === document.filePath);
      if (!entry || entry.mode !== '100644' || (entry.size !== undefined && entry.size !== document.size)) throw new PrivateClubError('response', 'Le fichier d’un document est absent ou ne correspond pas à sa fiche.');
    }
    return { headSha: state.headSha, treeSha: state.treeSha, fileShas: state.fileShas, members, documents };
  }
  async load(): Promise<PrivateClubSnapshot> { return this.#snapshot(await this.#state()); }
  #expected(snapshot: PrivateClubSnapshot, current: GitState, path: string) {
    const previous = snapshot.fileShas[path];
    if (previous !== undefined) sha(previous);
    if ((previous ?? null) !== (current.fileShas[path] ?? null)) throw new PrivateClubError('conflict', 'Le dossier a été modifié depuis son ouverture. Rechargez les données avant d’enregistrer. Votre saisie reste ouverte.');
  }
  #serialize(key: 'members' | 'documents', values: PrivateMember[] | PrivateDocument[]): string {
    const content = JSON.stringify({ version: 1, [key]: values }, null, 2) + '\n';
    if (new TextEncoder().encode(content).byteLength > MAX_REGISTER_BYTES) invalid('Le registre dépasse 1 Mio. Réduisez les notes ou archivez les données dans un outil adapté.');
    return content;
  }
  async #save(snapshot: PrivateClubSnapshot, register: 'members' | 'documents', prepare: (latest: PrivateClubSnapshot) => PendingFile[]): Promise<PrivateClubCommit> {
    if (this.#saving) throw new PrivateClubError('busy', 'Un enregistrement privé est déjà en cours.');
    this.#saving = true;
    try {
      const state = await this.#state();
      const registerPath = register === 'members' ? PRIVATE_CLUB_MEMBERS_PATH : PRIVATE_CLUB_DOCUMENTS_PATH;
      this.#expected(snapshot, state, registerPath);
      const latest = await this.#snapshot(state);
      const pending = prepare(latest);
      for (const file of pending) {
        if (file.path !== registerPath) { checkedFilePath(file.path); this.#expected(snapshot, state, file.path); }
      }
      const treeEntries: Array<{ path: string; mode: string; type: string; content?: string; sha?: string }> = [];
      for (const file of pending) {
        if (file.encoding === 'base64') {
          const blob = await this.#git('/git/blobs', 'POST', { encoding: 'base64', content: file.content });
          treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: sha(blob.sha) });
        } else treeEntries.push({ path: file.path, mode: '100644', type: 'blob', content: file.content });
      }
      const tree = await this.#git('/git/trees', 'POST', { base_tree: state.treeSha, tree: treeEntries });
      const commit = await this.#git('/git/commits', 'POST', { message: register === 'members' ? 'Mettre à jour le registre des adhérents' : 'Mettre à jour les documents privés du club', tree: sha(tree.sha), parents: [state.headSha] });
      const commitSha = sha(commit.sha);
      const ref = await this.#git(`/git/refs/heads/${PRIVATE_CLUB_BRANCH}`, 'PATCH', { sha: commitSha, force: false });
      if (sha(object(ref.object).sha) !== commitSha) throw new PrivateClubError('response', 'GitHub n’a pas confirmé la version enregistrée. Rechargez les données avant de réessayer.');
      return { sha: commitSha, url: `https://github.com/${PRIVATE_CLUB_REPOSITORY}/commit/${commitSha}` };
    } finally { this.#saving = false; }
  }
  async saveMember(member: PrivateMember, snapshot: PrivateClubSnapshot): Promise<PrivateClubCommit> {
    const checked = validatePrivateMember(member);
    return this.#save(snapshot, 'members', latest => {
      const next = { ...checked, updatedAt: new Date().toISOString() };
      const members = latest.members.some(item => item.id === next.id) ? latest.members.map(item => item.id === next.id ? next : item) : [...latest.members, next];
      list(members, validatePrivateMember);
      return [{ path: PRIVATE_CLUB_MEMBERS_PATH, content: this.#serialize('members', members) }];
    });
  }
  async archiveMember(memberId: string, archived: boolean, snapshot: PrivateClubSnapshot): Promise<PrivateClubCommit> {
    const checkedId = id(memberId); bool(archived);
    const member = snapshot.members.find(item => item.id === checkedId);
    if (!member) invalid('Cet adhérent n’est plus présent. Rechargez les dossiers.');
    return this.saveMember({ ...member, archived }, snapshot);
  }
  async saveDocument(document: PrivateDocument, fileBase64: string | null, snapshot: PrivateClubSnapshot): Promise<PrivateClubCommit> {
    const checked = validatePrivateDocument(document);
    let content: string | null = null;
    if (fileBase64 !== null) {
      const bytes = decodeBase64(fileBase64, PRIVATE_CLUB_MAX_FILE_BYTES);
      if (bytes.byteLength !== checked.size || validatePrivateFile(bytes, checked.filePath) !== checked.mimeType) invalid('Le fichier et sa fiche ne correspondent pas.');
      content = fileBase64.replace(/[\r\n]/g, '');
    }
    return this.#save(snapshot, 'documents', latest => {
      if (checked.memberId && !latest.members.some(member => member.id === checked.memberId)) invalid('Choisissez un adhérent du registre privé.');
      const previous = latest.documents.find(item => item.id === checked.id);
      if (content === null && (!previous || previous.filePath !== checked.filePath || previous.mimeType !== checked.mimeType || previous.size !== checked.size)) invalid('Sélectionnez le fichier à joindre à ce document.');
      const next = { ...checked, updatedAt: new Date().toISOString() };
      const documents = previous ? latest.documents.map(item => item.id === next.id ? next : item) : [...latest.documents, next];
      list(documents, validatePrivateDocument);
      return [
        { path: PRIVATE_CLUB_DOCUMENTS_PATH, content: this.#serialize('documents', documents) },
        ...(content === null ? [] : [{ path: checked.filePath, content, encoding: 'base64' as const }]),
      ];
    });
  }
  async archiveDocument(documentId: string, archived: boolean, snapshot: PrivateClubSnapshot): Promise<PrivateClubCommit> {
    const checkedId = id(documentId); bool(archived);
    const document = snapshot.documents.find(item => item.id === checkedId);
    if (!document) invalid('Ce document n’est plus présent. Rechargez les dossiers.');
    return this.saveDocument({ ...document, archived }, null, snapshot);
  }
  async downloadDocument(documentId: string, snapshot: PrivateClubSnapshot): Promise<Blob> {
    const checkedId = id(documentId);
    const expected = snapshot.documents.find(item => item.id === checkedId);
    if (!expected) invalid('Ce document n’est plus présent. Rechargez les dossiers.');
    const state = await this.#state();
    const latest = await this.#snapshot(state);
    const document = latest.documents.find(item => item.id === checkedId);
    if (!document || JSON.stringify(document) !== JSON.stringify(validatePrivateDocument(expected))) throw new PrivateClubError('conflict', 'La fiche de ce document a changé. Rechargez les dossiers avant de le télécharger.');
    this.#expected(snapshot, state, document.filePath);
    const bytes = await this.#blob(state.fileShas[document.filePath], PRIVATE_CLUB_MAX_FILE_BYTES);
    if (bytes.byteLength !== document.size || validatePrivateFile(bytes, document.filePath) !== document.mimeType) throw new PrivateClubError('response', 'Le fichier téléchargé ne correspond pas à sa fiche.');
    return new Blob([new Uint8Array(bytes).buffer], { type: document.mimeType });
  }
}
