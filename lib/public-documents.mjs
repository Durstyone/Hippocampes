/** Public documents only. Member records and completed forms never belong here. */
export const MAX_PUBLIC_PDF_BYTES = 5 * 1024 * 1024;

const fields = ['title', 'description', 'category', 'season', 'url', 'date', 'format', 'order'];
const categories = new Set(['adhesion', 'administratif', 'formation', 'autre']);
const localPdf = /^\/(?:documents\/fichiers|media\/archive)\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.pdf$/;
const localPage = /^\/archives\/[a-zA-Z0-9][a-zA-Z0-9_-]*\/?$/;

function fail(message) { throw new Error(message); }
function text(value, label, maximum, required = false) {
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail(`${label} doit contenir un texte valide de ${maximum} caractères maximum.`);
  const cleaned = value.trim();
  if (required && !cleaned) fail(`${label} est obligatoire.`);
  return cleaned;
}

function publicUrl(value, format) {
  const url = text(value, 'Le lien du document', 4096, true);
  if (localPdf.test(url)) {
    if (format !== 'pdf') fail('Un fichier PDF doit être déclaré au format PDF.');
    return url;
  }
  if (localPage.test(url)) {
    if (format !== 'page') fail('Une page des archives doit être déclarée comme page à consulter.');
    return url.endsWith('/') ? url : url + '/';
  }
  if (url.startsWith('/') || /[\u0000-\u0020<>"\\]/u.test(url)) fail('Choisissez un PDF public, une page des archives ou une adresse HTTPS.');
  let parsed;
  try { parsed = new URL(url); } catch { fail('Le lien du document doit être une adresse HTTPS valide.'); }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '[::]' || /^(?:0|10|127)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) fail('Le lien doit être une adresse HTTPS publique, sans identifiant ni mot de passe.');
  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); } catch { fail('Le lien du document contient un chemin invalide.'); }
  if (/(?:^|\/)(?:admin|api)(?:\/|$)/i.test(pathname)) fail('Une page d’administration ou une API ne peut pas être publiée comme document du club.');
  return url;
}

export function validatePublicDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Le document doit être une fiche valide.');
  if (Object.keys(value).some(key => !fields.includes(key))) fail('La fiche contient des informations qui ne font pas partie des documents publics.');
  if (!categories.has(value.category)) fail('Choisissez une catégorie de document valide.');
  if (!['pdf', 'page'].includes(value.format)) fail('Choisissez le format PDF ou page à consulter.');
  const date = text(value.date, 'La date', 10);
  if (date) {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000') || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) fail('La date doit être une date valide au format AAAA-MM-JJ.');
  }
  if (!Number.isSafeInteger(value.order) || value.order < 0 || value.order > 1000000) fail('L’ordre du document doit être un entier entre 0 et 1 000 000.');
  return {
    title: text(value.title, 'Le titre du document', 200, true),
    description: text(value.description, 'La description', 3000),
    category: value.category,
    season: text(value.season, 'La saison', 40),
    url: publicUrl(value.url, value.format),
    date,
    format: value.format,
    order: value.order,
  };
}

/** Inspect the file bytes, not the browser-provided MIME type or file name. */
export function validatePublicPdf(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 32) fail('Le fichier PDF est vide ou incomplet.');
  if (bytes.byteLength > MAX_PUBLIC_PDF_BYTES) fail('Un document PDF ne doit pas dépasser 5 Mo.');
  const header = String.fromCharCode(...bytes.subarray(0, 8));
  if (!/^%PDF-(?:1\.[0-7]|2\.0)/.test(header)) fail('Le fichier doit être un véritable document PDF.');
  const ending = new TextDecoder('latin1').decode(bytes.subarray(Math.max(0, bytes.byteLength - 2048)));
  if (!/%%EOF[\s\0]*$/.test(ending)) fail('Le fichier PDF semble incomplet. Exportez-le à nouveau avant de l’importer.');
}
