import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { MAX_PUBLIC_PDF_BYTES, validatePublicDocument, validatePublicPdf } from '../lib/public-documents.mjs';

export const CMS_IMAGE_DIRECTORY = '/images/publications/';
export const CMS_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const safeSegment = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/;
const safeId = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,219}$/;
const safeDocumentId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const safePdfName = /^[A-Za-z0-9][A-Za-z0-9_-]*\.pdf$/;

async function existingStat(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function requireRealDirectory(path) {
  const details = await existingStat(path);
  if (!details) return false;
  if (details.isSymbolicLink() || !details.isDirectory()) throw new Error(`Le dossier doit être réel, sans lien symbolique : ${path}`);
  return true;
}

function dimensions(width, height, format, label) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 30000 || height > 30000 || width * height > 100000000) throw new Error(`Dimensions d’image invalides ou trop grandes : ${label}`);
  return { width, height, format };
}

/** Read raster headers only. SVG, HTML, videos and executable uploads are excluded. */
function imageHeader(data, extension, label) {
  if (extension === '.png' && data.length >= 33 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.toString('ascii', 12, 16) === 'IHDR' && data.readUInt32BE(8) === 13) {
    return dimensions(data.readUInt32BE(16), data.readUInt32BE(20), 'png', label);
  }
  if (extension === '.gif' && data.length >= 13 && ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6))) {
    return dimensions(data.readUInt16LE(6), data.readUInt16LE(8), 'gif', label);
  }
  if (['.jpg', '.jpeg'].includes(extension) && data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 3 < data.length) {
      if (data[offset++] !== 0xff) break;
      while (offset < data.length && data[offset] === 0xff) offset++;
      const marker = data[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > data.length) break;
      const length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        return dimensions(data.readUInt16BE(offset + 5), data.readUInt16BE(offset + 3), 'jpg', label);
      }
      offset += length;
    }
  }
  if (extension === '.webp' && data.length >= 25 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' && data.readUInt32LE(4) + 8 <= data.length) {
    const kind = data.toString('ascii', 12, 16);
    if (kind === 'VP8X' && data.length >= 30 && data.readUInt32LE(16) >= 10) return dimensions(data.readUIntLE(24, 3) + 1, data.readUIntLE(27, 3) + 1, 'webp', label);
    if (kind === 'VP8L' && data.readUInt32LE(16) >= 5 && data[20] === 0x2f) {
      const bits = data.readUInt32LE(21);
      return dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1, 'webp', label);
    }
    if (kind === 'VP8 ' && data.length >= 30 && data.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) return dimensions(data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff, 'webp', label);
  }
  throw new Error(`L’image doit être un fichier JPG, PNG, WebP ou GIF valide, avec l’extension correspondante : ${label}`);
}

export async function inspectLocalRaster(filename) {
  const details = await lstat(filename);
  if (details.isSymbolicLink() || !details.isFile()) throw new Error(`Une image doit être un fichier ordinaire, sans lien symbolique : ${filename}`);
  if (!details.size || details.size > CMS_MAX_IMAGE_BYTES) throw new Error(`Chaque image doit peser entre 1 octet et 5 Mio : ${filename}`);
  const extension = extname(filename).toLowerCase();
  if (!imageExtensions.has(extension)) throw new Error(`Format d’image interdit : ${filename}`);
  return { ...imageHeader(await readFile(filename), extension, filename), bytes: details.size };
}

/** Shared by the preflight, builder and publication checker to avoid divergent allowlists. */
export async function inspectCmsImages(projectRoot) {
  const publicDir = resolve(projectRoot, 'public');
  const imagesDir = resolve(publicDir, 'images');
  const directory = resolve(imagesDir, 'publications');
  const result = new Map();
  if (!(await requireRealDirectory(publicDir)) || !(await requireRealDirectory(imagesDir)) || !(await requireRealDirectory(directory))) return result;
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name === '.gitkeep' || entry.name === 'README.md') {
        if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Fichier de suivi invalide dans les images : ${entry.name}`);
        continue;
      }
      if (!safeSegment.test(entry.name) || entry.name === '.' || entry.name === '..' || entry.name.length > 220) throw new Error(`Nom de fichier ou dossier invalide pour les images : ${entry.name}`);
      const filename = resolve(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Lien symbolique interdit dans les images : ${filename}`);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.isFile()) {
        const publicPath = '/' + relative(publicDir, filename).split(sep).join('/');
        result.set(publicPath, await inspectLocalRaster(filename));
      } else throw new Error(`Fichier spécial interdit dans les images : ${filename}`);
    }
  }
  await walk(directory);
  return result;
}

