import { validateSiteSettings, type PublicSiteSettings } from './public-site-settings.mjs';
import { validatePublicDocument, validatePublicPdf, type PublicDocument } from './public-documents.mjs';

/** The editor can write public club content in this repository only. */
export const ADMIN_REPOSITORY = 'Durstyone/Hippocampes';
export const ADMIN_BRANCH = 'main';
export const ADMIN_SETTINGS_PATH = 'github-pages/content/site-settings.json';
export const ADMIN_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_COMMIT_BYTES = 20 * 1024 * 1024;
const MAX_JSON_BYTES = 512 * 1024;
const API = 'https://api.github.com';
const REPO_API = `/repos/${ADMIN_REPOSITORY}`;
const safeId = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,219}$/;
const shaPattern = /^[a-f0-9]{40}$/;
const rasterPattern = /\.(?:jpe?g|png|webp|gif)$/i;

export interface AdminNews { title: string; date: string; excerpt: string; body: string; image: string; url: string }
export interface AdminPhoto { title: string; image: string; alt: string; album: string; date: string; description: string; credit?: string; order: number }
export interface ManagedRecord<T> { id: string; path: string; sha: string; data: T }
export interface AdminMedia { path: string; repoPath: string; sha: string; name: string; size?: number }
export interface AdminSnapshot {
  headSha: string;
  treeSha: string;
  settings: PublicSiteSettings;
  settingsSha: string;
  news: ManagedRecord<AdminNews>[];
  photos: ManagedRecord<AdminPhoto>[];
  documents: ManagedRecord<PublicDocument>[];
  documentFiles: AdminMedia[];
  media: AdminMedia[];
  fileShas: Record<string, string>;
}
export interface AdminChange { path: string; content: string | null; encoding?: 'utf-8' | 'base64' }

export class GitHubAdminError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'GitHubAdminError'; this.code = code; }
}

