import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Download, ExternalLink, FileText, LoaderCircle, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { validatePublicDocument, validatePublicPdf, MAX_PUBLIC_PDF_BYTES, type PublicDocument } from '../../lib/public-documents.mjs';
import type { AdminChange, AdminSnapshot, ManagedRecord } from '../../lib/github-admin';
import { siteUrl } from '../../lib/site-delivery';
import './public-documents-admin.css';

const CATEGORIES = { adhesion: 'Adhésion', administratif: 'Vie du club', formation: 'Formation', autre: 'Autre' };
const href = (url: string) => url.startsWith('/') ? siteUrl(url) : url;
type Draft = { value: PublicDocument; original: string; base: AdminSnapshot; path: string; existing: boolean; file?: AdminChange };

export default function PublicDocumentsPanel({ snapshot, onSave, onReload, saving, connected, saveError, onClearError }: {
  snapshot: AdminSnapshot;
  onSave: (changes: AdminChange[], message: string, base: AdminSnapshot) => Promise<boolean>;
  onReload: () => Promise<boolean>;
  saving: boolean; connected: boolean; saveError: string; onClearError: () => void;
}) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [publicConfirmed, setPublicConfirmed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const preparingRef = useRef(false);
  const dirty = !!draft && (!!draft.file || JSON.stringify(draft.value) !== draft.original);
  const busy = saving || preparing;

  useEffect(() => { if (!draft) return; const element = dialog.current; element?.showModal(); return () => element?.close(); }, [!!draft]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, busy]);

  function open(record?: ManagedRecord<PublicDocument>) {
    const value: PublicDocument = record ? { ...record.data } : { title: '', description: '', category: 'adhesion', season: snapshot.settings.season.name, url: '', date: '', format: 'pdf', order: 0 };
    setDraft({ value, original: JSON.stringify(value), base: snapshot, existing: !!record, path: record?.path || `github-pages/content/documents/document-${crypto.randomUUID()}.json` });
    setError(''); onClearError(); setPublicConfirmed(false);
  }
  function close() { if (busy || dirty && !window.confirm('Quitter sans enregistrer le document ?')) return; setDraft(null); setError(''); onClearError(); }
  function patch(value: Partial<PublicDocument>) { setDraft(current => current ? { ...current, value: { ...current.value, ...value } } : current); }

  async function chooseFile(file?: File) {
    if (!draft || !file || preparingRef.current) return;
    preparingRef.current = true; setPreparing(true); setError('');
    try {
      if (!/\.pdf$/i.test(file.name) || file.size > MAX_PUBLIC_PDF_BYTES || !file.size) throw new Error('Choisissez un PDF de 5 Mo maximum.');
      const bytes = new Uint8Array(await file.arrayBuffer()); validatePublicPdf(bytes);
      let binary = ''; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      const url = `/documents/fichiers/document-${crypto.randomUUID()}.pdf`;
      setDraft(current => current ? { ...current, value: { ...current.value, title: current.value.title || file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' '), url, format: 'pdf' }, file: { path: `public${url}`, content: btoa(binary), encoding: 'base64' } } : current);
      setPublicConfirmed(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ce document ne peut pas être importé.'); }
    finally { preparingRef.current = false; setPreparing(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft || busy || !dirty) return; setError('');
    try {
      const value = validatePublicDocument(draft.value);
      if (!publicConfirmed) throw new Error('Confirmez que ce document est destiné à tous les visiteurs du site.');
      const changes: AdminChange[] = [...(draft.file ? [draft.file] : []), { path: draft.path, content: JSON.stringify(value, null, 2) + '\n', encoding: 'utf-8' }];
      if (await onSave(changes, 'Mettre à jour un document public du club', draft.base)) setDraft(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Vérifiez la fiche du document.'); }
  }
  async function remove() {
    if (!draft?.existing || busy || !window.confirm('Retirer ce document de la page publique ? Le fichier et son historique restent conservés.')) return;
    if (await onSave([{ path: draft.path, content: null }], 'Retirer une fiche de document public', draft.base)) setDraft(null);
  }
  async function exportAndReload() {
    if (!draft || busy) return;
    const blob = new Blob([JSON.stringify({ document: draft.value, file: draft.file || null }, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'document-public-a-reprendre.json'; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (await onReload()) { setDraft(null); setError(''); }
  }
  const documents = snapshot.documents.filter(record => `${record.data.title} ${record.data.description} ${record.data.season}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  return <section className="adm-public-documents">
    <div className="adm-docs-toolbar"><div><h2>Documents à télécharger</h2><p>Les formulaires vierges et les ressources disponibles pour tous.</p></div><div className="adm-docs-actions"><a className="adm-btn adm-btn-subtle" href={siteUrl('/documents/')} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/>Voir la page</a><button className="adm-btn" onClick={() => open()}><Plus size={18}/>Ajouter un document</button></div></div>
    <label className="adm-search"><Search size={18}/><input aria-label="Rechercher un document public" placeholder="Rechercher un document" value={query} onChange={event => setQuery(event.target.value)}/></label>
    {documents.length ? <div className="adm-docs-grid">{documents.map(record => <article className="adm-panel adm-doc-card" key={record.path}>
      <div className="adm-doc-card-top"><span className="adm-panel-icon"><FileText size={24}/></span><span className="adm-doc-tag">{CATEGORIES[record.data.category]}{record.data.season && ` · ${record.data.season}`}</span></div>
      <h3>{record.data.title}</h3><p>{record.data.description || 'Document du club.'}</p><div className="adm-docs-actions"><a className="adm-btn adm-btn-subtle" href={href(record.data.url)} target="_blank" rel="noopener noreferrer">{record.data.format === 'pdf' ? <Download size={16}/> : <ExternalLink size={16}/>}Consulter</a><button className="adm-btn adm-btn-subtle" onClick={() => open(record)}><Pencil size={16}/>Modifier</button></div>
    </article>)}</div> : <div className="adm-empty"><FileText size={32}/><h3>{query ? 'Aucun document trouvé' : 'Ajoutez le premier document'}</h3><p>Le formulaire d’adhésion, le règlement et les ressources du club se retrouvent ici.</p></div>}
    {draft && <dialog ref={dialog} className="adm-dialog" aria-label={draft.existing ? 'Modifier le document public' : 'Ajouter un document public'} onCancel={event => { event.preventDefault(); close(); }}>
      <div className="adm-dialog-head"><h2>{draft.existing ? 'Modifier le document public' : 'Ajouter un document public'}</h2><button className="adm-icon-btn" aria-label="Fermer le document" disabled={busy} onClick={close}><X size={20}/></button></div>
      <div className="adm-dialog-body"><form id="public-document-editor" onSubmit={save}><fieldset className="adm-fieldset" disabled={busy}>
        <p className="adm-draft-note">Cette fiche et son fichier seront accessibles à tous. Les dossiers remplis se rangent dans « Documents privés ».</p>
        {(error || saveError) && <div className="adm-error" role="alert">{error || saveError}{saveError && <p><button className="adm-btn adm-btn-subtle" type="button" onClick={() => void exportAndReload()}>Exporter ma saisie et recharger GitHub</button></p>}</div>}
        <label className="adm-field">Titre du document<input required maxLength={200} value={draft.value.title} onChange={event => patch({ title: event.target.value })}/></label>
        <div className="adm-grid-two"><label className="adm-field">Catégorie<select value={draft.value.category} onChange={event => patch({ category: event.target.value as PublicDocument['category'] })}>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="adm-field">Saison<input maxLength={40} value={draft.value.season} onChange={event => patch({ season: event.target.value })} placeholder="Ex. 2026–2027"/></label></div>
        <label className="adm-field">Description<textarea rows={3} maxLength={3000} value={draft.value.description} onChange={event => patch({ description: event.target.value })}/></label>
        <label className="adm-drop-zone"><Upload size={25}/><strong>{preparing ? 'Vérification du PDF…' : draft.file ? 'Nouveau PDF prêt à publier' : 'Importer ou remplacer le PDF'}</strong><span>Document vierge ou destiné au public · 5 Mo maximum</span><input type="file" accept="application/pdf,.pdf" aria-label="Choisir un PDF public" onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ''; }}/></label>
        {!draft.file && <label className="adm-field">Choisir un PDF déjà présent<select value={draft.value.format === 'pdf' && snapshot.documentFiles.some(file => file.path === draft.value.url) ? draft.value.url : ''} onChange={event => { if (event.target.value) patch({ url: event.target.value, format: 'pdf' }); }}><option value="">Choisir un fichier existant</option>{snapshot.documentFiles.map(file => <option key={file.path} value={file.path}>{snapshot.documents.find(doc => doc.data.url === file.path)?.data.title || file.name}</option>)}</select></label>}
        <div className="adm-grid-two"><label className="adm-field">Format<select disabled={!!draft.file} value={draft.value.format} onChange={event => patch({ format: event.target.value as PublicDocument['format'] })}><option value="pdf">PDF</option><option value="page">Page à consulter</option></select></label><label className="adm-field">Date du document — facultative<input type="date" value={draft.value.date} onChange={event => patch({ date: event.target.value })}/></label></div>
        <label className="adm-field">Adresse du document<input type="text" required readOnly={!!draft.file} maxLength={4096} value={draft.value.url} onChange={event => patch({ url: event.target.value })} placeholder="PDF du site, page des archives ou lien HTTPS public"/></label>
        <label className="adm-field">Ordre d’affichage<input type="number" min={0} max={1000000} required value={draft.value.order} onChange={event => patch({ order: Number(event.target.value) })}/></label>
        <label className="adm-doc-public-check"><input type="checkbox" checked={publicConfirmed} onChange={event => setPublicConfirmed(event.target.checked)}/><span>Ce document est vierge ou destiné au public. Il ne contient pas de dossier personnel d’adhérent.</span></label>
        {!connected && <p className="adm-form-note">La connexion GitHub sera demandée avant la publication.</p>}
      </fieldset></form></div>
      <div className="adm-dialog-footer"><span className="adm-save-state">{busy ? 'Enregistrement en cours…' : dirty ? 'Modifications non enregistrées' : 'Document chargé'}</span><div>{draft.existing && <button className="adm-icon-btn adm-danger" aria-label="Retirer le document du site" disabled={busy} onClick={() => void remove()}><Trash2 size={18}/></button>}<button className="adm-btn adm-btn-subtle" disabled={busy} onClick={close}>Annuler</button><button className="adm-btn" type="submit" form="public-document-editor" disabled={busy || !dirty || !publicConfirmed}>{busy ? <LoaderCircle size={17} className="adm-spin"/> : <Check size={17}/>}Publier le document</button></div></div>
    </dialog>}
  </section>;
}