export async function inspectLocalPdf(filename) {
  const details = await lstat(filename);
  if (details.isSymbolicLink() || !details.isFile()) throw new Error(`Un PDF doit être un fichier ordinaire, sans lien symbolique : ${filename}`);
  if (!details.size || details.size > MAX_PUBLIC_PDF_BYTES) throw new Error(`Chaque PDF public doit peser entre 1 octet et 5 Mio : ${filename}`);
  if (extname(filename) !== '.pdf') throw new Error(`Extension PDF invalide : ${filename}`);
  validatePublicPdf(await readFile(filename));
  return { bytes: details.size, format: 'pdf' };
}

/** Only verified public PDFs enter the export; member attachments use a different repository. */
export async function inspectCmsDocuments(projectRoot) {
  const publicDir = resolve(projectRoot, 'public');
  const result = new Map();
  if (!(await requireRealDirectory(publicDir))) return result;
  for (const [parentName, directoryName, uploads] of [['documents', 'fichiers', true], ['media', 'archive', false]]) {
    const parent = resolve(publicDir, parentName);
    const directory = resolve(parent, directoryName);
    if (!(await requireRealDirectory(parent)) || !(await requireRealDirectory(directory))) continue;
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const filename = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Lien symbolique interdit dans les documents publics : ${filename}`);
      if (uploads && (entry.name === '.gitkeep' || entry.name === 'README.md')) {
        if (!entry.isFile()) throw new Error(`Fichier de suivi invalide dans les documents : ${entry.name}`);
        continue;
      }
      if (!uploads && extname(entry.name).toLowerCase() !== '.pdf') continue;
      if (!entry.isFile() || !safePdfName.test(entry.name) || entry.name.length > 180) throw new Error(`Les documents publics doivent être des PDF avec un nom simple, sans sous-dossier : ${entry.name}`);
      result.set('/' + relative(publicDir, filename).split(sep).join('/'), await inspectLocalPdf(filename));
    }
  }
  return result;
}

/** Every local document reference must point to something the exporter will actually publish. */
export function assertPublicDocumentTargets(documents, pdfPaths, archiveIds) {
  const pdfs = new Set(pdfPaths);
  const archives = new Set(archiveIds);
  for (const document of documents) {
    if (!document.url.startsWith('/')) continue;
    if (document.format === 'pdf') {
      if (!pdfs.has(document.url)) throw new Error(`Le PDF public est absent ou non autorisé : ${document.url}`);
    } else {
      const id = /^\/archives\/([^/]+)\/$/.exec(document.url)?.[1];
      if (!id || !archives.has(id)) throw new Error(`La page du document n’existe pas dans les archives : ${document.url}`);
    }
  }
}

/** CMS collections are public and flat. Unknown/private properties never enter the public feed. */
export async function readCmsCollection(projectRoot, name) {
  if (!['news', 'photos', 'documents'].includes(name)) throw new Error('Collection CMS inconnue.');
  const directory = resolve(projectRoot, 'github-pages/content', name);
  if (!(await requireRealDirectory(resolve(projectRoot, 'github-pages'))) || !(await requireRealDirectory(dirname(directory))) || !(await requireRealDirectory(directory))) return [];
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.gitkeep' || entry.name === 'README.md') {
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Fichier de suivi invalide : ${name}/${entry.name}`);
      continue;
    }
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.json')) throw new Error(`La collection ${name} doit contenir uniquement des fichiers JSON, sans sous-dossier ni lien symbolique.`);
    const id = entry.name.slice(0, -5);
    if (!safeId.test(id) || id === '.' || id === '..') throw new Error(`Nom de publication invalide : ${name}/${entry.name}`);
    if (name === 'documents' && !safeDocumentId.test(id)) throw new Error(`Identifiant de document invalide : ${entry.name}`);
    const filename = resolve(directory, entry.name);
    if ((await lstat(filename)).size > 512 * 1024) throw new Error(`Publication trop volumineuse : ${name}/${entry.name}`);
    let item;
    try { item = JSON.parse(await readFile(filename, 'utf8')); }
    catch { throw new Error(`Publication JSON invalide : ${name}/${entry.name}`); }
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`La publication doit être un objet : ${name}/${entry.name}`);
    if (item.published === false) throw new Error(`Les brouillons privés ne doivent pas être enregistrés dans ce dépôt public : ${name}/${entry.name}`);
    result.push({ ...(name === 'documents' ? validatePublicDocument(item) : item), id });
  }
  return result;
}
