import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Archive, Download, FileCheck2, FileText, FolderLock, KeyRound, LoaderCircle, LockKeyhole, LogOut, Pencil, Plus, RefreshCw, Search, ShieldCheck, Upload, UserRound, Users, X } from 'lucide-react';
import { GitHubPrivateClubClient, PRIVATE_CLUB_MAX_FILE_BYTES, PRIVATE_CLUB_REPOSITORY, validatePrivateDocument, validatePrivateMember, type PrivateClubSnapshot, type PrivateDocument, type PrivateMember } from '../../lib/github-private-club';
import './private-club.css';

type CommitResult = { sha: string; url: string };
type PrivateOperation = (client: GitHubPrivateClubClient) => Promise<CommitResult>;
type PrivateContextValue = {
  connected: boolean;
  connecting: boolean;
  busy: boolean;
  snapshot: PrivateClubSnapshot | null;
  identity: string;
  error: string;
  notice: string;
  revision: number;
  connect: (token: string) => Promise<void>;
  disconnect: () => void;
  reload: () => Promise<boolean>;
  run: (operation: PrivateOperation, message: string) => Promise<boolean>;
  download: (document: PrivateDocument) => Promise<void>;
  clearMessages: () => void;
};
const PrivateClubContext = createContext<PrivateContextValue | null>(null);
const REPOSITORY_URL = `https://github.com/${PRIVATE_CLUB_REPOSITORY}`;
const TOKEN_HELP = 'https://docs.github.com/fr/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens';
const STATUS: Record<PrivateMember['status'], string> = { active: 'Actif', pending: 'Dossier à compléter', inactive: 'Inactif' };
const ROLE: Record<PrivateMember['role'], string> = { member: 'Adhérent', instructor: 'Encadrant', treasurer: 'Trésorier', admin: 'Administrateur du club' };
const CATEGORIES = ['Adhésion', 'Administratif', 'Formation', 'Licence', 'Autre'];

