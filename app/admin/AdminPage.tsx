import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, ExternalLink, Eye, FilePenLine, FolderOpen, ImagePlus, Images, LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, Menu, Newspaper, Pencil, Plus, Search, ShieldCheck, Trash2, Upload, Users, X } from 'lucide-react';
import { mediaUrl, siteUrl } from '../../lib/site-delivery';
import { validateSiteSettings } from '../../lib/public-site-settings.mjs';
import type { PublicEvent, PublicSiteSettings } from '../../lib/public-site-content';
import { GitHubAdminClient, GitHubAdminError, validateAdminNews, validateAdminPhoto, type AdminChange, type AdminMedia, type AdminNews, type AdminPhoto, type AdminSnapshot, type ManagedRecord } from '../../lib/github-admin';
import { ClubEditor, EventEditor, FeaturedEditor, NewsEditor, PhotoEditor } from './AdminEditors';
import PublicDocumentsPanel from './PublicDocumentsPanel';
import { PrivateClubProvider, PrivateMembersPanel, PrivateDocumentsPanel, usePrivateClub } from './PrivateClubPanel';
import { AccessPanel } from './AccessPanel';
import './admin.css';

const PUBLIC_SITE = 'https://durstyone.github.io/Hippocampes/';
const REPOSITORY = 'https://github.com/Durstyone/Hippocampes';
const CMS = 'https://app.pagescms.org/durstyone/hippocampes/main/file/site';
const TOKEN_HELP = 'https://docs.github.com/fr/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens';
const SETTINGS_PATH = 'github-pages/content/site-settings.json';
const CATEGORIES = { piscine: 'Piscine', formation: 'Formation', sortie: 'Sortie', club: 'Vie du club', ferie: 'Jour férié' };
type Section = 'dashboard' | 'news' | 'photos' | 'agenda' | 'club' | 'members' | 'documents' | 'access' | 'settings';
type ClubTab = 'presentation' | 'contact' | 'season' | 'faq';
type EditValue =
  | { kind: 'news'; value: AdminNews; record?: ManagedRecord<AdminNews> }
  | { kind: 'photo'; value: AdminPhoto; record?: ManagedRecord<AdminPhoto> }
  | { kind: 'event'; value: PublicEvent; index?: number }
  | { kind: 'featured'; value: PublicSiteSettings['featuredNews'][number]; index: number }
  | { kind: 'club'; value: PublicSiteSettings; tab: ClubTab };
type Editor = EditValue & { base: AdminSnapshot; original: string; newPath?: string };
type UploadPhoto = { id: string; file: File; preview: string; title: string; alt: string };
type DeleteRequest = { label: string; changes: AdminChange[]; base: AdminSnapshot };

function today() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (part: string) => parts.find(p => p.type === part)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function dateText(value: string, short = false) {
  if (!value) return 'Créneau habituel';
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }), timeZone: 'Europe/Paris' }).format(date);
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function slug(title: string) { return (title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 85) || 'publication') + '-' + crypto.randomUUID().slice(0, 8); }
function jsonChange(path: string, data: unknown): AdminChange { return { path, content: JSON.stringify(data, null, 2) + '\n', encoding: 'utf-8' }; }
function newNews(image = ''): AdminNews { return { title: '', date: today(), excerpt: '', body: '', image, url: '' }; }
function newPhoto(image = ''): AdminPhoto { return { title: '', image, alt: '', album: '', date: '', description: '', credit: '', order: 0 }; }
function emptyEvent(settings: PublicSiteSettings, date = ''): PublicEvent {
  return { id: '', title: '', date, endDate: '', startTime: '', endTime: '', dateLabel: '', dateValue: '', category: 'Vie du club', calendarCategory: 'club', status: 'scheduled', timeLabel: '', description: '', contactSubject: '', location: settings.contact.venue, calendarDescription: '', sourceUrl: '' };
}
function shiftMonth(value: string, offset: number) { const d = new Date(`${value}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + offset); return d.toISOString().slice(0, 7); }
function mediaTitle(asset: AdminMedia, data: AdminSnapshot) {
  if (asset.path === data.settings.season.calendarImage) return `Programme de la saison ${data.settings.season.name}`;
  return data.photos.find(p => p.data.image === asset.path)?.data.title || data.news.find(n => n.data.image === asset.path)?.data.title || data.settings.featuredNews.find(n => n.image === asset.path)?.title || (asset.path.startsWith('/media/archive/') ? 'Photographie des archives' : asset.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
}
function MediaImage({ path, alt = '', className = '' }: { path: string; alt?: string; className?: string }) {
  return path ? <img className={className} src={mediaUrl(path)} alt={alt} loading="lazy" onError={event => {
    const img = event.currentTarget;
    if (path.startsWith('/') && !img.dataset.fallback) { img.dataset.fallback = 'true'; img.src = `https://raw.githubusercontent.com/Durstyone/Hippocampes/main/public${path}`; }
  }} /> : <span className={`adm-image-empty ${className}`}><Images size={30}/></span>;
}
function Dialog({ title, children, footer, onClose, compact = false, busy = false }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; compact?: boolean; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`adm-dialog ${compact ? 'adm-dialog-compact' : ''}`} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === ref.current && !busy) onClose(); }}>
    <div className="adm-dialog-head"><h2>{title}</h2><button type="button" className="adm-icon-btn" aria-label="Fermer" disabled={busy} onClick={onClose}><X size={21}/></button></div>
    <div className="adm-dialog-body">{children}</div>{footer && <div className="adm-dialog-footer">{footer}</div>}
  </dialog>;
}
function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="adm-empty"><Images size={32}/><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export default function AdminPage() { return <PrivateClubProvider><AdminWorkspace/></PrivateClubProvider>; }