function invalid(message: string): never { throw new GitHubAdminError('validation', message); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${label} doit être un objet valide.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number, optional = false): string {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) invalid(`${label} doit contenir ${optional ? 'au maximum' : 'entre 1 et'} ${max} caractères valides.`);
  return value.trim();
}
function knownFields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid('Ce contenu contient des champs non pris en charge. Seuls les champs publics du formulaire peuvent être enregistrés.');
}
function date(value: unknown, label: string, optional = false, timestamp = false): string {
  const input = text(value, label, timestamp ? 40 : 10, optional);
  if (!input && optional) return '';
  const day = input.slice(0, 10);
  const parsedDay = new Date(`${day}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.startsWith('0000') || !Number.isFinite(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== day || (!timestamp && input.length !== 10) || (timestamp && input.length > 10 && (!/^\d{4}-\d{2}-\d{2}T\S+$/.test(input) || !Number.isFinite(Date.parse(input))))) invalid(`${label} doit être une date valide au format AAAA-MM-JJ.`);
  return input;
}
function httpsUrl(value: unknown, label: string, optional = false): string {
  const input = text(value, label, 8192, optional);
  if (!input && optional) return '';
  let parsed: URL;
  try { parsed = new URL(input); } catch { return invalid(`${label} doit être une adresse HTTPS valide.`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /[\u0000-\u0020<>"\\]/u.test(input) || /^(?:localhost|127\.|0\.|\[?::1\]?$)/i.test(parsed.hostname)) invalid(`${label} doit être une adresse HTTPS publique, sans identifiants.`);
  return input;
}
function isPublicRasterPath(path: string): boolean {
  return /^\/(?:images\/|media\/archive\/)/.test(path) && rasterPattern.test(path) && path.slice(1).split('/').every(segment => safeId.test(segment) && segment !== '.' && segment !== '..');
}
function image(value: unknown, label: string, localOnly: boolean, optional = false): string {
  const input = text(value, label, 8192, optional);
  if (!input && optional) return '';
  if (isPublicRasterPath(input)) return input;
  if (localOnly || input.startsWith('/')) invalid(`${label} doit désigner une image JPG, PNG, WebP ou GIF de la photothèque.`);
  return httpsUrl(input, label);
}

export function validateAdminNews(value: unknown): AdminNews {
  const item = object(value, 'L’actualité');
  knownFields(item, ['title', 'date', 'excerpt', 'body', 'image', 'url']);
  return {
    title: text(item.title, 'Le titre', 1000),
    date: date(item.date, 'La date de publication', false, true),
    excerpt: text(item.excerpt, 'Le résumé', 10000, true),
    body: text(item.body, 'Le texte', 300000, true),
    image: image(item.image, 'La photo de couverture', false, true),
    url: httpsUrl(item.url, 'Le lien complémentaire', true),
  };
}

export function validateAdminPhoto(value: unknown): AdminPhoto {
  const item = object(value, 'La photo');
  knownFields(item, ['title', 'image', 'alt', 'album', 'date', 'description', 'credit', 'order']);
  const order = item.order ?? 0;
  if (typeof order !== 'number' || !Number.isSafeInteger(order) || order < 0 || order > 1000000) invalid('L’ordre de la photo doit être un entier entre 0 et 1 000 000.');
  return {
    title: text(item.title, 'Le titre de la photo', 1000),
    image: image(item.image, 'La photo', true),
    alt: text(item.alt, 'La description de la photo', 2000, true),
    album: text(item.album, 'Le nom de l’album', 1000, true),
    date: date(item.date, 'La date de la sortie', true),
    description: text(item.description, 'La légende', 10000, true),
    credit: text(item.credit, 'Le crédit photo', 1000, true),
    order,
  };
}

function isPublicPdfPath(path: string): boolean { return /^\/(?:documents\/fichiers|media\/archive)\/[A-Za-z0-9][A-Za-z0-9_-]*\.pdf$/.test(path) && path.slice(path.lastIndexOf('/') + 1).length <= 180; }
type ContentKind = 'settings' | 'news' | 'photos' | 'documents' | 'image' | 'pdf';
function contentKind(path: string): ContentKind {
  if (path === ADMIN_SETTINGS_PATH) return 'settings';
  const collection = /^github-pages\/content\/(news|photos|documents)\/([^/]+)\.json$/.exec(path);
  if (collection?.[1] === 'documents' && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(collection[2])) return invalid('Le nom du document public contient des caractères non autorisés.');
  if (collection && safeId.test(collection[2]) && collection[2] !== '.' && collection[2] !== '..') return collection[1] as 'news' | 'photos' | 'documents';
  if (path.startsWith('public/images/publications/') && isPublicRasterPath(path.slice('public'.length))) return 'image';
  if (path.startsWith('public/documents/fichiers/') && isPublicPdfPath(path.slice('public'.length))) return 'pdf';
  return invalid('Ce fichier ne fait pas partie des contenus modifiables du site.');
}
function checkedSha(value: unknown): string {
  if (typeof value !== 'string' || !shaPattern.test(value)) throw new GitHubAdminError('response', 'GitHub a renvoyé une version de fichier invalide. Rechargez les contenus avant de réessayer.');
  return value;
}
function decodeBase64(value: unknown, maxBytes: number): Uint8Array {
  if (typeof value !== 'string' || value.length > Math.ceil(maxBytes / 3) * 4 + Math.ceil(maxBytes / 40) + 8) invalid('Le contenu reçu est trop volumineux ou invalide.');
  const compact = value.replace(/[\r\n]/g, '');
  if (compact.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) invalid('Le contenu du fichier n’est pas un encodage valide.');
  let binary: string;
  try { binary = atob(compact); } catch { return invalid('Le contenu du fichier n’est pas un encodage valide.'); }
  if (!binary.length || binary.length > maxBytes) invalid('Le contenu du fichier est vide ou trop volumineux.');
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function parseJson(content: string, label: string): unknown {
  try { return JSON.parse(content); } catch { return invalid(`${label} ne contient pas un document valide.`); }
}
function decodeJson(value: unknown): unknown {
  try { return parseJson(new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64(value, MAX_JSON_BYTES)), 'Le fichier'); }
  catch (error) {
    if (error instanceof GitHubAdminError) throw error;
    return invalid('Le fichier ne contient pas un texte UTF‑8 valide.');
  }
}
function imageDimensions(width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 30000 || height > 30000 || width * height > 100000000) invalid('Les dimensions de l’image sont invalides ou trop grandes.');
}
/** Check actual raster headers; an extension or browser MIME type alone is not sufficient. */
function validateRaster(bytes: Uint8Array, path: string) {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  const u24 = (offset: number) => bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;
  if (extension === '.png' && bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) && ascii(12, 4) === 'IHDR' && view.getUint32(8) === 13) { imageDimensions(view.getUint32(16), view.getUint32(20)); return; }
  if (extension === '.gif' && bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6))) { imageDimensions(view.getUint16(6, true), view.getUint16(8, true)); return; }
  if (['.jpg', '.jpeg'].includes(extension) && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
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
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) { imageDimensions(view.getUint16(offset + 5), view.getUint16(offset + 3)); return; }
      offset += length;
    }
  }
  if (extension === '.webp' && bytes.length >= 25 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP' && view.getUint32(4, true) + 8 <= bytes.length) {
    const kind = ascii(12, 4);
    if (kind === 'VP8X' && bytes.length >= 30 && view.getUint32(16, true) >= 10) { imageDimensions(u24(24) + 1, u24(27) + 1); return; }
    if (kind === 'VP8L' && view.getUint32(16, true) >= 5 && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); imageDimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); return; }
    if (kind === 'VP8 ' && bytes.length >= 30 && [0x9d, 0x01, 0x2a].every((byte, i) => bytes[23 + i] === byte)) { imageDimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff); return; }
  }
  invalid('Le fichier doit être une véritable image JPG, PNG, WebP ou GIF, avec l’extension correspondante.');
}

interface GitTreeItem { path: string; sha: string; type: string; mode: string; size?: number }
interface GitState { headSha: string; treeSha: string; entries: GitTreeItem[]; fileShas: Record<string, string> }
interface PreparedChange extends AdminChange { kind: ContentKind; parsed?: PublicSiteSettings | AdminNews | AdminPhoto | PublicDocument }

export class GitHubAdminClient {
  #token: string;
  #fetch: typeof fetch;
  #controller = new AbortController();
  #connected = false;
  #saving = false;

  constructor(token: string, fetcher: typeof fetch = fetch) {
    const trimmed = token.trim();
    if (!/^(?:github_pat_[A-Za-z0-9_]{20,250}|ghp_[A-Za-z0-9]{30,255})$/.test(trimmed)) invalid('Utilisez un jeton GitHub personnel valide. Le propriétaire peut le limiter au dépôt Hippocampes ; les collaborateurs utilisent un jeton classique.');
    this.#token = trimmed;
    this.#fetch = fetcher;
  }

  destroy() { this.#token = ''; this.#connected = false; this.#controller.abort(); }

  async #request(path: string, method = 'GET', body?: unknown): Promise<Record<string, unknown>> {
    if (!this.#token || this.#controller.signal.aborted) throw new GitHubAdminError('authentication', 'Reconnectez-vous à GitHub pour enregistrer vos modifications.');
    let response: Response;
    try {
      response = await this.#fetch(API + path, {
        method,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.#token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error', signal: this.#controller.signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new GitHubAdminError('network', this.#controller.signal.aborted ? 'La connexion a été fermée. Vos modifications restent dans le formulaire.' : 'GitHub est momentanément inaccessible. Vos modifications restent dans le formulaire ; réessayez sans fermer cette page.');
    }
    if (!response.ok) {
      if (response.status === 401) throw new GitHubAdminError('authentication', 'Le jeton GitHub est invalide ou a expiré. Reconnectez-vous ; vos modifications restent dans le formulaire.');
      if (response.status === 403 || response.status === 429) throw new GitHubAdminError('permission', response.headers.get('x-ratelimit-remaining') === '0' || response.status === 429 ? 'GitHub limite temporairement les requêtes. Attendez quelques instants avant de réessayer.' : 'GitHub refuse cette opération. Vérifiez que le jeton vise Hippocampes et autorise Contents en lecture et écriture.');
      if (response.status === 409 || response.status === 422) throw new GitHubAdminError('conflict', 'Le dépôt a changé ou GitHub a refusé cette modification. Vos saisies sont conservées. Rechargez les contenus avant de réessayer.');
      if (response.status === 404) throw new GitHubAdminError('not-found', 'Le contenu GitHub est introuvable ou le jeton ne permet pas d’y accéder.');
      throw new GitHubAdminError('service', 'GitHub n’a pas confirmé l’opération. Vos modifications restent dans le formulaire.');
    }
    let result: unknown;
    try { result = await response.json(); } catch { throw new GitHubAdminError('response', 'La réponse de GitHub est illisible. Vos modifications restent dans le formulaire.'); }
    return object(result, 'La réponse GitHub');
  }

  async connect(): Promise<{ login: string; avatarUrl: string }> {
    const user = await this.#request('/user');
    if (typeof user.login !== 'string' || !/^[A-Za-z0-9-]{1,39}$/.test(user.login)) throw new GitHubAdminError('response', 'L’identité GitHub n’a pas pu être vérifiée.');
    const repo = await this.#request(REPO_API);
    // `permissions` is optional in GitHub's repository response. The verified
    // owner remains identifiable when it is absent; API mutations still enforce
    // the token's Contents permission. A read check is not a proof of write scope.
    const owner = user.login.toLowerCase() === ADMIN_REPOSITORY.split('/')[0].toLowerCase();
    const hasAccess = repo.permissions === undefined ? owner : object(repo.permissions, 'Les droits GitHub').push === true;
    if (typeof repo.full_name !== 'string' || repo.full_name.toLowerCase() !== ADMIN_REPOSITORY.toLowerCase() || !hasAccess) throw new GitHubAdminError('permission', 'Ce compte GitHub ne possède pas les droits d’écriture sur Durstyone/Hippocampes.');
    this.#connected = true;
    const avatar = typeof user.avatar_url === 'string' && /^https:\/\/avatars\.githubusercontent\.com\//.test(user.avatar_url) ? user.avatar_url : '';
    return { login: user.login, avatarUrl: avatar };
  }

  async #gitState(): Promise<GitState> {
    const ref = await this.#request(`${REPO_API}/git/ref/heads/${ADMIN_BRANCH}`);
    const headSha = checkedSha(object(ref.object, 'La branche GitHub').sha);
    const commit = await this.#request(`${REPO_API}/git/commits/${headSha}`);
    const treeSha = checkedSha(object(commit.tree, 'L’arbre GitHub').sha);
    const tree = await this.#request(`${REPO_API}/git/trees/${treeSha}?recursive=1`);
    if (tree.truncated || !Array.isArray(tree.tree) || tree.tree.length > 20000) throw new GitHubAdminError('response', 'GitHub n’a pas renvoyé la liste complète des fichiers. Aucune modification ne sera enregistrée.');
    const entries: GitTreeItem[] = [];
    const fileShas: Record<string, string> = Object.create(null);
    for (const raw of tree.tree) {
      const item = object(raw, 'Un fichier GitHub');
      if (typeof item.path !== 'string' || typeof item.type !== 'string' || typeof item.mode !== 'string') throw new GitHubAdminError('response', 'La liste des fichiers GitHub est invalide.');
      if (item.type !== 'blob') continue;
      const path = item.path;
      if (Object.hasOwn(fileShas, path)) throw new GitHubAdminError('response', 'La liste des fichiers GitHub contient un doublon.');
      const sha = checkedSha(item.sha);
      fileShas[path] = sha;
      entries.push({ path, sha, type: item.type, mode: item.mode, ...(typeof item.size === 'number' ? { size: item.size } : {}) });
    }
    return { headSha, treeSha, entries, fileShas };
  }

  async #json(sha: string): Promise<unknown> {
    const blob = await this.#request(`${REPO_API}/git/blobs/${checkedSha(sha)}`);
    if (blob.encoding !== 'base64' || typeof blob.size !== 'number' || blob.size < 1 || blob.size > MAX_JSON_BYTES) throw new GitHubAdminError('response', 'Ce contenu est vide, trop volumineux ou ne peut pas être lu.');
    return decodeJson(blob.content);
  }

  async load(): Promise<AdminSnapshot> {
    if (!this.#connected) await this.connect();
    return this.#snapshot(await this.#gitState());
  }

  async #snapshot(state: GitState): Promise<AdminSnapshot> {
    const settingsFile = state.entries.find(entry => entry.path === ADMIN_SETTINGS_PATH);
    if (!settingsFile || settingsFile.mode !== '100644') throw new GitHubAdminError('response', 'Le fichier des réglages du site est absent ou invalide.');
    const settings = validateSiteSettings(await this.#json(settingsFile.sha));
    const news: ManagedRecord<AdminNews>[] = [];
    const photos: ManagedRecord<AdminPhoto>[] = [];
    const documents: ManagedRecord<PublicDocument>[] = [];
    const collections = state.entries.filter(entry => /^github-pages\/content\/(?:news|photos|documents)\/[^/]+\.json$/.test(entry.path));
    // Small bounded batches avoid flooding the API as the collection grows.
    for (let offset = 0; offset < collections.length; offset += 6) {
      await Promise.all(collections.slice(offset, offset + 6).map(async entry => {
        const kind = contentKind(entry.path);
        if (entry.mode !== '100644') throw new GitHubAdminError('response', 'Un contenu modifiable n’est pas un fichier ordinaire.');
        const id = entry.path.slice(entry.path.lastIndexOf('/') + 1, -5);
        const raw = await this.#json(entry.sha);
        if (kind === 'news') news.push({ id, path: entry.path, sha: entry.sha, data: validateAdminNews(raw) });
        if (kind === 'photos') photos.push({ id, path: entry.path, sha: entry.sha, data: validateAdminPhoto(raw) });
        if (kind === 'documents') documents.push({ id, path: entry.path, sha: entry.sha, data: validatePublicDocument(raw) });
      }));
    }
    news.sort((a, b) => b.data.date.localeCompare(a.data.date) || a.id.localeCompare(b.id));
    photos.sort((a, b) => a.data.order - b.data.order || b.data.date.localeCompare(a.data.date) || a.id.localeCompare(b.id));
    const media = state.entries.filter(entry => entry.mode === '100644' && entry.path.startsWith('public/') && isPublicRasterPath(entry.path.slice('public'.length))).map(entry => ({ path: entry.path.slice('public'.length), repoPath: entry.path, sha: entry.sha, name: entry.path.slice(entry.path.lastIndexOf('/') + 1), size: entry.size }));
    documents.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title, 'fr'));
    const documentFiles = state.entries.filter(entry => entry.mode === '100644' && entry.path.startsWith('public/') && isPublicPdfPath(entry.path.slice(6))).map(entry => ({ path: entry.path.slice(6), repoPath: entry.path, sha: entry.sha, name: entry.path.slice(entry.path.lastIndexOf('/') + 1), size: entry.size }));
    return { ...state, settings, settingsSha: settingsFile.sha, news, photos, media, documents, documentFiles };
  }

  async commit(changes: AdminChange[], message: string, snapshot: AdminSnapshot): Promise<{ sha: string; url: string }> {
    if (this.#saving) throw new GitHubAdminError('busy', 'Un enregistrement est déjà en cours.');
    this.#saving = true;
    try {
      if (!this.#connected) await this.connect();
      if (!Array.isArray(changes) || !changes.length || changes.length > 100) invalid('Choisissez entre 1 et 100 fichiers à enregistrer ensemble.');
      const commitMessage = text(message, 'Le résumé de la modification', 500);
      const paths = new Set<string>();
      let bytes = 0;
      const prepared: PreparedChange[] = changes.map(change => {
        if (!change || typeof change.path !== 'string') return invalid('Un chemin de fichier est invalide.');
        const kind = contentKind(change.path);
        if (paths.has(change.path)) invalid('Un même fichier ne peut être modifié deux fois dans un enregistrement.');
        paths.add(change.path);
        if (change.content === null) {
          if (kind === 'settings') invalid('Les réglages du site ne peuvent pas être supprimés.');
          return { path: change.path, content: null, kind };
        }
        if (typeof change.content !== 'string') return invalid('Le contenu d’un fichier est invalide.');
        if (kind === 'image' || kind === 'pdf') {
          if (change.encoding !== 'base64') invalid('L’image doit être préparée avant son envoi.');
          const data = decodeBase64(change.content, ADMIN_MAX_IMAGE_BYTES);
          if (kind === 'image') validateRaster(data, change.path); else validatePublicPdf(data);
          bytes += data.byteLength;
          if (bytes > MAX_COMMIT_BYTES) invalid('Cet enregistrement dépasse 20 Mio. Ajoutez moins de photos à la fois.');
          return { path: change.path, content: change.content.replace(/[\r\n]/g, ''), encoding: 'base64', kind };
        }
        if (change.encoding && change.encoding !== 'utf-8') invalid('Les textes doivent être encodés en UTF‑8.');
        if (new TextEncoder().encode(change.content).byteLength > MAX_JSON_BYTES) invalid('Ce contenu dépasse la limite de 512 Kio.');
        const raw = parseJson(change.content, 'Le contenu');
        const parsed = kind === 'settings' ? validateSiteSettings(raw) : kind === 'news' ? validateAdminNews(raw) : kind === 'documents' ? validatePublicDocument(raw) : validateAdminPhoto(raw);
        const content = JSON.stringify(parsed, null, 2) + '\n';
        const length = new TextEncoder().encode(content).byteLength;
        if (length > MAX_JSON_BYTES) invalid('Ce contenu dépasse la limite de 512 Kio.');
        bytes += length;
        return { path: change.path, content, encoding: 'utf-8', kind, parsed };
      });
      if (bytes > MAX_COMMIT_BYTES) invalid('Cet enregistrement dépasse 20 Mio. Ajoutez moins de photos à la fois.');
      const current = await this.#gitState();
      for (const change of prepared) {
        if (current.fileShas[change.path] !== snapshot.fileShas[change.path]) throw new GitHubAdminError('conflict', 'Un contenu que vous modifiez a été changé ailleurs. Vos saisies sont conservées ; rechargez la version GitHub avant de les appliquer.');
        if (change.content === null && !current.fileShas[change.path]) invalid('Ce contenu a déjà été supprimé.');
        const existing = current.entries.find(entry => entry.path === change.path);
        if (existing && existing.mode !== '100644') invalid('Ce chemin ne désigne pas un fichier ordinaire modifiable.');
      }
      const availableImages = new Set(current.entries.filter(entry => entry.mode === '100644' && entry.path.startsWith('public/') && isPublicRasterPath(entry.path.slice(6))).map(entry => entry.path.slice(6)));
      for (const change of prepared.filter(item => item.kind === 'image')) {
        if (change.content === null) availableImages.delete(change.path.slice(6));
        else availableImages.add(change.path.slice(6));
      }
      const checkImage = (path: string) => { if (path.startsWith('/') && !availableImages.has(path)) invalid('Une image choisie est absente de la photothèque. Ajoutez-la dans le même enregistrement ou choisissez une autre photo.'); };
      const availablePdfs = new Set(current.entries.filter(entry => entry.mode === '100644' && entry.path.startsWith('public/') && isPublicPdfPath(entry.path.slice(6))).map(entry => entry.path.slice(6)));
      for (const change of prepared.filter(item => item.kind === 'pdf')) {
        if (change.content === null) availablePdfs.delete(change.path.slice(6)); else availablePdfs.add(change.path.slice(6));
      }
      const checkDocument = (doc: PublicDocument) => {
        if (doc.url.startsWith('/') && doc.format === 'pdf' && !availablePdfs.has(doc.url)) invalid('Le PDF choisi est absent. Ajoutez-le dans le même enregistrement ou choisissez un fichier existant.');
        if (doc.url.startsWith('/archives/')) {
          const id = doc.url.split('/')[2];
          if (!current.entries.some(entry => entry.path === `public/content/entries/${id}.json` && entry.mode === '100644')) invalid('La page des archives choisie est introuvable.');
        }
      };
      const checkReferences = (kind: ContentKind, parsed: PublicSiteSettings | AdminNews | AdminPhoto | PublicDocument) => {
        if (kind === 'settings') { const settings = parsed as PublicSiteSettings; checkImage(settings.season.calendarImage); settings.featuredNews.forEach(item => checkImage(item.image)); }
        else if (kind === 'documents') checkDocument(parsed as PublicDocument);
        else checkImage((parsed as AdminNews | AdminPhoto).image);
      };
      for (const change of prepared) if (change.parsed) checkReferences(change.kind, change.parsed);
      if (prepared.some(change => change.kind === 'image' && change.content === null)) {
        // Re-read unchanged content at the current head before removing an image.
        const latest = await this.#snapshot(current);
        if (!paths.has(ADMIN_SETTINGS_PATH)) checkReferences('settings', latest.settings);
        for (const record of [...latest.news, ...latest.photos]) if (!paths.has(record.path)) checkImage(record.data.image);
      }
      if (prepared.some(change => change.kind === 'pdf' && change.content === null)) {
        const latest = await this.#snapshot(current);
        for (const record of latest.documents) if (!paths.has(record.path)) checkDocument(record.data);
      }
      const treeEntries: { path: string; mode: string; type: string; sha?: string | null; content?: string }[] = [];
      for (const change of prepared) {
        if (change.content === null) treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
        else if (change.kind === 'image' || change.kind === 'pdf') {
          const blob = await this.#request(`${REPO_API}/git/blobs`, 'POST', { content: change.content, encoding: 'base64' });
          treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: checkedSha(blob.sha) });
        } else treeEntries.push({ path: change.path, mode: '100644', type: 'blob', content: change.content });
      }
      const tree = await this.#request(`${REPO_API}/git/trees`, 'POST', { base_tree: current.treeSha, tree: treeEntries });
      const commit = await this.#request(`${REPO_API}/git/commits`, 'POST', { message: commitMessage, tree: checkedSha(tree.sha), parents: [current.headSha] });
      const sha = checkedSha(commit.sha);
      const updatedRef = await this.#request(`${REPO_API}/git/refs/heads/${ADMIN_BRANCH}`, 'PATCH', { sha, force: false });
      if (checkedSha(object(updatedRef.object, 'La branche enregistrée').sha) !== sha) throw new GitHubAdminError('response', 'GitHub n’a pas confirmé la version attendue. Rechargez les contenus pour vérifier l’enregistrement.');
      return { sha, url: `https://github.com/${ADMIN_REPOSITORY}/commit/${sha}` };
    } finally { this.#saving = false; }
  }
}