function errorText(error: unknown) { return error instanceof Error ? error.message : 'L’opération n’a pas pu être confirmée. Vos saisies sont conservées.'; }
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function memberName(member?: PrivateMember) { return member ? `${member.firstName} ${member.lastName}`.trim() : 'Adhérent non retrouvé'; }
function fileSize(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`; }
function dateText(value: string) { if (!value) return 'Non renseignée'; const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }); }
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.rel = 'noopener'; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PrivateClubProvider({ children }: { children: ReactNode }) {
  const client = useRef<GitHubPrivateClubClient | null>(null);
  const pendingClient = useRef<GitHubPrivateClubClient | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const [snapshot, setSnapshot] = useState<PrivateClubSnapshot | null>(null);
  const [identity, setIdentity] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => () => { generation.current++; pendingClient.current?.destroy(); pendingClient.current = null; client.current?.destroy(); client.current = null; }, []);

  async function connect(token: string) {
    if (lock.current) throw new Error('Une opération est déjà en cours. Patientez avant de vous reconnecter.');
    lock.current = true; setConnecting(true); setError('');
    const currentGeneration = ++generation.current;
    let next: GitHubPrivateClubClient | null = null;
    try {
      next = new GitHubPrivateClubClient(token);
      pendingClient.current = next;
      const user = await next.connect();
      const current = await next.load();
      if (currentGeneration !== generation.current) throw new Error('La connexion a été fermée.');
      client.current?.destroy(); client.current = next;
      setIdentity(user.login); setSnapshot(current); setRevision(value => value + 1);
      setNotice('Espace privé connecté. Les dossiers du club sont à jour.');
    } catch (failure) {
      next?.destroy();
      if (currentGeneration === generation.current) setError(errorText(failure));
      throw failure;
    } finally {
      if (pendingClient.current === next) pendingClient.current = null;
      if (currentGeneration === generation.current) { lock.current = false; setConnecting(false); }
    }
  }
  function disconnect() {
    generation.current++; pendingClient.current?.destroy(); pendingClient.current = null; client.current?.destroy(); client.current = null;
    lock.current = false; setConnecting(false); setBusy(false); setSnapshot(null); setIdentity(''); setError(''); setNotice(''); setRevision(value => value + 1);
  }
  async function reload() {
    if (lock.current || !client.current) return false;
    const api = client.current; const currentGeneration = generation.current;
    lock.current = true; setBusy(true); setError('');
    try {
      const current = await api.load();
      if (currentGeneration !== generation.current) return false;
      setSnapshot(current); setNotice('Les dossiers privés ont été actualisés.'); return true;
    } catch (failure) { if (currentGeneration === generation.current) setError(errorText(failure)); return false; }
    finally { if (currentGeneration === generation.current) { lock.current = false; setBusy(false); } }
  }
  async function run(operation: PrivateOperation, message: string) {
    if (lock.current || !client.current) return false;
    const api = client.current; const currentGeneration = generation.current;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await operation(api);
      if (currentGeneration !== generation.current) return false;
      setNotice(message);
      try { const current = await api.load(); if (currentGeneration === generation.current) setSnapshot(current); }
      catch { if (currentGeneration === generation.current) setNotice(`${message} Actualisez pour retrouver la dernière version.`); }
      return currentGeneration === generation.current;
    } catch (failure) { if (currentGeneration === generation.current) setError(errorText(failure)); return false; }
    finally { if (currentGeneration === generation.current) { lock.current = false; setBusy(false); } }
  }
  async function download(document: PrivateDocument) {
    if (lock.current || !client.current || !snapshot) return;
    const api = client.current; const currentGeneration = generation.current;
    lock.current = true; setBusy(true); setError('');
    try {
      const blob = await api.downloadDocument(document.id, snapshot);
      if (currentGeneration === generation.current) downloadBlob(blob, document.filename);
    } catch (failure) { if (currentGeneration === generation.current) setError(errorText(failure)); }
    finally { if (currentGeneration === generation.current) { lock.current = false; setBusy(false); } }
  }
  return <PrivateClubContext.Provider value={{ connected: !!snapshot && !!client.current, connecting, busy, snapshot, identity, error, notice, revision, connect, disconnect, reload, run, download, clearMessages: () => { setError(''); setNotice(''); } }}>{children}</PrivateClubContext.Provider>;
}

export function usePrivateClub() {
  const context = useContext(PrivateClubContext);
  if (!context) throw new Error('Le contexte de gestion privée est absent.');
  return context;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="adm-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
}
function PrivateDialog({ title, children, footer, close, busy }: { title: string; children: ReactNode; footer: ReactNode; close: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal(); return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog className="adm-dialog pvc-dialog" aria-label={title} ref={ref} onCancel={event => { event.preventDefault(); if (!busy) close(); }} onClick={event => { if (event.target === ref.current && !busy) close(); }}>
    <div className="adm-dialog-head"><h2>{title}</h2><button type="button" className="adm-icon-btn" aria-label="Fermer le formulaire" onClick={close} disabled={busy}><X size={20}/></button></div>
    <div className="adm-dialog-body">{children}</div><div className="adm-dialog-footer">{footer}</div>
  </dialog>;
}
function Messages({ localError = '' }: { localError?: string }) {
  const { error, notice } = usePrivateClub();
  return <>{(localError || error) && <p className="pvc-message pvc-error" role="alert">{localError || error}</p>}{notice && !error && !localError && <p className="pvc-message pvc-notice" role="status"><ShieldCheck size={18}/>{notice}</p>}</>;
}
function PrivateAccess() {
  const context = usePrivateClub();
  const [token, setToken] = useState('');
  const [localError, setLocalError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setLocalError('');
    const credential = token.trim(); setToken('');
    try { await context.connect(credential); } catch (failure) { setLocalError(errorText(failure)); }
  }
  return <section className="pvc-access adm-panel" aria-labelledby="pvc-access-title">
    <span className="pvc-access-icon"><FolderLock size={29}/></span>
    <div><p className="adm-eyebrow">GESTION PRIVÉE DU CLUB</p><h2 id="pvc-access-title">Retrouver les dossiers des adhérents</h2><p>Les fiches et les pièces nominatives sont conservées dans le dépôt privé du club. Elles deviennent accessibles ici après connexion à GitHub.</p></div>
    <form onSubmit={submit} className="pvc-connect-form">
      <Field label="Jeton d’accès GitHub" hint="Propriétaire Durstyone : jeton à accès fin, Contents en lecture et écriture sur Hippocampes-prive. Collaborateur invité : jeton classique après acceptation de l’invitation."><input type="password" autoComplete="off" spellCheck={false} required value={token} maxLength={270} placeholder="Jeton personnel GitHub" disabled={context.connecting} onChange={event => setToken(event.target.value)} /></Field>
      {(localError || context.error) && <p className="pvc-message pvc-error" role="alert">{localError || context.error}</p>}
      <button className="adm-btn" type="submit" disabled={context.connecting || !token.trim()}>{context.connecting ? <LoaderCircle className="pvc-spin" size={18}/> : <KeyRound size={18}/>} {context.connecting ? 'Connexion…' : 'Ouvrir l’espace privé'}</button>
    </form>
    <details className="pvc-help"><summary>Comment activer cet accès ?</summary><ol><li>Avec le compte propriétaire Durstyone, créez un jeton à accès fin.</li><li>Choisissez le dépôt privé <strong>Hippocampes-prive</strong> et l’autorisation <strong>Contents : Read and write</strong>. Ajoutez aussi <strong>Hippocampes</strong> pour le contenu public.</li><li>Collez ce jeton dans ce formulaire. Il reste uniquement en mémoire dans cet onglet et disparaît à la déconnexion.</li></ol><p><strong>Compte collaborateur invité :</strong> GitHub exige un jeton classique avec le périmètre <code>repo</code> pour un dépôt personnel appartenant à quelqu’un d’autre. Cette permission peut aussi couvrir vos autres dépôts privés. Utilisez une durée courte et révoquez le jeton après usage.</p><div className="pvc-actions"><a href={TOKEN_HELP} target="_blank" rel="noopener noreferrer" className="adm-text-link">Guide GitHub</a><a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="adm-text-link">Dépôt privé du club</a></div></details>
  </section>;
}
function PrivateToolbar() {
  const context = usePrivateClub();
  return <div className="pvc-session"><div><LockKeyhole size={17}/><span>Espace privé <strong>{context.identity}</strong></span></div><div className="pvc-actions"><button className="adm-btn adm-btn-subtle adm-btn-small" disabled={context.busy} onClick={() => void context.reload()}><RefreshCw size={15}/>Actualiser</button><button className="adm-btn adm-btn-subtle adm-btn-small" disabled={context.busy} onClick={context.disconnect}><LogOut size={15}/>Déconnecter</button></div></div>;
}
function EmptyState({ title, children }: { title: string; children: ReactNode }) { return <div className="pvc-empty"><Users size={34}/><h3>{title}</h3><p>{children}</p></div>; }
function newMember(season: string): PrivateMember {
  return { id: crypto.randomUUID(), firstName: '', lastName: '', email: '', phone: '', emergencyContact: '', level: '', role: 'member', groups: [], caciExpiry: '', licenseExpiry: '', licenseNumber: '', status: 'pending', season, membershipFormReceived: false, notes: '', archived: false, updatedAt: new Date().toISOString() };
}
type MemberDraft = { value: PrivateMember; base: PrivateClubSnapshot; original: string; groupsText: string; originalGroupsText: string; isNew: boolean };

export function PrivateMembersPanel({ season }: { season: string }) {
  const context = usePrivateClub();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<MemberDraft | null>(null);
  const [localError, setLocalError] = useState('');
  const [memberDocuments, setMemberDocuments] = useState<string | null>(null);
  const dirty = !!editor && (JSON.stringify(editor.value) !== editor.original || editor.groupsText !== editor.originalGroupsText);
  useUnsavedGuard(dirty || context.busy);
  useEffect(() => { setEditor(null); setLocalError(''); setMemberDocuments(null); setQuery(''); setStatus('all'); setShowArchived(false); }, [context.revision]);
  const members = context.snapshot?.members || [];
  const filtered = useMemo(() => members.filter(member => member.archived === showArchived && (status === 'all' || member.status === status) && `${member.firstName} ${member.lastName} ${member.email} ${member.phone} ${member.licenseNumber} ${member.groups.join(' ')}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr')), [members, query, status, showArchived]);
  if (!context.connected || !context.snapshot) return <PrivateAccess/>;
  const snapshot = context.snapshot;
  const active = members.filter(member => !member.archived);
  function open(value?: PrivateMember) { const next = copy(value || newMember(season)); context.clearMessages(); setLocalError(''); setEditor({ value: next, original: JSON.stringify(next), base: snapshot, groupsText: next.groups.join(', '), originalGroupsText: next.groups.join(', '), isNew: !value }); }
  function close() { if (context.busy) return; if (dirty && !window.confirm('Quitter cette fiche sans enregistrer ?')) return; setEditor(null); setLocalError(''); }
  function set<K extends keyof PrivateMember>(key: K, value: PrivateMember[K]) { if (editor) setEditor({ ...editor, value: { ...editor.value, [key]: value } }); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editor) return; setLocalError('');
    try { const value = validatePrivateMember({ ...editor.value, groups: editor.groupsText.split(',').map(value => value.trim()).filter(Boolean) }); if (await context.run(client => client.saveMember(value, editor.base), 'Fiche adhérent enregistrée dans l’espace privé.')) setEditor(null); }
    catch (failure) { setLocalError(errorText(failure)); }
  }
  async function archive(member: PrivateMember) {
    const action = member.archived ? 'rétablir' : 'archiver';
    if (!window.confirm(`Voulez-vous ${action} la fiche de ${memberName(member)} ? ${member.archived ? '' : 'Elle restera consultable dans les archives.'}`)) return;
    await context.run(client => client.archiveMember(member.id, !member.archived, snapshot), member.archived ? 'Fiche rétablie dans les adhérents.' : 'Fiche archivée. Elle peut être rétablie à tout moment.');
  }
  function exportMembers() {
    const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Saison', 'État du dossier', 'Niveau', 'Fonction', 'Groupes', 'Dossier adhésion reçu', 'Numéro de licence', 'Validité licence', 'Validité CACI'];
    const escape = (value: unknown) => { let cell = String(value ?? ''); if (/^[=+@\-\t\r]/.test(cell)) cell = `'${cell}`; return `"${cell.replace(/"/g, '""')}"`; };
    const rows = filtered.map(member => [member.firstName, member.lastName, member.email, member.phone, member.season, STATUS[member.status], member.level, ROLE[member.role], member.groups.join(', '), member.membershipFormReceived ? 'Oui' : 'Non', member.licenseNumber, member.licenseExpiry, member.caciExpiry]);
    downloadBlob(new Blob(['\ufeff' + [headers, ...rows].map(row => row.map(escape).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'adherents-du-club.csv');
  }
  const relatedMember = members.find(member => member.id === memberDocuments);
  const relatedDocuments = snapshot.documents.filter(document => document.memberId === memberDocuments && !document.archived);
  return <section className="pvc-panel" aria-label="Gestion des adhérents">
    <PrivateToolbar/><Messages/>
    <div className="pvc-stats"><div><Users size={20}/><strong>{active.length}</strong><span>fiches adhérents</span></div><div><UserRound size={20}/><strong>{active.filter(member => member.status === 'active').length}</strong><span>adhérents actifs</span></div><div><FileCheck2 size={20}/><strong>{active.filter(member => !member.membershipFormReceived).length}</strong><span>dossiers d’adhésion à recevoir</span></div></div>
    <div className="pvc-toolbar"><div className="pvc-intro"><h2>Les dossiers du club</h2><p>Coordonnées, licences et suivi administratif des adhésions.</p></div><div className="pvc-actions"><button type="button" className="adm-btn adm-btn-subtle" disabled={context.busy || !filtered.length} onClick={exportMembers}><Download size={17}/>Exporter la liste</button><button type="button" className="adm-btn" disabled={context.busy} onClick={() => open()}><Plus size={18}/>Ajouter un adhérent</button></div></div>
    <div className="pvc-filters"><label className="adm-search"><Search size={17}/><input aria-label="Rechercher un adhérent" value={query} placeholder="Nom, email, licence…" onChange={event => setQuery(event.target.value)}/></label><label className="pvc-select"><span>Statut</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Tous les statuts</option>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="pvc-check"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)}/>Fiches archivées</label></div>
    {filtered.length ? <div className="pvc-member-list">{filtered.map(member => <article key={member.id} className="pvc-member-card"><div className="pvc-avatar" aria-hidden="true">{member.firstName[0]}{member.lastName[0]}</div><div className="pvc-member-main"><h3>{memberName(member)}</h3><p>{member.email || 'Email non renseigné'}{member.phone && <><span aria-hidden="true"> · </span>{member.phone}</>}</p><div className="pvc-tags"><span className={`pvc-status pvc-status-${member.status}`}>{STATUS[member.status]}</span>{member.archived && <span className="pvc-tag">Archivé</span>}{member.level && <span className="pvc-tag">{member.level}</span>}{member.season && <span className="pvc-tag">{member.season}</span>}</div></div><div className="pvc-member-summary"><span><FileCheck2 size={15}/>{member.membershipFormReceived ? 'Adhésion reçue' : 'Adhésion à recevoir'}</span><span>Licence : {dateText(member.licenseExpiry)}</span></div><div className="pvc-row-actions"><button className="adm-btn adm-btn-subtle adm-btn-small" disabled={context.busy} onClick={() => open(member)} aria-label={`Modifier la fiche de ${memberName(member)}`}><Pencil size={15}/>Modifier</button><button className="adm-text-link" disabled={context.busy} onClick={() => setMemberDocuments(member.id)}>Documents ({snapshot.documents.filter(document => document.memberId === member.id && !document.archived).length})</button><button className="adm-text-link" disabled={context.busy} onClick={() => void archive(member)}>{member.archived ? 'Rétablir' : 'Archiver'}</button></div></article>)}</div> : <EmptyState title={query || status !== 'all' ? 'Aucun adhérent ne correspond' : showArchived ? 'Aucune fiche archivée' : 'Votre liste d’adhérents est prête'}>{query || status !== 'all' ? 'Modifiez votre recherche ou vos filtres.' : showArchived ? 'Les fiches archivées apparaîtront ici et pourront être rétablies.' : 'Ajoutez le premier adhérent pour commencer le suivi de ses inscriptions et de ses documents.'}</EmptyState>}
    {editor && <PrivateDialog title={editor.isNew ? 'Ajouter un adhérent' : `Fiche de ${memberName(editor.value) || 'l’adhérent'}`} close={close} busy={context.busy} footer={<><span className="adm-muted"><LockKeyhole size={14}/> Dossier privé</span><button className="adm-btn adm-btn-subtle" onClick={close} disabled={context.busy}>Annuler</button><button className="adm-btn" type="submit" form="pvc-member-form" disabled={context.busy || (!dirty && !editor.isNew)}>{context.busy ? <LoaderCircle className="pvc-spin" size={17}/> : <ShieldCheck size={17}/>}Enregistrer</button></>}>
      <form id="pvc-member-form" onSubmit={save} className="adm-editor-content"><Messages localError={localError}/><fieldset disabled={context.busy} className="pvc-fieldset"><section className="adm-section"><h3>Identité et contact</h3><div className="adm-grid-two"><Field label="Prénom"><input autoComplete="off" value={editor.value.firstName} required maxLength={80} onChange={event => set('firstName', event.target.value)}/></Field><Field label="Nom"><input autoComplete="off" value={editor.value.lastName} required maxLength={80} onChange={event => set('lastName', event.target.value)}/></Field><Field label="Adresse email"><input type="email" autoComplete="off" value={editor.value.email} maxLength={254} onChange={event => set('email', event.target.value)}/></Field><Field label="Téléphone"><input type="tel" autoComplete="off" value={editor.value.phone} maxLength={50} onChange={event => set('phone', event.target.value)}/></Field></div><Field label="Personne à prévenir" hint="Nom et numéro de téléphone."><input autoComplete="off" value={editor.value.emergencyContact} maxLength={250} onChange={event => set('emergencyContact', event.target.value)}/></Field></section>
      <section className="adm-section"><h3>Adhésion et pratique</h3><div className="adm-grid-two"><Field label="Saison"><input value={editor.value.season} maxLength={40} onChange={event => set('season', event.target.value)}/></Field><Field label="État du dossier"><select value={editor.value.status} onChange={event => set('status', event.target.value as PrivateMember['status'])}>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Niveau"><input value={editor.value.level} maxLength={80} placeholder="Débutant, N1, N2, apnéiste…" onChange={event => set('level', event.target.value)}/></Field><Field label="Fonction dans le club" hint="Fonction associative. Elle ne donne aucun droit d’accès au dépôt GitHub."><select value={editor.value.role} onChange={event => set('role', event.target.value as PrivateMember['role'])}>{Object.entries(ROLE).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div><Field label="Groupes" hint="Séparez les groupes par une virgule."><input value={editor.groupsText} maxLength={1000} placeholder="Apnée, Plongée, Prépa N1" onChange={event => setEditor({ ...editor, groupsText: event.target.value })}/></Field><label className="pvc-check pvc-check-box"><input type="checkbox" checked={editor.value.membershipFormReceived} onChange={event => set('membershipFormReceived', event.target.checked)}/><span>Dossier d’adhésion reçu</span></label></section>
      <section className="adm-section"><h3>Licence et certificat</h3><Field label="Numéro de licence"><input value={editor.value.licenseNumber} maxLength={80} onChange={event => set('licenseNumber', event.target.value)}/></Field><div className="adm-grid-two"><Field label="Licence valable jusqu’au"><input type="date" value={editor.value.licenseExpiry} onChange={event => set('licenseExpiry', event.target.value)}/></Field><Field label="CACI valable jusqu’au"><input type="date" value={editor.value.caciExpiry} onChange={event => set('caciExpiry', event.target.value)}/></Field></div><p className="adm-form-note">Renseignez uniquement la date de validité du certificat. Les réponses au questionnaire médical restent confidentielles et ne sont pas à saisir ici.</p></section><section className="adm-section"><Field label="Notes administratives" hint="Informations utiles à la gestion du dossier, sans détail médical."><textarea value={editor.value.notes} maxLength={4000} rows={4} onChange={event => set('notes', event.target.value)}/></Field></section></fieldset>
      {(context.error || localError) && <button className="adm-text-link" type="button" disabled={context.busy} onClick={async () => { if (!window.confirm('Actualiser les dossiers et fermer cette fiche ? Les modifications non enregistrées seront abandonnées.')) return; if (await context.reload()) { setEditor(null); setLocalError(''); } }}>Actualiser les dossiers et reprendre la saisie</button>}</form>
    </PrivateDialog>}
    {relatedMember && <PrivateDialog title={`Documents de ${memberName(relatedMember)}`} close={() => setMemberDocuments(null)} busy={context.busy} footer={<button className="adm-btn adm-btn-subtle" onClick={() => setMemberDocuments(null)} disabled={context.busy}>Fermer</button>}><Messages/>{relatedDocuments.length ? <div className="pvc-related-docs">{relatedDocuments.map(document => <div key={document.id}><FileText size={22}/><span><strong>{document.title}</strong><small>{document.category} · {fileSize(document.size)}</small></span><button className="adm-btn adm-btn-subtle adm-btn-small" disabled={context.busy} onClick={() => void context.download(document)}><Download size={16}/>Télécharger</button></div>)}</div> : <p className="adm-muted">Aucun document n’est encore rattaché à cette fiche. Pour en ajouter, ouvrez la rubrique Documents, puis choisissez cet adhérent lors de l’import.</p>}</PrivateDialog>}
  </section>;
}

