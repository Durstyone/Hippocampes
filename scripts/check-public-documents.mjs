import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_PUBLIC_PDF_BYTES, validatePublicDocument, validatePublicPdf } from '../lib/public-documents.mjs';
import { assertPublicDocumentTargets, inspectCmsDocuments, readCmsCollection } from './cms-content.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(join(tmpdir(), 'hippocampes-documents-check-'));
const asJson = value => JSON.stringify(value, null, 2) + '\n';
const actualPdf = await readFile(resolve(project, 'public/media/archive/1eddff43697a4fd88c8bc87a.pdf'));
const entry = {
  title: 'Adhésion — été 2026', description: 'Un formulaire vierge à compléter.', category: 'adhesion',
  season: '2026–2027', url: '/documents/fichiers/adhesion.pdf', date: '', format: 'pdf', order: 10,
};

try {
  validatePublicPdf(actualPdf);
  for (const bytes of [new Uint8Array(), Buffer.from('<html>Ce fichier n’est pas un PDF.</html>'), actualPdf.subarray(0, 100), new Uint8Array(MAX_PUBLIC_PDF_BYTES + 1)]) assert.throws(() => validatePublicPdf(bytes));
  assert.deepEqual(validatePublicDocument(entry), entry);
  assert.equal(validatePublicDocument({ ...entry, date: '2024-02-29' }).date, '2024-02-29');
  for (const invalid of [
    { ...entry, id: 'un-identifiant-injecte' }, { ...entry, memberId: 'adherent-prive' },
    { ...entry, email: 'fixture@example.invalid' }, { ...entry, notes: 'Une note privée' },
    { ...entry, date: '2026-02-29' }, { ...entry, date: '2026-13-01' },
    { ...entry, title: '' }, { ...entry, order: -1 }, { ...entry, order: 0.5 },
    { ...entry, category: 'members' }, { ...entry, format: 'html' },
  ]) assert.throws(() => validatePublicDocument(invalid));
  for (const url of [
    '/admin/', '/api/files/dossier.pdf', '/club/documents.json', '/club/members.json',
    '/documents/fichiers/../prive.pdf', '/documents/fichiers/%2e%2e/prive.pdf', '/documents/fichiers/sous-dossier/prive.pdf',
    '/documents/fichiers/page.html', '/media/archive/fiche.PDF', '//example.com/fiche.pdf',
    'javascript:alert(1)', 'http://example.com/fiche.pdf', 'https://user:password@example.com/fiche.pdf',
    'https://localhost/fiche.pdf', 'https://127.0.0.1/fiche.pdf',
    'https://example.com/api/files/dossier.pdf', 'https://example.com/Hippocampes/%61dmin/',
  ]) assert.throws(() => validatePublicDocument({ ...entry, url }), `Lien public incorrect accepté : ${url}`);
  const archiveDocument = validatePublicDocument({ ...entry, category: 'administratif', url: '/archives/reglement', format: 'page' });
  assert.equal(archiveDocument.url, '/archives/reglement/');
  assert.equal(validatePublicDocument({ ...entry, url: 'https://example.org/document.pdf' }).url, 'https://example.org/document.pdf');
  assert.throws(() => validatePublicDocument({ ...entry, url: '/archives/reglement/', format: 'pdf' }));
  assert.throws(() => validatePublicDocument({ ...entry, format: 'page' }));

  const fixture = resolve(temporary, 'site');
  const uploads = resolve(fixture, 'public/documents/fichiers');
  const archive = resolve(fixture, 'public/media/archive');
  const collection = resolve(fixture, 'github-pages/content/documents');
  for (const directory of [uploads, archive, collection, resolve(fixture, 'club')]) await mkdir(directory, { recursive: true });
  await writeFile(resolve(uploads, 'adhesion.pdf'), actualPdf);
  await writeFile(resolve(uploads, '.gitkeep'), '');
  await writeFile(resolve(archive, 'ancien-document.pdf'), actualPdf);
  await writeFile(resolve(archive, 'photo.jpg'), Buffer.from('Ignored by the PDF inventory.'));
  await writeFile(resolve(collection, 'dossier-2026-2027.json'), asJson(entry));
  await writeFile(resolve(fixture, 'club/members.json'), asJson({ members: [{ firstName: 'QA-private-marker' }] }));
  await writeFile(resolve(fixture, 'club/documents.json'), asJson({ documents: [{ memberId: 'QA-private-marker' }] }));
  const records = await readCmsCollection(fixture, 'documents');
  const feed = { documents: records };
  assert.deepEqual(feed, { documents: [{ ...entry, id: 'dossier-2026-2027' }] });
  assert.ok(!JSON.stringify(feed).includes('QA-private-marker'));
  const pdfs = await inspectCmsDocuments(fixture);
  assert.deepEqual([...pdfs.keys()].sort(), ['/documents/fichiers/adhesion.pdf', '/media/archive/ancien-document.pdf']);
  assert.equal(pdfs.get('/documents/fichiers/adhesion.pdf').bytes, actualPdf.length);
  assertPublicDocumentTargets(records, pdfs.keys(), []);
  assertPublicDocumentTargets([archiveDocument], pdfs.keys(), ['reglement']);
  assert.throws(() => assertPublicDocumentTargets(records, [], []), /PDF public est absent/);
  assert.throws(() => assertPublicDocumentTargets([archiveDocument], pdfs.keys(), []), /page du document n’existe pas/);

  for (const [name, contents] of [
    ['fausse-page.pdf', Buffer.from('<html>Contenu non PDF.</html>')],
    ['trop-grand.pdf', Buffer.alloc(MAX_PUBLIC_PDF_BYTES + 1)],
    ['nom avec espaces.pdf', actualPdf], ['invalide.PDF', actualPdf],
    ['page.html', Buffer.from('<html>Contenu non autorisé.</html>')],
  ]) {
    const filename = resolve(uploads, name);
    await writeFile(filename, contents);
    await assert.rejects(() => inspectCmsDocuments(fixture));
    await rm(filename);
  }
  await mkdir(resolve(uploads, 'sous-dossier'));
  await assert.rejects(() => inspectCmsDocuments(fixture), /sans sous-dossier/);
  await rm(resolve(uploads, 'sous-dossier'), { recursive: true });
  await symlink(resolve(archive, 'ancien-document.pdf'), resolve(uploads, 'lien.pdf'));
  await assert.rejects(() => inspectCmsDocuments(fixture), /symbolique/);
  await rm(resolve(uploads, 'lien.pdf'));

  const documentPath = resolve(collection, 'dossier-2026-2027.json');
  await writeFile(documentPath, asJson({ ...entry, memberId: 'QA-private-marker' }));
  await assert.rejects(() => readCmsCollection(fixture, 'documents'), /ne font pas partie/);
  await writeFile(documentPath, asJson(entry));
  await symlink(documentPath, resolve(collection, 'lien.json'));
  await assert.rejects(() => readCmsCollection(fixture, 'documents'), /lien symbolique/);
  await rm(resolve(collection, 'lien.json'));
  await writeFile(resolve(collection, 'nom.ambigu.json'), asJson(entry));
  await assert.rejects(() => readCmsCollection(fixture, 'documents'), /Identifiant de document/);
  await rm(resolve(collection, 'nom.ambigu.json'));

  // A parent symlink must not make an external folder look like the allowed upload directory.
  const linkedFixture = resolve(temporary, 'linked-site');
  await mkdir(resolve(linkedFixture, 'public/documents'), { recursive: true });
  await symlink(uploads, resolve(linkedFixture, 'public/documents/fichiers'), 'dir');
  await assert.rejects(() => inspectCmsDocuments(linkedFixture), /sans lien symbolique/);
  await mkdir(resolve(linkedFixture, 'github-pages'), { recursive: true });
  await symlink(resolve(fixture, 'github-pages/content'), resolve(linkedFixture, 'github-pages/content'), 'dir');
  await assert.rejects(() => readCmsCollection(linkedFixture, 'documents'), /sans lien symbolique/);

  const sourceDocuments = await readCmsCollection(project, 'documents');
  const sourcePdfs = await inspectCmsDocuments(project);
  const archiveIndex = JSON.parse(await readFile(resolve(project, 'public/content/archive-index.json'), 'utf8'));
  assertPublicDocumentTargets(sourceDocuments, sourcePdfs.keys(), archiveIndex.entries.map(item => item.id));
  console.log(JSON.stringify({ ok: true, publicDocuments: sourceDocuments.length, publicPdfs: sourcePdfs.size, checks: ['strict public fields', 'real PDF size and signature', 'private/admin/API paths rejected', 'flat upload and collection confinement', 'symlink parents and files rejected', 'public feed excludes member records', 'local document references exist'], fixturesPersisted: false }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