function AdminWorkspace() {
  const privateClub = usePrivateClub();
  const [section, setSection] = useState<Section>('dashboard');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState('');
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; url?: string } | null>(null);
  const [identity, setIdentity] = useState<{ login: string; avatarUrl: string } | null>(null);
  const client = useRef<GitHubAdminClient | null>(null);
  const saveLock = useRef(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [query, setQuery] = useState('');
  const [newsTab, setNewsTab] = useState<'featured' | 'articles'>('featured');
  const [photoTab, setPhotoTab] = useState<'library' | 'albums'>('library');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [previewMedia, setPreviewMedia] = useState<AdminMedia | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploads, setUploads] = useState<UploadPhoto[]>([]);
  const uploadRef = useRef<UploadPhoto[]>([]);
  const [uploadAlbum, setUploadAlbum] = useState('');
  const [uploadDate, setUploadDate] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [preparingUpload, setPreparingUpload] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [agendaView, setAgendaView] = useState<'month' | 'list'>(() => window.innerWidth < 760 ? 'list' : 'month');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [category, setCategory] = useState('all');
  const [clubTab, setClubTab] = useState<ClubTab>('presentation');
  const [documentTab, setDocumentTab] = useState<'public' | 'private'>('public');
  const [accessBusy, setAccessBusy] = useState(false);
  const dirty = !!editor && JSON.stringify(editor.value) !== editor.original;

  async function loadPublished() {
    setLoading(true); setLoadError('');
    try {
      const response = await fetch(siteUrl('/content/admin-content.json'), { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('Le contenu publié ne peut pas être chargé. Réessayez dans un instant.');
      const data: AdminSnapshot = await response.json();
      if (!data.settingsSha || !Array.isArray(data.media) || !Array.isArray(data.news) || !Array.isArray(data.photos) || !Array.isArray(data.documents) || !Array.isArray(data.documentFiles) || !data.fileShas) throw new Error('Les données de l’administration sont incomplètes.');
      data.settings = validateSiteSettings(data.settings); setSnapshot(data);
      if (data.settings.season.startDate && today() < data.settings.season.startDate) setMonth(data.settings.season.startDate.slice(0, 7));
      if (data.settings.season.endDate && today() > data.settings.season.endDate) setMonth(data.settings.season.endDate.slice(0, 7));
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    document.title = 'Administration du club — Les Hippocampes du Robec'; void loadPublished();
    return () => { client.current?.destroy(); uploadRef.current.forEach(item => URL.revokeObjectURL(item.preview)); };
  }, []);
  useEffect(() => { uploadRef.current = uploads; }, [uploads]);
  useEffect(() => {
    if (!dirty && !uploads.length && !saving) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, uploads.length, saving]);
  function navigate(next: Section) { if (accessBusy || privateClub.busy || privateClub.connecting) return; setSection(next); setQuery(''); setMobileMenu(false); setError(''); }
  function openEditor(value: EditValue) {
    if (!snapshot) return;
    setError(''); setRecoveryAvailable(false); setPreviewMedia(null); setEditor({ ...value, value: clone(value.value), base: snapshot, original: JSON.stringify(value.value) } as Editor);
  }
  function closeEditor() { if (saving) return; if (dirty && !window.confirm('Quitter sans enregistrer les modifications ?')) return; setEditor(null); setError(''); }
  function clearUploads() { uploads.forEach(item => URL.revokeObjectURL(item.preview)); setUploads([]); setUploadOpen(false); setUploadError(''); }
  function closeUploads() { if (saving || preparingUpload) return; if (uploads.length && !window.confirm('Fermer sans importer ces photos ?')) return; clearUploads(); }
  function connect() { setConnectionError(''); setConnectOpen(true); }
  async function authenticate(event: FormEvent) {
    event.preventDefault(); setConnecting(true); setConnectionError('');
    let api: GitHubAdminClient | null = null;
    const credential = token.trim(); setToken('');
    try {
      api = new GitHubAdminClient(credential);
      const user = await api.connect(); const current = await api.load();
      client.current?.destroy(); client.current = api; setIdentity(user); setSnapshot(current); setConnectOpen(false);
      let privateReady = false;
      try { await privateClub.connect(credential); privateReady = true; } catch { /* Public editing remains available when the credential has no private repository access. */ }
      setNotice({ text: privateReady ? `Connexion vérifiée avec ${user.login}. Le site et les dossiers privés sont accessibles.` : `Connexion vérifiée avec ${user.login} pour le site. L’accès aux dossiers privés se connecte depuis Adhérents.` });
    } catch (e) { api?.destroy(); setConnectionError(e instanceof Error ? e.message : 'Connexion impossible.'); }
    finally { setConnecting(false); }
  }
  function disconnect() { if (saving || connecting || privateClub.busy || privateClub.connecting) return; client.current?.destroy(); client.current = null; setIdentity(null); privateClub.disconnect(); setNotice({ text: 'Vous êtes déconnecté. Les données privées sont effacées de cet onglet.' }); }
  async function persist(changes: AdminChange[], message: string, base: AdminSnapshot) {
    if (saveLock.current) return false;
    if (!client.current) { connect(); return false; }
    saveLock.current = true;
    setSaving(true); setError(''); setUploadError(''); setRecoveryAvailable(false);
    try {
      const result = await client.current.commit(changes, message.slice(0, 450), base);
      setEditor(null); setDeleteRequest(null); clearUploads();
      setNotice({ text: 'Enregistré sur GitHub. La mise à jour du site est lancée.', url: result.url });
      try { setSnapshot(await client.current.load()); }
      catch { setNotice({ text: 'Enregistrement réussi. Rechargez l’administration pour retrouver les derniers contenus.', url: result.url }); }
      return true;
    } catch (e) { const text = e instanceof Error ? e.message : 'Enregistrement impossible. Vos modifications sont conservées.'; setError(text); setUploadError(text); setRecoveryAvailable(e instanceof GitHubAdminError && ['conflict', 'network', 'response', 'service'].includes(e.code)); return false; }
    finally { saveLock.current = false; setSaving(false); }
  }
  async function reloadPublicContent() {
    if (!client.current || saveLock.current) return false;
    setSaving(true); setError('');
    try { setSnapshot(await client.current.load()); setNotice({ text: 'Votre saisie a été exportée. Les contenus GitHub sont à jour ; ouvrez le document pour reprendre vos modifications.' }); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'La saisie a été exportée, mais GitHub ne peut pas être rechargé.'); return false; }
    finally { setSaving(false); }
  }
  async function saveEditor(event: FormEvent) {
    event.preventDefault(); if (!editor) return; setError('');
    try {
      const base = editor.base; let changes: AdminChange[] = []; let message = '';
      if (editor.kind === 'news') {
        if (!editor.value.excerpt.trim() || !editor.value.body.trim()) throw new Error('Renseignez le résumé et le texte de l’article avant de l’enregistrer.');
        const data = validateAdminNews(editor.value); const path = editor.record?.path || editor.newPath || `github-pages/content/news/${slug(data.title)}.json`;
        if (!editor.record && !editor.newPath) setEditor({ ...editor, newPath: path });
        changes = [jsonChange(path, data)]; message = `${editor.record ? 'Mettre à jour' : 'Publier'} l’actualité : ${data.title}`;
      } else if (editor.kind === 'photo') {
        const data = validateAdminPhoto(editor.value); const path = editor.record?.path || editor.newPath || `github-pages/content/photos/${slug(data.title)}.json`;
        if (!editor.record && !editor.newPath) setEditor({ ...editor, newPath: path });
        changes = [jsonChange(path, data)]; message = `${editor.record ? 'Mettre à jour' : 'Ajouter'} la photo : ${data.title}`;
      } else {
        const settings = clone(editor.kind === 'club' ? editor.value : base.settings);
        if (editor.kind === 'event') {
          const value = { ...editor.value, id: editor.value.id || slug(editor.value.title), contactSubject: (editor.value.contactSubject || editor.value.title).slice(0, 160) };
          if (editor.index === undefined) settings.events.push(value); else settings.events[editor.index] = value;
          message = `${editor.index === undefined ? 'Ajouter' : 'Modifier'} le rendez-vous : ${value.title}`;
        }
        if (editor.kind === 'featured') { settings.featuredNews[editor.index] = editor.value; message = `Mettre à jour le récit à la une : ${editor.value.title}`; }
        if (editor.kind === 'club') message = 'Mettre à jour les informations du club';
        changes = [jsonChange(SETTINGS_PATH, validateSiteSettings(settings))];
      }
      await persist(changes, message, base);
    } catch (e) { setError(e instanceof Error ? e.message : 'Vérifiez les champs du formulaire.'); }
  }
  async function exportAndReload() {
    if (!editor || !client.current || saving) return;
    const blob = new Blob([JSON.stringify(editor.value, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'contenu-a-reprendre.json'; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaving(true);
    try { const current = await client.current.load(); setSnapshot(current); setEditor(null); setRecoveryAvailable(false); setNotice({ text: 'Votre saisie a été exportée. Les contenus GitHub sont rechargés ; ouvrez la version actuelle pour reprendre vos modifications.' }); }
    catch { setError('Votre saisie a été exportée, mais GitHub n’a pas pu être rechargé. Le formulaire reste ouvert.'); }
    finally { setSaving(false); }
  }
  function askDelete() {
    if (!editor || editor.kind === 'club') return;
    let changes: AdminChange[];
    if (editor.kind === 'news' || editor.kind === 'photo') {
      if (!editor.record) return; changes = [{ path: editor.record.path, content: null }];
    } else {
      if (editor.index === undefined) return;
      const data = clone(editor.base.settings);
      if (editor.kind === 'event') data.events.splice(editor.index, 1); else data.featuredNews.splice(editor.index, 1);
      changes = [jsonChange(SETTINGS_PATH, validateSiteSettings(data))];
    }
    setError(''); setDeleteRequest({ label: editor.value.title, changes, base: editor.base });
  }
  async function addFiles(files: FileList | File[]) {
    setUploadError(''); setPreparingUpload(true); const added: UploadPhoto[] = [];
    try {
      const candidates = Array.from(files);
      if (uploads.length + candidates.length > 20 || [...uploads.map(item => item.file), ...candidates].reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) throw new Error('Importez au maximum 20 photos et 20 Mo à la fois.');
      for (const file of candidates) {
        if (!/\.(?:jpe?g|png|webp|gif)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) throw new Error(`${file.name} : choisissez une image JPG, PNG, WebP ou GIF de 5 Mo maximum.`);
        const bitmap = await createImageBitmap(file).catch(() => { throw new Error(`${file.name} n’est pas une image lisible.`); });
        const valid = bitmap.width <= 30000 && bitmap.height <= 30000 && bitmap.width * bitmap.height <= 100000000; bitmap.close();
        if (!valid) throw new Error(`${file.name} : cette image est trop grande. Réduisez ses dimensions.`);
        const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
        added.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), title, alt: title });
      }
      setUploads(previous => [...previous, ...added]);
    } catch (e) { added.forEach(item => URL.revokeObjectURL(item.preview)); setUploadError(e instanceof Error ? e.message : 'Import impossible.'); }
    finally { setPreparingUpload(false); }
  }
  async function publishUploads(event: FormEvent) {
    event.preventDefault(); if (!snapshot || !uploads.length || preparingUpload || saveLock.current) return;
    if (!client.current) { connect(); return; } setUploadError('');
    setPreparingUpload(true);
    try {
      const changes: AdminChange[] = [];
      for (const item of uploads) {
        const extension = item.file.name.match(/\.([^.]+)$/)?.[1].toLowerCase() || '';
        const image = `/images/publications/${item.id}.${extension}`;
        const data = validateAdminPhoto({ ...newPhoto(image), title: item.title, alt: item.alt, album: uploadAlbum, date: uploadDate });
        const bytes = new Uint8Array(await item.file.arrayBuffer()); let binary = '';
        for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        changes.push({ path: `public${image}`, content: btoa(binary), encoding: 'base64' }, jsonChange(`github-pages/content/photos/${item.id}.json`, data));
      }
      const saved = await persist(changes, `Ajouter ${uploads.length} photo${uploads.length > 1 ? 's' : ''} à l’album ${uploadAlbum}`, snapshot);
      if (saved) { setPhotoTab('albums'); setSelectedAlbum(uploadAlbum); }
    } catch (e) { setUploadError(e instanceof Error ? e.message : 'Vérifiez les informations des photos.'); }
    finally { setPreparingUpload(false); }
  }

  const nav = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'members', label: 'Adhérents', icon: Users },
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'news', label: 'Actualités', icon: Newspaper },
    { id: 'photos', label: 'Photos et albums', icon: Images },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    { id: 'club', label: 'Le club', icon: Building2 },
    { id: 'access', label: 'Accès et droits', icon: ShieldCheck },
  ] as const;
  const currentTitle = [...nav, { id: 'settings', label: 'Connexion et aide' }].find(item => item.id === section)?.label || 'Administration';
  const upcoming = useMemo(() => snapshot?.settings.events.filter(event => event.date && (event.endDate || event.date) >= today() && event.calendarCategory !== 'ferie').sort((a, b) => a.date.localeCompare(b.date)) || [], [snapshot]);
  const albums = useMemo(() => [...new Set(snapshot?.photos.map(photo => photo.data.album) || [])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr')), [snapshot]);
  const namedMedia = useMemo(() => snapshot?.media.map((asset, index) => ({ ...asset, name: mediaTitle(asset, snapshot) + (asset.path.startsWith('/media/archive/') ? ` · photo ${index + 1}` : '') })) || [], [snapshot]);
  const filteredMedia = snapshot?.media.filter(asset => (!query || mediaTitle(asset, snapshot).toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))) && (mediaFilter === 'all' || (mediaFilter === 'archives' ? asset.path.startsWith('/media/archive/') : mediaFilter === 'imports' ? asset.path.startsWith('/images/publications/') : [...snapshot.settings.featuredNews, ...snapshot.news.map(n => n.data)].some(item => item.image === asset.path)))) || [];
  const events = snapshot?.settings.events.filter(event => (category === 'all' || event.calendarCategory === category) && (!query || `${event.title} ${event.description} ${event.location}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))) || [];
  const monthDays = useMemo(() => { const start = new Date(`${month}-01T12:00:00Z`); const offset = (start.getUTCDay() + 6) % 7; start.setUTCDate(start.getUTCDate() - offset); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); }); }, [month]);
  const primaryAction = section === 'news' ? <button className="adm-btn" onClick={() => openEditor({ kind: 'news', value: newNews() })}><Plus size={18}/>Écrire une actualité</button> : section === 'photos' ? <button className="adm-btn" onClick={() => { setUploadOpen(true); setUploadAlbum(selectedAlbum); setUploadError(''); }}><Upload size={18}/>Ajouter des photos</button> : section === 'agenda' ? <button className="adm-btn" onClick={() => snapshot && openEditor({ kind: 'event', value: emptyEvent(snapshot.settings) })}><Plus size={18}/>Créer un événement</button> : section === 'club' ? <button className="adm-btn" onClick={() => snapshot && openEditor({ kind: 'club', value: snapshot.settings, tab: clubTab })}><Pencil size={17}/>Modifier</button> : null;

  return <div className="adm-app">
    <a className="adm-skip" href="#admin-content">Aller au contenu</a>
    {mobileMenu && <button className="adm-sidebar-backdrop" aria-label="Fermer le menu" onClick={() => setMobileMenu(false)}/>}
    <aside className={`adm-sidebar ${mobileMenu ? 'is-open' : ''}`} aria-label="Menu de l’administration">
      <a href={PUBLIC_SITE} className="adm-brand"><img src={mediaUrl('/images/logo-club.jpg')} width="48" height="48" alt=""/><span>Les Hippocampes<small>DU ROBEC</small></span></a>
      <p className="adm-sidebar-label">ESPACE D’ADMINISTRATION</p>
      <nav aria-label="Rubriques de l’administration">{nav.map(item => <button key={item.id} onClick={() => navigate(item.id)} aria-current={section === item.id ? 'page' : undefined}><item.icon size={20}/><span>{item.label}</span>{item.id === 'news' && !!snapshot && <small>{snapshot.news.length + snapshot.settings.featuredNews.length}</small>}</button>)}</nav>
      <div className="adm-sidebar-season"><CalendarDays size={18}/><div><span>Saison du club</span><strong>{snapshot?.settings.season.name || '…'}</strong></div></div>
      <div className="adm-sidebar-bottom"><button onClick={() => navigate('settings')} aria-current={section === 'settings' ? 'page' : undefined}><CircleHelp size={19}/>Connexion et aide</button><a href={PUBLIC_SITE}><ExternalLink size={18}/>Retour au site</a><span>Les contenus du club, sur GitHub.</span></div>
    </aside>
    <div className="adm-workspace">
      <header className="adm-topbar"><div className="adm-topbar-left"><button className="adm-icon-btn adm-mobile-toggle" aria-label="Ouvrir le menu" aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><Menu size={22}/></button><span>Administration <b>/</b> <strong>{currentTitle}</strong></span></div><div className="adm-topbar-actions"><a className="adm-view-site" href={PUBLIC_SITE} target="_blank" rel="noopener noreferrer"><Eye size={17}/>Voir le site</a>{identity ? <button className="adm-account" onClick={() => navigate('settings')}><span>{identity.login.slice(0, 1).toUpperCase()}</span>{identity.login}</button> : <button className="adm-btn adm-btn-subtle" onClick={connect}><LockKeyhole size={16}/>Connexion</button>}</div></header>
      <main id="admin-content" className="adm-main">
        {notice && <div className="adm-notice" role="status"><Check size={19}/><span>{notice.text}{notice.url && <> <a href={notice.url} target="_blank" rel="noopener noreferrer">Voir l’enregistrement</a></>}</span><button className="adm-icon-btn" aria-label="Fermer le message" onClick={() => setNotice(null)}><X size={17}/></button></div>}
        <div className="adm-heading"><div><p className="adm-eyebrow">LES HIPPOCAMPES DU ROBEC</p><h1>{currentTitle}</h1><p>{section === 'dashboard' ? 'Les nouvelles, les rendez-vous et les images qui font vivre le club.' : section === 'news' ? 'Partagez les sorties, les rencontres et les nouvelles du club.' : section === 'photos' ? 'Retrouvez vos images et rassemblez-les en albums.' : section === 'agenda' ? 'Tous les rendez-vous de la saison, au même endroit.' : section === 'club' ? 'Les informations que les visiteurs retrouvent sur le site.' : section === 'members' ? 'Les fiches et le suivi administratif des adhérents.' : section === 'documents' ? 'Les formulaires à télécharger et les dossiers du club.' : section === 'access' ? 'Choisissez les responsables autorisés à intervenir.' : 'Votre accès à la publication et les réponses utiles.'}</p></div>{!!snapshot && primaryAction}</div>
        {section === 'members' && <PrivateMembersPanel season={snapshot?.settings.season.name || '2026–2027'}/>}
        {section === 'access' && <AccessPanel members={privateClub.snapshot?.members.filter(member => !member.archived) || []} onBusyChange={setAccessBusy}/>}
        {section !== 'members' && section !== 'access' && (loading ? <div className="adm-loading" role="status"><LoaderCircle className="adm-spin"/>Chargement du contenu du club…</div> : loadError ? <div className="adm-error" role="alert"><p>{loadError}</p><button className="adm-btn" onClick={() => void loadPublished()}>Réessayer</button></div> : snapshot && <>
          {section === 'dashboard' && <>
            <div className="adm-quick-actions"><button onClick={() => openEditor({ kind: 'news', value: newNews() })}><span><FilePenLine size={22}/></span><div><strong>Écrire une actualité</strong><small>Un récit, une annonce, une sortie</small></div><Plus size={18}/></button><button onClick={() => { setUploadOpen(true); setUploadError(''); }}><span><ImagePlus size={22}/></span><div><strong>Ajouter des photos</strong><small>Pour le site et les albums</small></div><Plus size={18}/></button><button onClick={() => openEditor({ kind: 'event', value: emptyEvent(snapshot.settings) })}><span><CalendarDays size={22}/></span><div><strong>Créer un événement</strong><small>Une date à partager au club</small></div><Plus size={18}/></button></div>
            <div className="adm-stats"><button onClick={() => navigate('news')}><Newspaper size={21}/><strong>{snapshot.news.length + snapshot.settings.featuredNews.length}</strong><span>actualités et récits à la une</span></button><button onClick={() => navigate('agenda')}><CalendarDays size={21}/><strong>{upcoming.length}</strong><span>rendez-vous à venir</span></button><button onClick={() => navigate('photos')}><Images size={21}/><strong>{snapshot.media.length}</strong><span>images dans la bibliothèque</span></button></div>
            <div className="adm-dashboard-grid"><section className="adm-panel"><div className="adm-panel-title"><div><span className="adm-eyebrow">LE PROGRAMME</span><h2>Les prochains rendez-vous</h2></div><button className="adm-text-button" onClick={() => navigate('agenda')}>Tout l’agenda</button></div>{upcoming.length ? upcoming.slice(0, 4).map(event => <button className="adm-event-row" key={event.id} onClick={() => openEditor({ kind: 'event', value: event, index: snapshot.settings.events.findIndex(e => e.id === event.id) })}><span className="adm-date-badge"><strong>{Number(event.date.slice(8))}</strong><small>{new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(`${event.date}T12:00:00Z`))}</small></span><span className="adm-event-copy"><small className={`adm-category adm-category-${event.calendarCategory}`}>{event.category}</small><strong>{event.title}</strong><small>{event.startTime ? event.startTime.replace(':', ' h ') : event.timeLabel}</small></span><Pencil size={16}/></button>) : <p className="adm-muted">Aucun rendez-vous à venir dans cette saison.</p>}</section><section className="adm-panel adm-season-card"><span className="adm-eyebrow">LE CLUB AU QUOTIDIEN</span><h2>Saison {snapshot.settings.season.name}</h2><p>{snapshot.settings.contact.venueShort}</p><div className="adm-season-detail"><CalendarDays size={20}/><span>{snapshot.settings.contact.hoursSummary}</span></div><p className="adm-muted">{snapshot.settings.contact.hoursLines.join(' · ')}</p><button className="adm-btn adm-btn-subtle" onClick={() => { navigate('club'); setClubTab('contact'); }}>Modifier les informations</button><div className="adm-connection-summary"><LockKeyhole size={16}/><span>{identity ? `Connecté avec ${identity.login}` : 'Vous consultez le contenu public.'}{!identity && <button onClick={connect}>Se connecter pour enregistrer</button>}</span></div></section></div>
            <section className="adm-panel adm-featured-dashboard"><div className="adm-panel-title"><div><span className="adm-eyebrow">SUR LE SITE</span><h2>À la une</h2></div><button className="adm-text-button" onClick={() => { navigate('news'); setNewsTab('featured'); }}>Gérer les actualités</button></div><div className="adm-story-grid">{snapshot.settings.featuredNews.map((item, index) => <button key={`${index}-${item.title}`} className="adm-story-card" onClick={() => openEditor({ kind: 'featured', value: item, index })}><MediaImage path={item.image}/><span><small>{item.date}</small><strong>{item.title}</strong><span className="adm-card-edit"><Pencil size={14}/>Modifier le récit</span></span></button>)}</div></section>
          </>}
          {section === 'news' && <>
            <div className="adm-toolbar"><div className="adm-tabs" aria-label="Type d’actualité"><button aria-pressed={newsTab === 'featured'} onClick={() => setNewsTab('featured')}>À la une <span>{snapshot.settings.featuredNews.length}</span></button><button aria-pressed={newsTab === 'articles'} onClick={() => setNewsTab('articles')}>Articles <span>{snapshot.news.length}</span></button></div><label className="adm-search"><Search size={18}/><input aria-label="Rechercher une actualité" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une actualité"/></label></div>
            {newsTab === 'featured' ? <div className="adm-news-grid">{snapshot.settings.featuredNews.map((item, index) => ({ item, index })).filter(({ item }) => item.title.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).map(({ item, index }) => <article className="adm-news-card" key={index}><MediaImage path={item.image} alt={item.alt}/><div><span className="adm-tag">À la une</span><p className="adm-muted">{item.date} · {item.category}</p><h2>{item.title}</h2><p>{item.summary}</p><button className="adm-btn adm-btn-subtle" onClick={() => openEditor({ kind: 'featured', value: item, index })}><Pencil size={16}/>Modifier</button></div></article>)}</div> : snapshot.news.length ? <div className="adm-panel adm-list">{snapshot.news.filter(item => item.data.title.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).map(record => <button className="adm-content-row" key={record.id} onClick={() => openEditor({ kind: 'news', value: record.data, record })}><MediaImage path={record.data.image}/><span><small>{dateText(record.data.date)}</small><strong>{record.data.title}</strong><span>{record.data.excerpt}</span></span><Pencil size={18}/></button>)}</div> : <Empty title="Le prochain récit est à vous." action={<button className="adm-btn" onClick={() => openEditor({ kind: 'news', value: newNews() })}><Plus size={17}/>Écrire une actualité</button>}>Les récits existants sont dans « À la une ». Les nouveaux articles publiés ici auront leur propre page sur le site.</Empty>}
          </>}
          {section === 'photos' && <>
            <div className="adm-toolbar"><div className="adm-tabs" aria-label="Présentation des photos"><button aria-pressed={photoTab === 'library'} onClick={() => setPhotoTab('library')}>Bibliothèque <span>{snapshot.media.length}</span></button><button aria-pressed={photoTab === 'albums'} onClick={() => setPhotoTab('albums')}>Albums <span>{albums.length}</span></button></div><label className="adm-search"><Search size={18}/><input aria-label="Rechercher une photo" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une photo"/></label></div>
            {photoTab === 'library' ? <><div className="adm-filter-line"><label>Afficher <select aria-label="Filtrer la bibliothèque" value={mediaFilter} onChange={event => setMediaFilter(event.target.value)}><option value="all">Toutes les images</option><option value="news">Photos des actualités</option><option value="imports">Images importées</option><option value="archives">Photos des archives</option></select></label><span>{filteredMedia.length} image{filteredMedia.length > 1 ? 's' : ''}</span></div><div className="adm-media-grid">{filteredMedia.map(asset => <button key={asset.path} className="adm-media-card" onClick={() => setPreviewMedia(asset)}><MediaImage path={asset.path} alt={mediaTitle(asset, snapshot)}/><span><strong>{mediaTitle(asset, snapshot)}</strong><small>{asset.path.startsWith('/media/archive/') ? 'Archives du club' : 'Bibliothèque du site'}</small></span></button>)}</div>{!filteredMedia.length && <Empty title="Aucune photo trouvée.">Essayez un autre mot ou une autre catégorie.</Empty>}</> : <>{!!albums.length && <div className="adm-filter-line"><label>Album <select aria-label="Choisir un album" value={selectedAlbum} onChange={event => setSelectedAlbum(event.target.value)}><option value="">Tous les albums</option>{albums.map(album => <option key={album}>{album}</option>)}</select></label></div>}{!albums.length ? <Empty title="Rassemblez les souvenirs d’une sortie." action={<button className="adm-btn" onClick={() => { setUploadOpen(true); setUploadError(''); }}><ImagePlus size={18}/>Créer un album avec des photos</button>}>Ajoutez des photos et donnez-leur le même nom d’album. Les images déjà présentes restent disponibles dans la bibliothèque.</Empty> : <div className="adm-media-grid">{snapshot.photos.filter(record => (!selectedAlbum || record.data.album === selectedAlbum) && `${record.data.title} ${record.data.album}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).map(record => <button className="adm-media-card" key={record.id} onClick={() => openEditor({ kind: 'photo', value: record.data, record })}><MediaImage path={record.data.image} alt={record.data.alt}/><span><strong>{record.data.title}</strong><small>{record.data.album}</small></span></button>)}</div>}</>}
          </>}
          {section === 'agenda' && <>
            <div className="adm-toolbar"><div className="adm-tabs" aria-label="Vue de l’agenda"><button aria-pressed={agendaView === 'month'} onClick={() => setAgendaView('month')}>Mois</button><button aria-pressed={agendaView === 'list'} onClick={() => setAgendaView('list')}>Liste</button></div><label className="adm-search"><Search size={18}/><input aria-label="Rechercher un événement" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un événement"/></label><select aria-label="Catégorie d’événement" className="adm-filter-select" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Toutes les activités</option>{Object.entries(CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            {agendaView === 'month' ? <section className="adm-panel adm-calendar-panel"><div className="adm-calendar-toolbar"><div><button className="adm-icon-btn" aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={21}/></button><h2>{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00Z`))}</h2><button className="adm-icon-btn" aria-label="Mois suivant" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={21}/></button></div><button className="adm-btn adm-btn-subtle" onClick={() => setMonth(today().slice(0, 7))}>Aujourd’hui</button></div><div className="adm-calendar-scroll"><div className="adm-calendar"><div className="adm-calendar-week">{['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'].map(day => <span key={day}>{day}</span>)}</div><div className="adm-calendar-days">{monthDays.map(date => <div key={date} className={`adm-calendar-day ${date.startsWith(month) ? '' : 'is-outside'} ${date === today() ? 'is-today' : ''}`}><button className="adm-day-number" aria-label={`Créer un événement le ${dateText(date)}`} onClick={() => openEditor({ kind: 'event', value: emptyEvent(snapshot.settings, date) })}>{Number(date.slice(8))}</button>{events.filter(event => event.date && event.date <= date && (event.endDate || event.date) >= date).map(event => <button key={event.id} className={`adm-calendar-event adm-category-${event.calendarCategory}`} onClick={() => openEditor({ kind: 'event', value: event, index: snapshot.settings.events.findIndex(e => e.id === event.id) })}>{event.startTime && <small>{event.startTime}</small>}{event.title}</button>)}</div>)}</div></div></div><p className="adm-form-note">Cliquez sur un événement pour le modifier, ou sur un jour pour ajouter une date.</p></section> : <section className="adm-panel adm-list">{events.filter(event => event.date).sort((a, b) => a.date.localeCompare(b.date)).map(event => <button className="adm-agenda-row" key={event.id} onClick={() => openEditor({ kind: 'event', value: event, index: snapshot.settings.events.findIndex(e => e.id === event.id) })}><span className="adm-agenda-date">{dateText(event.date, true)}</span><span><small className={`adm-category adm-category-${event.calendarCategory}`}>{event.category}</small><strong>{event.title}</strong><small>{event.startTime || event.timeLabel}</small></span><span className={`adm-status adm-status-${event.status}`}>{event.status === 'confirmed' ? 'Confirmé' : event.status === 'tentative' ? 'À confirmer' : 'Prévu'}</span><Pencil size={16}/></button>)}</section>}
            <section className="adm-panel adm-regular"><div className="adm-panel-title"><h2>Les créneaux habituels</h2><span className="adm-muted">Sans date précise</span></div><div className="adm-regular-grid">{events.filter(event => !event.date).map(event => <button key={event.id} onClick={() => openEditor({ kind: 'event', value: event, index: snapshot.settings.events.findIndex(e => e.id === event.id) })}><CalendarDays size={22}/><span><strong>{event.title}</strong><small>{event.dateValue} · {event.timeLabel}</small></span><Pencil size={16}/></button>)}</div></section>
          </>}
          {section === 'documents' && <><div className="adm-tabs" aria-label="Type de documents"><button aria-pressed={documentTab === 'public'} onClick={() => setDocumentTab('public')}>Documents publics</button><button aria-pressed={documentTab === 'private'} onClick={() => setDocumentTab('private')}><LockKeyhole size={16}/>Documents privés</button></div>{documentTab === 'public' ? <PublicDocumentsPanel snapshot={snapshot} onSave={persist} onReload={reloadPublicContent} saving={saving} connected={!!identity} saveError={error} onClearError={() => setError('')}/> : <PrivateDocumentsPanel season={snapshot.settings.season.name}/>}</>}
          {section === 'club' && <>
            <div className="adm-tabs adm-club-tabs" aria-label="Informations du club">{([['presentation','Présentation'],['contact','Coordonnées et horaires'],['season','Saison'],['faq','Questions fréquentes']] as const).map(([key,label]) => <button key={key} aria-pressed={clubTab === key} onClick={() => setClubTab(key)}>{label}</button>)}</div>
            <section className="adm-panel adm-club-preview">{clubTab === 'presentation' ? <><span className="adm-eyebrow">PAGE LE CLUB</span><h2>{snapshot.settings.club.titleLines.join(' ')}</h2>{snapshot.settings.club.paragraphs.map((paragraph,i) => <p key={i}>{paragraph}</p>)}</> : clubTab === 'contact' ? <><h2>{snapshot.settings.contact.venue}</h2><div className="adm-info-grid"><div><h3>Adresse</h3>{snapshot.settings.contact.addressLines.map(line => <p key={line}>{line}</p>)}</div><div><h3>Entraînements</h3><p>{snapshot.settings.contact.trainingDays}</p>{snapshot.settings.contact.hoursLines.map(line => <p key={line}>{line}</p>)}</div><div><h3>Contact</h3><p>{snapshot.settings.contact.email}</p></div></div></> : clubTab === 'season' ? <><h2>Saison {snapshot.settings.season.name}</h2><p>Du {dateText(snapshot.settings.season.startDate)} au {dateText(snapshot.settings.season.endDate)}</p><p>{snapshot.settings.season.agendaNote}</p><MediaImage className="adm-calendar-image" path={snapshot.settings.season.calendarImage} alt="Programme de la saison"/></> : <><h2>Questions fréquentes</h2>{snapshot.settings.faq.map((item,index) => <div className="adm-faq" key={index}><h3>{item.question}</h3><p>{item.answer}</p></div>)}</>}</section>
          </>}
          {section === 'settings' && <div className="adm-settings-grid"><section className="adm-panel"><span className="adm-panel-icon"><LockKeyhole size={23}/></span><h2>{identity ? `Connecté avec ${identity.login}` : 'Votre accès administrateur'}</h2><p>Les contenus sont enregistrés dans le dépôt du club, <strong>Durstyone/Hippocampes</strong>. Votre accès GitHub autorise leur modification.</p>{identity ? <button className="adm-btn adm-btn-subtle" onClick={disconnect}><LogOut size={17}/>Se déconnecter</button> : <button className="adm-btn" onClick={connect}><LockKeyhole size={17}/>Connecter GitHub</button>}<p className="adm-form-note">La connexion reste active dans cet onglet. Elle est effacée à la déconnexion ou au rechargement de la page.</p></section><section className="adm-panel"><span className="adm-panel-icon"><Check size={23}/></span><h2>De l’édition à la publication</h2><ol className="adm-steps"><li>Modifiez un article, une photo ou un rendez-vous.</li><li>Vérifiez le contenu et choisissez « Enregistrer sur GitHub ».</li><li>GitHub construit puis met à jour le site. Le délai est indiqué dans le suivi des publications.</li></ol><a className="adm-text-link" href={`${REPOSITORY}/actions/workflows/pages.yml`} target="_blank" rel="noopener noreferrer">Consulter les publications <ExternalLink size={15}/></a></section><section className="adm-panel"><h2>Les autres accès</h2><p>Pages CMS reste disponible avec sa connexion GitHub habituelle. Vous pouvez y modifier les actualités, les photos, l’agenda et les informations du club.</p><a className="adm-btn adm-btn-subtle" href={CMS} target="_blank" rel="noopener noreferrer">Ouvrir Pages CMS <ExternalLink size={15}/></a><a className="adm-text-link" href={REPOSITORY} target="_blank" rel="noopener noreferrer">Fichiers et historique GitHub <ExternalLink size={15}/></a></section><section className="adm-panel"><h2>Ce que cet espace gère</h2><p>Les contenus publics du site, le suivi des adhérents, les documents privés et les autorisations GitHub des responsables.</p><p className="adm-form-note">Les données des adhérents restent dans le dépôt privé Hippocampes-prive. Les paiements et la comptabilité ne sont pas intégrés. Les accès sont gérés par dépôt, sans restriction par sous-rubrique.</p></section></div>}
        </>)}
        <footer className="adm-footer"><span>Les Hippocampes du Robec · Administration du site</span><a href={PUBLIC_SITE}>Retour au site</a></footer>
      </main>
    </div>
    {editor && <Dialog title={editor.kind === 'news' ? editor.record ? 'Modifier l’actualité' : 'Écrire une actualité' : editor.kind === 'photo' ? editor.record ? 'Modifier la photo' : 'Ajouter à un album' : editor.kind === 'event' ? editor.index === undefined ? 'Créer un événement' : 'Modifier l’événement' : editor.kind === 'featured' ? 'Modifier le récit à la une' : 'Modifier les informations du club'} onClose={closeEditor} busy={saving} footer={<><span className="adm-save-state">{saving ? 'Enregistrement en cours…' : dirty ? 'Modifications non enregistrées' : 'Contenu chargé'}</span><div>{((editor.kind === 'news' || editor.kind === 'photo') && editor.record || (editor.kind === 'event' || editor.kind === 'featured') && editor.index !== undefined) && <button className="adm-icon-btn adm-danger" type="button" aria-label={editor.kind === 'photo' ? 'Retirer de l’album' : 'Supprimer ce contenu'} disabled={saving} onClick={askDelete}><Trash2 size={18}/></button>}<button className="adm-btn adm-btn-subtle" type="button" disabled={saving} onClick={closeEditor}>Annuler</button><button className="adm-btn" type="submit" form="admin-editor" disabled={saving || !dirty}>{saving ? <LoaderCircle size={17} className="adm-spin"/> : <Check size={17}/>}Enregistrer sur GitHub</button></div></>}>
      <form id="admin-editor" onSubmit={saveEditor}><fieldset className="adm-fieldset" disabled={saving}>{!identity && <p className="adm-draft-note"><LockKeyhole size={16}/>Vous pouvez préparer le contenu. La connexion sera demandée pour l’enregistrer.</p>}{error && <div className="adm-error" role="alert">{error}{recoveryAvailable && <p><button className="adm-btn adm-btn-subtle" type="button" onClick={() => void exportAndReload()}>Exporter ma saisie et recharger GitHub</button></p>}</div>}
        {editor.kind === 'news' && <NewsEditor value={editor.value} onChange={value => setEditor({ ...editor, value })} media={namedMedia} onPickImage={() => { setPickerQuery(''); setPickerOpen(true); }}/>}
        {editor.kind === 'photo' && <PhotoEditor value={editor.value} onChange={value => setEditor({ ...editor, value })} media={namedMedia} onPickImage={() => { setPickerQuery(''); setPickerOpen(true); }}/>}
        {editor.kind === 'event' && <EventEditor value={editor.value} onChange={value => setEditor({ ...editor, value })} season={editor.base.settings.season}/>}
        {editor.kind === 'featured' && <FeaturedEditor value={editor.value} onChange={value => setEditor({ ...editor, value })} media={namedMedia}/>}
        {editor.kind === 'club' && <ClubEditor value={editor.value} onChange={value => setEditor({ ...editor, value })} tab={editor.tab}/>}
      </fieldset></form>
    </Dialog>}
    {previewMedia && snapshot && <Dialog title={mediaTitle(previewMedia, snapshot)} onClose={() => setPreviewMedia(null)} footer={<><button className="adm-btn adm-btn-subtle" onClick={() => openEditor({ kind: 'news', value: newNews(previewMedia.path) })}><FilePenLine size={17}/>Utiliser dans une actualité</button><button className="adm-btn" onClick={() => openEditor({ kind: 'photo', value: { ...newPhoto(previewMedia.path), title: mediaTitle(previewMedia, snapshot), alt: mediaTitle(previewMedia, snapshot) } })}><Plus size={17}/>Ajouter à un album</button></>}><MediaImage className="adm-media-preview" path={previewMedia.path} alt={mediaTitle(previewMedia, snapshot)}/><p className="adm-form-note">Cette image est déjà disponible sur le site. Vous pouvez la réutiliser dans une actualité ou l’ajouter à un album.</p></Dialog>}
    {pickerOpen && editor && snapshot && <Dialog title="Choisir une photo" onClose={() => setPickerOpen(false)}><label className="adm-search"><Search size={18}/><input aria-label="Rechercher dans la photothèque" value={pickerQuery} onChange={event => setPickerQuery(event.target.value)} placeholder="Rechercher une photo"/></label><div className="adm-picker-grid">{snapshot.media.filter(asset => mediaTitle(asset, snapshot).toLocaleLowerCase('fr').includes(pickerQuery.toLocaleLowerCase('fr'))).map(asset => <button key={asset.path} type="button" onClick={() => { if (editor.kind === 'news') setEditor({ ...editor, value: { ...editor.value, image: asset.path } }); if (editor.kind === 'photo') setEditor({ ...editor, value: { ...editor.value, image: asset.path } }); setPickerOpen(false); }}><MediaImage path={asset.path}/><span>{mediaTitle(asset, snapshot)}</span></button>)}</div></Dialog>}
    {uploadOpen && <Dialog title="Ajouter des photos" onClose={closeUploads} busy={saving || preparingUpload} footer={<><span className="adm-save-state">{uploads.length ? `${uploads.length} photo${uploads.length > 1 ? 's' : ''} à importer` : 'JPG, PNG, WebP ou GIF · 5 Mo par photo'}</span><div><button className="adm-btn adm-btn-subtle" disabled={saving || preparingUpload} onClick={closeUploads}>Annuler</button><button className="adm-btn" form="admin-upload" type="submit" disabled={!uploads.length || saving || preparingUpload}>{saving ? <LoaderCircle className="adm-spin" size={18}/> : <Upload size={18}/>}Publier les photos</button></div></>}><form id="admin-upload" onSubmit={publishUploads}><fieldset className="adm-fieldset" disabled={saving || preparingUpload}><div className="adm-grid-two"><label className="adm-field">Nom de l’album<input value={uploadAlbum} onChange={event => setUploadAlbum(event.target.value)} placeholder="Ex. Sortie en mer — juin 2027" required maxLength={1000}/></label><label className="adm-field">Date de la sortie<input type="date" value={uploadDate} onChange={event => setUploadDate(event.target.value)}/></label></div><label className="adm-drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!saving && !preparingUpload) void addFiles(event.dataTransfer.files); }}><Upload size={28}/><strong>{preparingUpload ? 'Préparation des images…' : 'Choisir des photos ou les déposer ici'}</strong><span>Jusqu’à 20 photos et 20 Mo par envoi.</span><input type="file" aria-label="Choisir les photos à importer" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={event => { if (event.target.files) void addFiles(event.target.files); event.target.value = ''; }}/></label>{uploadError && <div className="adm-error" role="alert">{uploadError}</div>}<div className="adm-upload-list">{uploads.map(item => <div className="adm-upload-row" key={item.id}><img src={item.preview} alt="Aperçu de la photo à importer"/><div><label className="adm-field">Titre<input required value={item.title} onChange={event => setUploads(uploads.map(photo => photo.id === item.id ? { ...photo, title: event.target.value } : photo))}/></label><label className="adm-field">Description de l’image<input required value={item.alt} onChange={event => setUploads(uploads.map(photo => photo.id === item.id ? { ...photo, alt: event.target.value } : photo))}/></label></div><button type="button" className="adm-icon-btn" aria-label={`Retirer ${item.title}`} onClick={() => { URL.revokeObjectURL(item.preview); setUploads(uploads.filter(photo => photo.id !== item.id)); }}><X size={18}/></button></div>)}</div><p className="adm-form-note">Les photos et leurs légendes seront enregistrées ensemble. Elles apparaîtront dans les albums après la publication du site.</p></fieldset></form></Dialog>}
    {deleteRequest && <Dialog title="Retirer ce contenu du site ?" compact onClose={() => !saving && setDeleteRequest(null)} busy={saving} footer={<><button className="adm-btn adm-btn-subtle" disabled={saving} onClick={() => setDeleteRequest(null)}>Annuler</button><button className="adm-btn adm-btn-danger" disabled={saving} onClick={() => void persist(deleteRequest.changes, `Retirer le contenu : ${deleteRequest.label}`, deleteRequest.base)}>{saving ? <LoaderCircle className="adm-spin" size={17}/> : <Trash2 size={17}/>}Retirer du site</button></>}><p><strong>{deleteRequest.label}</strong></p><p>Le contenu sera retiré à la prochaine publication. L’historique GitHub conserve les versions précédentes. Les fichiers image restent dans la bibliothèque.</p>{error && <div className="adm-error" role="alert">{error}</div>}</Dialog>}
    {connectOpen && <Dialog title="Connecter l’administration à GitHub" compact busy={connecting} onClose={() => { if (!connecting) { setConnectOpen(false); setToken(''); } }} footer={<><span className="adm-form-note">Les autorisations sont vérifiées par GitHub.</span><button className="adm-btn" type="submit" form="admin-connect" disabled={connecting || !token.trim()}>{connecting ? <LoaderCircle size={18} className="adm-spin"/> : <LockKeyhole size={18}/>}Se connecter</button></>}><form id="admin-connect" onSubmit={authenticate}><p>Le propriétaire <strong>Durstyone</strong> peut utiliser un jeton à accès fin limité aux deux dépôts du club. Un responsable invité utilise son propre compte GitHub.</p><label className="adm-field">Clé d’accès GitHub<input type="password" autoComplete="off" spellCheck={false} value={token} onChange={event => setToken(event.target.value)} placeholder="Collez votre jeton personnel GitHub" required disabled={connecting}/></label><p className="adm-form-note">La clé reste en mémoire dans cet onglet et sert uniquement aux échanges avec l’API GitHub. Elle n’est enregistrée ni dans le site ni dans le navigateur.</p>{connectionError && <div className="adm-error" role="alert">{connectionError}</div>}<details className="adm-help-details"><summary>Première connexion : comment obtenir la clé ?</summary><ol><li>Connectez-vous à GitHub avec le compte du club.</li><li>Avec le compte propriétaire Durstyone, créez un jeton « Fine-grained » dans Settings → Developer settings → Personal access tokens.</li><li>Sélectionnez le propriétaire <strong>Durstyone</strong> et les dépôts <strong>Hippocampes</strong> (site) et <strong>Hippocampes-prive</strong> (dossiers privés).</li><li>Accordez la permission de dépôt <strong>Contents: Read and write</strong>, puis copiez le jeton ici.</li></ol><p><strong>Vous êtes collaborateur invité :</strong> acceptez d’abord l’invitation GitHub. Les dépôts personnels d’un autre utilisateur nécessitent un jeton classique : <code>public_repo</code> pour le site seul, <code>repo</code> pour les dossiers privés. Ce dernier peut aussi autoriser vos autres dépôts privés ; choisissez une expiration courte et révoquez-le après usage.</p><a href={TOKEN_HELP} target="_blank" rel="noopener noreferrer">Ouvrir le guide GitHub <ExternalLink size={14}/></a></details><div className="adm-connect-alternative"><strong>Vous préférez la connexion GitHub habituelle ?</strong><p>Pages CMS reste disponible pour les actualités, les photos et les informations du site.</p><a href={CMS} target="_blank" rel="noopener noreferrer">Ouvrir Pages CMS <ExternalLink size={14}/></a></div></form></Dialog>}
  </div>;
}