function newDocument(season: string): PrivateDocument { return { id: crypto.randomUUID(), title: '', category: 'Adhésion', memberId: '', season, description: '', filePath: '', filename: '', mimeType: '', size: 0, archived: false, updatedAt: new Date().toISOString() }; }
type DocumentDraft = { value: PrivateDocument; base: PrivateClubSnapshot; original: string; isNew: boolean; file: File | null };
function fileMime(filename: string) { const extension = filename.split('.').pop()?.toLowerCase(); return extension === 'pdf' ? 'application/pdf' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : ''; }
async function fileBase64(file: File) { const bytes = new Uint8Array(await file.arrayBuffer()); let text = ''; for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(text); }

export function PrivateDocumentsPanel({ season }: { season: string }) {
  const context = usePrivateClub();
  const [query, setQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<DocumentDraft | null>(null);
  const [localError, setLocalError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const preparingLock = useRef(false);
  const sessionEpoch = useRef(0);
  const dirty = !!editor && (!!editor.file || JSON.stringify(editor.value) !== editor.original);
  useUnsavedGuard(dirty || preparing || context.busy);
  useEffect(() => {
    sessionEpoch.current++; setEditor(null); setLocalError(''); setPreparing(false); preparingLock.current = false;
    setQuery(''); setMemberFilter('all'); setCategory('all'); setShowArchived(false);
    return () => { sessionEpoch.current++; };
  }, [context.revision]);
  const documents = context.snapshot?.documents || [];
  const members = context.snapshot?.members || [];
  const categories = Array.from(new Set([...CATEGORIES, ...documents.map(document => document.category)].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));
  const filtered = useMemo(() => documents.filter(document => document.archived === showArchived && (memberFilter === 'all' || memberFilter === document.memberId) && (category === 'all' || category === document.category) && `${document.title} ${document.filename} ${document.season}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [documents, showArchived, memberFilter, category, query]);
  if (!context.connected || !context.snapshot) return <PrivateAccess/>;
  const snapshot = context.snapshot;
  const busy = context.busy || preparing;
  function open(value?: PrivateDocument) { const next = copy(value || newDocument(season)); setLocalError(''); context.clearMessages(); setEditor({ value: next, original: JSON.stringify(next), isNew: !value, base: snapshot, file: null }); }
  function close() { if (busy) return; if (dirty && !window.confirm('Fermer ce document sans enregistrer ?')) return; setEditor(null); setLocalError(''); }
  function set<K extends keyof PrivateDocument>(key: K, value: PrivateDocument[K]) { if (editor) setEditor({ ...editor, value: { ...editor.value, [key]: value } }); }
  function choose(file?: File) {
    if (!file || !editor) return; setLocalError('');
    const mimeType = fileMime(file.name); const extension = file.name.split('.').pop()?.toLowerCase();
    if (!mimeType || !file.size || file.size > PRIVATE_CLUB_MAX_FILE_BYTES || file.name.length > 180 || /[/\\]/.test(file.name)) { setLocalError('Choisissez un PDF ou une image JPEG, PNG ou WebP de 5 Mo maximum, avec un nom de fichier de 180 caractères maximum.'); return; }
    setEditor({ ...editor, file, value: { ...editor.value, title: editor.value.title || file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '), filename: file.name, mimeType, size: file.size, filePath: `club/files/${editor.value.id}.${extension}` } });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editor || preparingLock.current || context.busy) return; setLocalError('');
    const epoch = sessionEpoch.current;
    preparingLock.current = true; setPreparing(true);
    try {
      if (editor.isNew && !editor.file) throw new Error('Choisissez le fichier à importer.');
      const value = validatePrivateDocument(editor.value); const file = editor.file ? await fileBase64(editor.file) : null;
      if (epoch !== sessionEpoch.current) return;
      const saved = await context.run(client => client.saveDocument(value, file, editor.base), 'Document enregistré dans l’espace privé.');
      if (saved && epoch === sessionEpoch.current) setEditor(null);
    } catch (failure) { if (epoch === sessionEpoch.current) setLocalError(errorText(failure)); }
    finally { if (epoch === sessionEpoch.current) { preparingLock.current = false; setPreparing(false); } }
  }
  async function archive(document: PrivateDocument) {
    if (!window.confirm(`${document.archived ? 'Rétablir' : 'Archiver'} « ${document.title} » ? ${document.archived ? '' : 'Le document restera accessible dans les archives privées.'}`)) return;
    await context.run(client => client.archiveDocument(document.id, !document.archived, snapshot), document.archived ? 'Document rétabli.' : 'Document archivé. Il peut être rétabli à tout moment.');
  }
  return <section className="pvc-panel" aria-label="Documents privés">
    <PrivateToolbar/><Messages/>
    <div className="pvc-toolbar"><div className="pvc-intro"><h2>Les pièces des adhérents</h2><p>Dossiers d’adhésion remplis et documents administratifs réservés aux responsables.</p></div><button className="adm-btn" disabled={busy} onClick={() => open()}><Upload size={18}/>Ajouter un document privé</button></div>
    <div className="pvc-filters"><label className="adm-search"><Search size={17}/><input aria-label="Rechercher un document privé" value={query} placeholder="Titre, fichier, saison…" onChange={event => setQuery(event.target.value)}/></label><label className="pvc-select"><span>Adhérent</span><select value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">Tous les adhérents</option><option value="">Documents communs</option>{members.map(member => <option key={member.id} value={member.id}>{memberName(member)}{member.archived ? ' (archivé)' : ''}</option>)}</select></label><label className="pvc-select"><span>Catégorie</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Toutes les catégories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label className="pvc-check"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)}/>Documents archivés</label></div>
    {filtered.length ? <div className="pvc-document-grid">{filtered.map(document => <article className="pvc-document-card" key={document.id}><div className="pvc-document-icon"><FileText size={25}/><span>{document.mimeType === 'application/pdf' ? 'PDF' : 'IMAGE'}</span></div><div className="pvc-tags"><span className="pvc-tag">{document.category}</span>{document.season && <span className="pvc-tag">{document.season}</span>}{document.archived && <span className="pvc-tag">Archivé</span>}</div><h3>{document.title}</h3><p>{document.memberId ? memberName(members.find(member => member.id === document.memberId)) : 'Document commun au bureau'}</p>{document.description && <p className="pvc-doc-description">{document.description}</p>}<small>{document.filename} · {fileSize(document.size)}</small><div className="pvc-document-actions"><button className="adm-btn adm-btn-subtle" disabled={busy} onClick={() => void context.download(document)}><Download size={17}/>Télécharger</button><button className="adm-icon-btn" disabled={busy} onClick={() => open(document)} aria-label={`Modifier ${document.title}`}><Pencil size={17}/></button><button className="adm-icon-btn" disabled={busy} onClick={() => void archive(document)} aria-label={`${document.archived ? 'Rétablir' : 'Archiver'} ${document.title}`}><Archive size={17}/></button></div></article>)}</div> : <EmptyState title={query || memberFilter !== 'all' || category !== 'all' ? 'Aucun document ne correspond' : showArchived ? 'Aucun document archivé' : 'Les dossiers ont leur place ici'}>{query || memberFilter !== 'all' || category !== 'all' ? 'Modifiez les filtres pour retrouver une pièce.' : showArchived ? 'Les documents archivés pourront être téléchargés ou rétablis ici.' : 'Importez un dossier rempli et rattachez-le à sa fiche adhérent. Le formulaire vierge se trouve dans les documents publics.'}</EmptyState>}
    <p className="pvc-privacy-note"><LockKeyhole size={16}/>Tous les responsables autorisés sur le dépôt privé peuvent consulter ces documents. Le rattachement à un adhérent sert à classer son dossier.</p>
    {editor && <PrivateDialog title={editor.isNew ? 'Ajouter un document privé' : 'Modifier le document'} close={close} busy={busy} footer={<><span className="adm-muted"><LockKeyhole size={14}/>Stockage privé</span><button className="adm-btn adm-btn-subtle" onClick={close} disabled={busy}>Annuler</button><button type="submit" form="pvc-document-form" className="adm-btn" disabled={busy || (!dirty && !editor.isNew)}>{busy ? <LoaderCircle className="pvc-spin" size={17}/> : <Upload size={17}/>}Enregistrer</button></>}>
      <form id="pvc-document-form" className="adm-editor-content" onSubmit={save}><Messages localError={localError}/><fieldset disabled={busy} className="pvc-fieldset"><section className="adm-section"><Field label={editor.isNew ? 'Fichier du document' : 'Remplacer le fichier — facultatif'} hint="PDF, JPEG, PNG ou WebP, 5 Mo maximum."><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={event => choose(event.target.files?.[0])}/></Field>{editor.value.filename && <div className="pvc-file-selected"><FileText size={22}/><span><strong>{editor.value.filename}</strong><small>{fileSize(editor.value.size)}{editor.file ? ' · prêt à importer' : ' · fichier actuel'}</small></span></div>}<Field label="Titre du document"><input value={editor.value.title} required maxLength={200} onChange={event => set('title', event.target.value)}/></Field><div className="adm-grid-two"><Field label="Catégorie"><select value={editor.value.category} onChange={event => set('category', event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select></Field><Field label="Saison"><input value={editor.value.season} maxLength={40} onChange={event => set('season', event.target.value)}/></Field></div><Field label="Rattacher à un adhérent"><select value={editor.value.memberId} onChange={event => set('memberId', event.target.value)}><option value="">Document commun au bureau</option>{members.map(member => <option key={member.id} value={member.id}>{memberName(member)}{member.archived ? ' (archivé)' : ''}</option>)}</select></Field><Field label="Description — facultatif"><textarea value={editor.value.description} maxLength={2000} rows={3} onChange={event => set('description', event.target.value)}/></Field></section><p className="adm-form-note">Les questionnaires médicaux remplis restent avec l’adhérent et son médecin. Importez ici les pièces administratives nécessaires au club.</p></fieldset>{(context.error || localError) && <button className="adm-text-link" type="button" disabled={busy} onClick={async () => { if (!window.confirm('Actualiser et fermer ce formulaire ? Les modifications non enregistrées seront abandonnées.')) return; if (await context.reload()) { setEditor(null); setLocalError(''); } }}>Actualiser les documents et reprendre la saisie</button>}</form>
    </PrivateDialog>}
  </section>;
}
