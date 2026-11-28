'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, FolderOpen, Image as ImageIcon, Info, Search, SlidersHorizontal, Waves, X, ZoomIn } from 'lucide-react';
import './archives.css';
import { localSitePath, mediaUrl, siteUrl } from '../../lib/site-delivery';

import { PublicHeader, PublicFooter } from "../site/PublicLayout";
import PublishedAlbums from "../site/PublishedAlbums";
import "../site/apnea-home.css";

export type ArchiveKind = 'article' | 'page' | 'album';
export interface ArchiveSummary {
  id: string;
  title: string;
  kind: ArchiveKind;
  date?: string;
  updatedAt?: string;
  author?: string;
  categories: string[];
  excerpt: string;
  cover?: string;
  imageCount: number;
  attachmentCount: number;
  sourceUrl: string;
  searchText?: string;
}
export interface ArchiveImage { src: string; alt: string; caption?: string; thumbnailUrl?: string; status?: 'local' | 'external' | 'unavailable'; originalSrc?: string; width?: number; height?: number; role?: 'photo' | 'document'; relatedHref?: string }
export interface ArchiveAttachment { href: string; label: string; status: 'local' | 'external' | 'unavailable'; mimeType?: string }
export interface ArchiveEntry extends ArchiveSummary {
  html: string;
  images: ArchiveImage[];
  attachments: ArchiveAttachment[];
  warnings: string[];
}
interface ArchiveIndex {
  version: number;
  generatedAt: string;
  source: string;
  entries: ArchiveSummary[];
  stats: { articles: number; pages: number; albums: number; images: number; documents: number };
  coverage?: { complete: boolean; articlesInSourceSitemap?: number; importedArticles?: number; unresolvedContentUrls?: number };
}
type Filters = { q: string; type: 'all' | ArchiveKind; year: string; category: string; page: number; sort: 'newest' | 'oldest' };
type ReaderEntry = ArchiveEntry & { safeHtml: string; galleryImages: ArchiveImage[]; sourceImages: ArchiveImage[]; mediaWarnings: string[]; albumIntro: string };
const PAGE_SIZE = 18;
const PHOTOS_PER_PAGE = 12;
const DEFAULT_FILTERS: Filters = { q: '', type: 'all', year: '', category: '', page: 1, sort: 'newest' };
const KINDS: Array<{ value: Filters['type']; label: string; icon: typeof BookOpen }> = [
  { value: 'all', label: 'Tout le carnet', icon: FolderOpen },
  { value: 'article', label: 'Articles', icon: BookOpen },
  { value: 'page', label: 'Le club & documents', icon: FileText },
  { value: 'album', label: 'Albums photos', icon: ImageIcon },
];
const KIND_NAMES: Record<ArchiveKind, string> = { article: 'Article', page: 'Le club & documents', album: 'Album photo' };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/\s+/g, ' ').trim();
const albumYear = (entry: ArchiveSummary) => entry.kind === 'album' ? entry.title.match(/(?:19|20)\d{2}(?!\d)/)?.[0] || '' : '';
const yearOf = (entry: ArchiveSummary) => /^\d{4}/.test(entry.date || '') ? entry.date!.slice(0, 4) : albumYear(entry);
const plural = (count: number, singular: string, multiple = singular + 's') => `${count.toLocaleString('fr-FR')} ${count === 1 ? singular : multiple}`;

function displayTitle(entry: ArchiveSummary) {
  if (entry.kind !== 'album') return entry.title;
  const year = albumYear(entry);
  const title = entry.title.replace(/^album\s*[-–—:]?\s*/i, '').replace(year || /$^/, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\bNemo\b/gi, 'Némo').replace(/\bEte\b/gi, 'Été').replace(/\bMedailles\b/gi, 'Médailles');
  return (title || 'Les photos du club') + (year ? ' · ' + year : '');
}

function displayExcerpt(entry: ArchiveSummary) {
  return entry.kind === 'album' && /^\d+\s+image\(s\)\s+publi/i.test(entry.excerpt) ? '' : entry.excerpt;
}

function isDocumentImage(image: ArchiveImage) {
  return image.role === 'document' || image.src.includes('/0b5029b91de07bd7084c2fc5.jpg');
}

function isDecorativeImage(image: ArchiveImage) {
  return /\/smiles\/|\/buddyicons\/|finway-logo-|\/boite\.jpg/i.test(image.originalSrc || image.src) || Boolean(image.width && image.height && image.width <= 32 && image.height <= 32);
}

function photoCaption(image: ArchiveImage, entry: ArchiveEntry, images: ArchiveImage[]) {
  if (image.caption) return image.caption;
  const alt = (image.alt || '').trim();
  if (!alt || normalize(alt) === normalize(entry.title) || /^(?:image|img|photo|dsc)[-_ ]?\d+(?:\.[a-z]+)?$/i.test(alt)) return '';
  return images.filter(item => item.alt === image.alt).length === 1 ? alt : '';
}

function displayDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return '';
  const parsed = new Date(value.slice(0, 10) + 'T12:00:00Z');
  return Number.isNaN(parsed.valueOf()) ? '' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(parsed);
}

function readFilters(): Filters {
  const query = new URLSearchParams(window.location.search);
  const type = query.get('type');
  const page = Number(query.get('page') || 1);
  const year = query.get('year') || '';
  return {
    q: (query.get('q') || '').slice(0, 300),
    type: type === 'article' || type === 'page' || type === 'album' ? type : 'all',
    year: /^\d{4}$/.test(year) ? year : '',
    category: (query.get('category') || '').slice(0, 150),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    sort: query.get('sort') === 'oldest' ? 'oldest' : 'newest',
  };
}

function filterQuery(filters: Filters) {
  const query = new URLSearchParams();
  if (filters.type !== 'all') query.set('type', filters.type);
  if (filters.q) query.set('q', filters.q);
  if (filters.year) query.set('year', filters.year);
  if (filters.category) query.set('category', filters.category);
  if (filters.sort !== 'newest') query.set('sort', filters.sort);
  if (filters.page > 1) query.set('page', String(filters.page));
  return query.size ? '?' + query.toString() : '';
}

function entryHref(id: string, filters?: Filters) { return siteUrl('/archives/' + encodeURIComponent(id) + (filters ? filterQuery(filters) : '')); }

/** A second, browser-side boundary for the already-cleaned imported content. */
function safeUrl(value: string | undefined, image = false) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!image && trimmed.startsWith('#')) return trimmed;
  if (/^[\u0000-\u0020]*$/.test(trimmed)) return '';
  try {
    const url = new URL(trimmed, window.location.origin);
    const allowed = image ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:', 'tel:'];
    if (!allowed.includes(url.protocol) || url.username || url.password) return '';
    if (url.origin === window.location.origin) {
      const local = localSitePath(url.pathname + url.search + url.hash);
      return image ? local : mediaUrl(local);
    }
    return url.href;
  } catch { return ''; }
}

function copiedImageUrl(value: string | undefined, status?: ArchiveImage['status']) {
  if (status === 'unavailable') return '';
  const url = safeUrl(value, true);
  if (url.startsWith('/media/archive/')) return mediaUrl(url);
  if (status === 'local' && url.startsWith('/') && !url.startsWith('//')) return mediaUrl(url);
  return '';
}

function prepareEntry(entry: ArchiveEntry): ReaderEntry {
  // Template content stays inert while remote media URLs are removed.
  const template = window.document.createElement('template');
  template.innerHTML = entry.html || '';
  const body = template.content;
  const allowedTags = new Set(['P', 'BR', 'DIV', 'SECTION', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'STRIKE', 'DEL', 'INS', 'SMALL', 'SUB', 'SUP', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'IMG', 'A', 'TABLE', 'COLGROUP', 'COL', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION', 'HR', 'PRE', 'CODE', 'TIME', 'DETAILS', 'SUMMARY', 'DL', 'DT', 'DD']);
  const removeTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SVG', 'MATH', 'META', 'LINK', 'BASE', 'TEMPLATE']);
  for (const element of Array.from(body.querySelectorAll('*'))) {
    if (removeTags.has(element.tagName)) { element.remove(); continue; }
    if (!allowedTags.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const keep = name === 'id' || name === 'title' || name === 'class' || (element.tagName === 'A' && name === 'href') || (element.tagName === 'IMG' && ['src', 'alt', 'width', 'height'].includes(name)) || (['TD', 'TH'].includes(element.tagName) && ['colspan', 'rowspan', 'scope'].includes(name)) || (['COL', 'COLGROUP'].includes(element.tagName) && name === 'span') || (element.tagName === 'OL' && ['start', 'type', 'reversed'].includes(name)) || (element.tagName === 'LI' && name === 'value') || (element.tagName === 'TIME' && name === 'datetime');
      if (!keep) element.removeAttribute(attribute.name);
      if (name === 'class') {
        const names = attribute.value.split(/\s+/).filter(value => value === 'archive-unavailable');
        if (names.length) element.setAttribute('class', names.join(' '));
        else element.removeAttribute('class');
      }
    }
    if (element.tagName === 'H1') {
      const heading = window.document.createElement('h2');
      if (element.id) heading.id = element.id;
      for (const child of Array.from(element.childNodes)) heading.appendChild(child);
      element.replaceWith(heading);
    }
    if (element.tagName === 'A') {
      const href = safeUrl(element.getAttribute('href') || '');
      if (!href) element.removeAttribute('href');
      else {
        element.setAttribute('href', href);
        if (/^https?:/i.test(href)) { element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer'); }
      }
    }
  }
  const galleryImages: ArchiveImage[] = [];
  const sourceImages: ArchiveImage[] = [];
  const photoTables = Array.from(body.querySelectorAll('table')).filter(table => table.querySelector('img, .archive-unavailable') && !table.querySelector('th'));
  const addSourceImage = (image: ArchiveImage) => {
    const original = safeUrl(image.originalSrc || image.src, true);
    if (!original || sourceImages.some(item => item.src === original)) return;
    sourceImages.push({ ...image, src: original, originalSrc: original, alt: image.alt || entry.title });
  };
  const knownImages = new Map<string, ArchiveImage>();
  for (const image of entry.images || []) {
    for (const url of [image.src, image.originalSrc, image.thumbnailUrl]) {
      const normalized = safeUrl(url, true);
      if (normalized) { knownImages.set(normalized, image); knownImages.set(mediaUrl(normalized), image); }
    }
  }
  const addImage = (image: ArchiveImage) => {
    if (isDocumentImage(image) || isDecorativeImage(image)) return -1;
    const src = copiedImageUrl(image.src, image.status);
    if (!src) return -1;
    const existing = galleryImages.findIndex(item => item.src === src || item.thumbnailUrl === src);
    if (existing !== -1) return existing;
    galleryImages.push({ ...image, src, thumbnailUrl: copiedImageUrl(image.thumbnailUrl, image.status) || undefined, alt: image.alt || entry.title });
    return galleryImages.length - 1;
  };
  for (const item of entry.images || []) {
    if (!copiedImageUrl(item.src, item.status)) addSourceImage(item);
    else addImage(item);
  }
  // Images linked to a document or a website keep a visible, readable link.
  // Flickr photo links belong with their photo in the lightbox.
  const removeInlineImage = (image: Element, metadata?: ArchiveImage, galleryPosition = -1) => {
    const parentLink = image.closest('a');
    const href = parentLink?.getAttribute('href') || '';
    const pointsToImage = knownImages.has(href) || /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(href);
    if (parentLink && href && !pointsToImage && !parentLink.textContent?.trim()) {
      if (galleryPosition >= 0 && /^https?:\/\/(?:www\.)?flickr\.com\/.*\/\d+\//i.test(href)) {
        galleryImages[galleryPosition].relatedHref = href;
      } else if (Array.from(body.querySelectorAll('a[href]')).some(link => link !== parentLink && link.getAttribute('href') === href && link.textContent?.trim())) {
        // The same destination already has a text link in this content.
        image.remove();
        return;
      } else {
        const alt = (image.getAttribute('alt') || metadata?.alt || '').trim();
        const label = /\.pdf(?:[?#]|$)/i.test(href) ? 'Consulter le document PDF' : alt && normalize(alt) !== normalize(entry.title) ? alt : 'Consulter le lien associé';
        image.replaceWith(window.document.createTextNode(label));
        return;
      }
    }
    image.remove();
  };
  for (const image of Array.from(body.querySelectorAll('img'))) {
    const source = safeUrl(image.getAttribute('src') || '', true);
    const metadata = knownImages.get(source);
    const src = copiedImageUrl(source, metadata?.status) || (metadata ? copiedImageUrl(metadata.src, metadata.status) : '');
    if (!src) {
      addSourceImage({ ...metadata, src: source, alt: metadata?.alt || image.getAttribute('alt') || entry.title });
      removeInlineImage(image, metadata);
      continue;
    }
    if (metadata && isDocumentImage(metadata)) {
      image.setAttribute('src', src);
      image.setAttribute('loading', 'lazy');
      image.setAttribute('decoding', 'async');
      image.setAttribute('alt', metadata.alt || 'Document du club');
      image.classList.add('archive-document-image');
      image.removeAttribute('width');
      image.removeAttribute('height');
      const parentLink = image.closest('a');
      if (!parentLink) {
        const link = window.document.createElement('a');
        link.href = src; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', (metadata.alt || 'Document du club') + ' — ouvrir en taille réelle');
        image.replaceWith(link); link.appendChild(image);
      }
      continue;
    }
    const position = addImage({ ...metadata, src: metadata?.src || source, status: metadata?.status || 'local', alt: image.getAttribute('alt') || metadata?.alt || entry.title });
    const caption = image.closest('figure')?.querySelector('figcaption');
    if (position >= 0 && caption?.textContent?.trim()) galleryImages[position].caption ||= caption.textContent.trim();
    // Captions remain in the text as well; no prose is inferred or discarded.
    removeInlineImage(image, metadata, position);
  }
  for (const block of Array.from(body.querySelectorAll('.archive-unavailable'))) {
    const links = [...(block.matches('a[href]') ? [block] : []), ...Array.from(block.querySelectorAll('a[href]'))];
    for (const link of links) {
      const href = safeUrl(link.getAttribute('href') || '', true);
      const metadata = knownImages.get(href);
      if (metadata && copiedImageUrl(metadata.src, metadata.status)) continue;
      addSourceImage(metadata || { src: href, alt: link.textContent?.trim() || entry.title });
    }
    // Some old image buttons wrap the unavailable-image notice.
    const parentLink = block.parentElement?.closest('a');
    const parentHref = parentLink?.getAttribute('href') || '';
    if (parentLink && parentHref && !knownImages.has(parentHref) && !/\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(parentHref)) {
      block.replaceWith(window.document.createTextNode('Consulter le lien associé'));
    } else block.remove();
  }
  // Old photo tables are layout, not tabular data. Keep their text and links
  // in reading order, without leaving empty cells or nested frames behind.
  for (const table of photoTables.reverse()) {
    if (!body.contains(table) || table.querySelector('.archive-document-image')) continue;
    const replacement = window.document.createElement('div');
    replacement.className = 'archive-photo-context';
    for (const cell of Array.from(table.querySelectorAll('caption, td')).filter(cell => cell.closest('table') === table)) {
      const paragraph = window.document.createElement('div');
      for (const child of Array.from(cell.childNodes)) paragraph.appendChild(child);
      replacement.appendChild(paragraph);
    }
    table.replaceWith(replacement);
  }
  for (const element of Array.from(body.querySelectorAll('a, p, div, section, figure, figcaption, span, strong, em, table, tr')).reverse()) {
    if (!element.textContent?.trim() && !element.querySelector('img, hr')) element.remove();
  }
  // Blank runs from the original editor must not become large empty gaps.
  for (const lineBreak of Array.from(body.querySelectorAll('br'))) {
    const previous = lineBreak.previousSibling;
    if (!previous || previous.nodeName === 'BR' || (previous.nodeType === 3 && !previous.textContent?.trim() && (!previous.previousSibling || previous.previousSibling.nodeName === 'BR'))) lineBreak.remove();
  }
  const originalWarnings = Array.isArray(entry.warnings) ? entry.warnings : [];
  const isMediaWarning = (warning: string) => /^(?:\d+ image\(s\)|une image sans adresse)/i.test(warning);
  return {
    ...entry,
    warnings: originalWarnings.filter(warning => !isMediaWarning(warning)),
    mediaWarnings: originalWarnings.filter(isMediaWarning),
    albumIntro: entry.kind === 'album' && displayExcerpt(entry) && !normalize(body.textContent || '').includes(normalize(displayExcerpt(entry))) ? displayExcerpt(entry) : '',
    attachments: (entry.attachments || []).map(item => ({ ...item, href: safeUrl(item.href) })).filter(item => item.href || item.status === 'unavailable'),
    safeHtml: template.innerHTML,
    galleryImages,
    sourceImages,
  };
}

function ArchiveHeader() {
  return <PublicHeader current="archives" />;
}

function ArchiveFooter() {
  return <PublicFooter />;
}

function Loading({ detail = false }: { detail?: boolean }) {
  return <div className="archive-loading" role="status"><span className="archive-loading-icon"><Waves size={28}/></span><strong>{detail ? 'Ouverture du récit…' : 'Le carnet s’ouvre…'}</strong><p>Les souvenirs du club arrivent.</p></div>;
}

function ErrorState({ message, retry, back }: { message: string; retry: () => void; back?: string }) {
  return <div className="archive-empty" role="alert"><Info size={32}/><h2>Ce contenu n’a pas pu être chargé.</h2><p>{message}</p><div className="archive-empty-actions"><button className="archive-button archive-button-primary" onClick={retry}>Réessayer</button>{back && <a className="archive-button" href={back}>Revenir au carnet</a>}</div></div>;
}

export default function ArchiveHub({ initialId }: { initialId?: string }) {
  const [index, setIndex] = useState<ArchiveIndex | null>(null);
  const [indexError, setIndexError] = useState('');
  const [indexAttempt, setIndexAttempt] = useState(0);
  const [entryId, setEntryId] = useState(initialId || '');
  const [entry, setEntry] = useState<ReaderEntry | null>(null);
  const [entryError, setEntryError] = useState('');
  const [entryAttempt, setEntryAttempt] = useState(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [ready, setReady] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [galleryLimit, setGalleryLimit] = useState(PHOTOS_PER_PAGE);
  const galleryRef = useRef<HTMLDialogElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function syncLocation() {
      setFilters(readFilters());
      const match = localSitePath(window.location.pathname).match(/^\/archives\/([^/]+)\/?$/);
      try { setEntryId(match ? decodeURIComponent(match[1]) : ''); }
      catch { setEntryId('invalid-entry'); }
      setReady(true);
    }
    syncLocation();
    window.addEventListener('popstate', syncLocation);
    return () => window.removeEventListener('popstate', syncLocation);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIndexError('');
    fetch(siteUrl('/content/archive-index.json'), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Le catalogue est momentanément indisponible.');
        const result = await response.json() as Partial<ArchiveIndex> | null;
        if (!result || !Array.isArray(result.entries)) throw new Error('Le catalogue reçu est incomplet.');
        setIndex(result as ArchiveIndex);
      })
      .catch(error => { if (error.name !== 'AbortError') setIndexError(error.message || 'Vérifiez votre connexion puis réessayez.'); });
    return () => controller.abort();
  }, [indexAttempt]);

  useEffect(() => {
    if (!entryId) { setEntry(null); setEntryError(''); return; }
    const controller = new AbortController();
    setEntry(null); setEntryError(''); setGalleryIndex(null); setGalleryLimit(PHOTOS_PER_PAGE);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(entryId)) { setEntryError('L’adresse de cette page est invalide.'); return; }
    fetch(siteUrl('/content/entries/' + encodeURIComponent(entryId) + '.json'), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? 'Cette page n’existe pas dans le carnet. Vous pouvez la rechercher dans les archives.' : 'La page est momentanément indisponible.');
        const result = await response.json() as Partial<ArchiveEntry> | null;
        if (!result || typeof result.html !== 'string' || !result.title) throw new Error('Le contenu reçu est incomplet.');
        setEntry(prepareEntry(result as ArchiveEntry));
      })
      .catch(error => { if (error.name !== 'AbortError') setEntryError(error.message || 'Vérifiez votre connexion puis réessayez.'); });
    return () => controller.abort();
  }, [entryId, entryAttempt]);

  useEffect(() => {
    const original = document.title;
    document.title = (entry ? displayTitle(entry) : entryId ? 'Le carnet' : 'Le carnet du club') + ' — Les Hippocampes du Robec';
    return () => { document.title = original; };
  }, [entry?.title, entryId]);

  useEffect(() => {
    if (galleryIndex !== null) galleryRef.current?.showModal();
    else galleryRef.current?.close();
  }, [galleryIndex]);

  useEffect(() => {
    if (galleryIndex === null) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [galleryIndex]);

  const entries = index?.entries || [];
  const years = useMemo(() => [...new Set(entries.map(yearOf).filter(Boolean))].sort().reverse(), [entries]);
  const categories = useMemo(() => [...new Set(entries.flatMap(item => item.categories || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [entries]);
  const searchable = useMemo(() => entries.map(item => ({ item, text: normalize([item.title, item.excerpt, item.author || '', ...(item.categories || []), item.searchText || ''].join(' ')) })), [entries]);
  const filtered = useMemo(() => {
    const words = normalize(filters.q).split(' ').filter(Boolean);
    return searchable.filter(({ item, text }) => (filters.type === 'all' || item.kind === filters.type) && (!filters.year || yearOf(item) === filters.year) && (!filters.category || (item.categories || []).includes(filters.category)) && words.every(word => text.includes(word))).map(({ item }) => item).sort((a, b) => {
      const first = a.date || yearOf(a); const second = b.date || yearOf(b);
      if (!first && second) return 1;
      if (first && !second) return -1;
      return (filters.sort === 'oldest' ? first.localeCompare(second) : second.localeCompare(first)) || a.title.localeCompare(b.title, 'fr');
    });
  }, [searchable, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilters = Boolean(filters.q || filters.type !== 'all' || filters.year || filters.category || filters.sort !== 'newest');
  const backHref = siteUrl('/archives' + filterQuery(filters));
  const galleryImages = entry?.galleryImages || [];
  const currentImage = galleryIndex === null ? null : galleryImages[galleryIndex];

  function updateFilters(changes: Partial<Filters>, replace = false) {
    const next = { ...filters, ...changes, page: changes.page ?? 1 };
    setFilters(next);
    window.history[replace ? 'replaceState' : 'pushState']({}, '', siteUrl('/archives' + filterQuery(next)));
  }

  function resetFilters() { updateFilters(DEFAULT_FILTERS); }
  function goToPage(next: number) {
    updateFilters({ page: next });
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function movePhoto(direction: number) { setGalleryIndex(value => value === null || galleryImages.length === 0 ? null : (value + direction + galleryImages.length) % galleryImages.length); }
  const isTeamPage = entry?.kind === 'page' && /equipe|comite|bureau|encadrant/.test(normalize(entry.title));
  const relevantEntries = entry ? entries.filter(item => item.id !== entry.id && item.kind === entry.kind && item.categories?.some(category => entry.categories?.includes(category))).sort((a, b) => (b.date || yearOf(b)).localeCompare(a.date || yearOf(a))).slice(0, 3) : [];

  return <div className="archive-page apnea-archives">
    <a href="#archive-content" className="archive-skip">Aller au contenu</a>
    <ArchiveHeader/>
    <main id="archive-content">
      {!entryId ? <>
        <section className="archive-hero"><div className="archive-container"><div className="archive-hero-copy"><div className="archive-eyebrow"><Waves size={20}/> LES ARCHIVES DU CLUB</div><h1>La mémoire<br/><span>de nos immersions.</span></h1><p>Un carnet que l’on feuillette au fil des années.<br className="archive-desktop-break"/> Retrouvez les récits, les albums et les documents des Hippocampes.</p></div><div className="archive-hero-summary"><BookOpen size={32}/><p>Nos souvenirs,<br/><strong>à portée de main.</strong></p>{index && <span>{plural(index.stats?.articles ?? entries.filter(item => item.kind === 'article').length, 'article')} · {plural(index.stats?.albums ?? entries.filter(item => item.kind === 'album').length, 'album')}</span>}</div></div></section>
        <section className="archive-container archive-catalogue" aria-label="Rechercher dans le carnet">
          {(filters.type === 'all' || filters.type === 'album') && !filters.q && !filters.year && !filters.category && filters.page === 1 && <div className="site-page apnea-published-albums"><PublishedAlbums/></div>}
          {index?.coverage?.complete !== true && <aside className="archive-collection-note"><Info size={18}/><p>Cette collection réunit les contenus déjà repris du blog. D’autres archives restent consultables sur le <a href="https://les-hippocampes-du-robec.over-blog.com/" target="_blank" rel="noopener noreferrer">blog d’origine</a>.</p></aside>}
          <div className="archive-search"><Search size={22}/><label htmlFor="archive-search" className="archive-sr-only">Rechercher dans les titres et les textes</label><input id="archive-search" type="search" value={filters.q} onChange={event => updateFilters({ q: event.target.value }, true)} placeholder="Un voyage, une sortie, un document…" autoComplete="off"/><span className="archive-search-hint">Rechercher dans le carnet</span></div>
          <div className="archive-kind-tabs" role="group" aria-label="Type de contenu">{KINDS.map(kind => <button key={kind.value} className={filters.type === kind.value ? 'is-active' : ''} onClick={() => updateFilters({ type: kind.value })} aria-pressed={filters.type === kind.value}><kind.icon size={18}/>{kind.label}<span>{kind.value === 'all' ? entries.length : entries.filter(item => item.kind === kind.value).length}</span></button>)}</div>
          <div className="archive-filter-row"><span className="archive-filter-intro"><SlidersHorizontal size={17}/>Affiner</span><label className="archive-select"><span className="archive-sr-only">Année de publication</span><select value={filters.year} onChange={event => updateFilters({ year: event.target.value })}><option value="">Toutes les années</option>{years.map(year => <option key={year}>{year}</option>)}</select><ChevronDown size={16}/></label><label className="archive-select archive-category-select"><span className="archive-sr-only">Catégorie</span><select value={filters.category} onChange={event => updateFilters({ category: event.target.value })}><option value="">Toutes les catégories</option>{categories.map(category => <option key={category}>{category}</option>)}</select><ChevronDown size={16}/></label><label className="archive-select archive-sort-select"><span className="archive-sr-only">Ordre des résultats</span><select value={filters.sort} onChange={event => updateFilters({ sort: event.target.value === 'oldest' ? 'oldest' : 'newest' })}><option value="newest">Les plus récents</option><option value="oldest">Les plus anciens</option></select><ChevronDown size={16}/></label></div>
          <div className="archive-results-heading" ref={resultsRef}><p aria-live="polite">{index && ready ? <><strong>{filtered.length.toLocaleString('fr-FR')}</strong> {filtered.length === 1 ? 'contenu à découvrir' : 'contenus à découvrir'}{filters.q && <span> pour « {filters.q} »</span>}</> : 'Chargement du carnet…'}</p>{activeFilters && <button onClick={resetFilters}><X size={15}/>Effacer les filtres</button>}</div>
          {indexError ? <ErrorState message={indexError} retry={() => setIndexAttempt(value => value + 1)}/> : !index || !ready ? <Loading/> : filtered.length === 0 ? <div className="archive-empty"><Search size={34}/><h2>Aucun souvenir ne correspond à cette recherche.</h2><p>Essayez un autre mot, une autre année ou retirez les filtres.</p><button className="archive-button archive-button-primary" onClick={resetFilters}>Voir tout le carnet</button></div> : <>
            <div className="archive-card-grid">{pageEntries.map(item => <ArchiveCard key={item.id} entry={item} href={entryHref(item.id, { ...filters, page })}/>)}</div>
            {totalPages > 1 && <nav className="archive-pagination" aria-label="Pagination des résultats"><button aria-label="Page précédente" disabled={page === 1} onClick={() => goToPage(page - 1)}><ChevronLeft size={18}/><span>Précédente</span></button><div>{paginationNumbers(page, totalPages).map((value, i) => value === 'dots' ? <span className="archive-pagination-dots" key={'dots-' + i}>…</span> : <button key={value} aria-label={'Page ' + value} aria-current={page === value ? 'page' : undefined} onClick={() => goToPage(value)}>{value}</button>)}</div><button aria-label="Page suivante" disabled={page === totalPages} onClick={() => goToPage(page + 1)}><span>Suivante</span><ChevronRight size={18}/></button></nav>}
          </>}
        </section>
      </> : <div className="archive-container archive-reader-shell">
        <nav className="archive-breadcrumbs" aria-label="Fil d’Ariane"><a href={siteUrl("/")}>Accueil</a><ChevronRight size={14}/><a href={backHref}>Le carnet</a>{entry && <><ChevronRight size={14}/><span>{KIND_NAMES[entry.kind]}</span></>}</nav>
        {entryError ? <ErrorState message={entryError} retry={() => setEntryAttempt(value => value + 1)} back={backHref}/> : !entry ? <Loading detail/> : <>
          <article className="archive-reader">
            <header className="archive-reader-heading"><div className="archive-entry-labels"><span className={'archive-kind-label kind-' + entry.kind}>{entry.kind === 'album' ? <ImageIcon size={15}/> : entry.kind === 'page' ? <FileText size={15}/> : <BookOpen size={15}/>} {KIND_NAMES[entry.kind]}</span>{entry.kind !== 'album' && entry.categories?.map(category => <a key={category} href={siteUrl('/archives?category=' + encodeURIComponent(category))}>{category}</a>)}</div><h1>{displayTitle(entry)}</h1>{(displayDate(entry.date) || entry.author) && <div className="archive-entry-meta">{displayDate(entry.date) && <span><CalendarDays size={16}/><time dateTime={entry.date}>{displayDate(entry.date)}</time></span>}{entry.author && <span>Publié par {entry.author}</span>}</div>}</header>
            {isTeamPage && <aside className="archive-reader-note"><Info size={20}/><p>Cette page reprend l’équipe présentée sur le blog d’origine. Les fonctions et les coordonnées actuelles sont à confirmer auprès du club.</p></aside>}
            {entry.warnings.length > 0 && <aside className="archive-reader-note"><Info size={20}/><div>{entry.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div></aside>}
            {entry.albumIntro && <p className="archive-album-intro">{entry.albumIntro}</p>}
            {entry.safeHtml && <div className="archive-body" dangerouslySetInnerHTML={{ __html: entry.safeHtml }}/>}
            {galleryImages.length > 0 && <section className="archive-photo-section" aria-labelledby="archive-photos-heading"><div className="archive-reader-section-heading"><h2 id="archive-photos-heading">Les photos</h2><span>{plural(galleryImages.length, 'photo')}</span></div><div className="archive-photo-grid">{galleryImages.slice(0, galleryLimit).map((image, i) => <button key={image.src + i} onClick={() => setGalleryIndex(i)} aria-label={'Ouvrir la photo ' + (i + 1) + ' sur ' + galleryImages.length + ' : ' + image.alt}><img src={image.thumbnailUrl || image.src} alt={image.alt} loading="lazy" decoding="async"/><span aria-hidden="true"><ZoomIn size={18}/></span></button>)}</div>{galleryImages.length > PHOTOS_PER_PAGE && <div className="archive-gallery-progress"><p aria-live="polite">{Math.min(galleryLimit, galleryImages.length)} photos affichées sur {galleryImages.length}</p>{galleryImages.length > galleryLimit && <button className="archive-button archive-more-photos" onClick={() => setGalleryLimit(value => value + PHOTOS_PER_PAGE)}>Voir la suite <ChevronDown size={17}/></button>}</div>}</section>}
            {(entry.sourceImages.length > 0 || entry.mediaWarnings.length > 0) && <details className="archive-photo-sources"><summary>{entry.sourceImages.length > 0 ? plural(entry.sourceImages.length, 'image') + ' à consulter à la source' : 'Une image n’a pas de copie sur ce site'}</summary><div><p>{entry.sourceImages.length ? 'Ces images n’ont pas encore pu être reprises ici. Vous pouvez ouvrir leurs liens d’origine.' : 'Cette image n’a pas encore pu être reprise ici.'}</p>{entry.sourceImages.length > 0 ? <ol>{entry.sourceImages.map((image, i) => <li key={image.src}><a href={image.originalSrc || image.src} target="_blank" rel="noopener noreferrer">Image {i + 1}{photoCaption(image, entry, entry.sourceImages) && <span> — {photoCaption(image, entry, entry.sourceImages)}</span>}<ExternalLink size={13}/></a></li>)}</ol> : entry.mediaWarnings.map((warning, i) => <p key={i}>{warning}</p>)}</div></details>}
            {entry.attachments.length > 0 && <section className="archive-attachments"><div className="archive-reader-section-heading"><h2>Les documents.</h2><span>{plural(entry.attachments.length, 'pièce jointe')}</span></div><div>{entry.attachments.map((attachment, i) => attachment.status === 'unavailable' ? <div key={attachment.href + i} className="archive-attachment archive-attachment-unavailable"><FileText size={23}/><span><strong>{attachment.label || 'Document'}</strong><small>La copie de ce document n’a pas pu être récupérée.</small>{attachment.href && <a href={attachment.href} target="_blank" rel="noopener noreferrer">Ouvrir le lien d’origine</a>}</span></div> : <a key={attachment.href + i} className="archive-attachment" href={attachment.href} target="_blank" rel="noopener noreferrer"><FileText size={23}/><span><strong>{attachment.label || 'Consulter le document'}</strong><small>{attachment.status === 'local' ? 'Ouvrir le document' : 'Ouvrir la ressource d’origine'}</small></span>{attachment.status === 'local' ? <Download size={19}/> : <ExternalLink size={18}/>}</a>)}</div></section>}
            <footer className="archive-reader-source"><div><span>Un contenu du blog des Hippocampes</span>{entry.kind !== 'page' && <p>Les dates et les informations sont celles de la publication d’origine.</p>}{entry.updatedAt && displayDate(entry.updatedAt) !== displayDate(entry.date) && <p>Dernière mise à jour sur le blog : {displayDate(entry.updatedAt)}.</p>}</div>{safeUrl(entry.sourceUrl) && <a href={safeUrl(entry.sourceUrl)} target="_blank" rel="noopener noreferrer">Voir la publication d’origine <ExternalLink size={15}/></a>}</footer>
          </article>
          <div className="archive-reader-back"><a className="archive-button" href={backHref}><BookOpen size={18}/>Revenir au carnet</a><a href={siteUrl("/#contact")}>Une question ? Contactez le club</a></div>
          {relevantEntries.length > 0 && <section className="archive-related"><div className="archive-reader-section-heading"><h2>À découvrir aussi.</h2></div><div className="archive-card-grid">{relevantEntries.map(item => <ArchiveCard key={item.id} entry={item} href={entryHref(item.id)}/>)}</div></section>}
        </>}
      </div>}
    </main>
    <ArchiveFooter/>
    <dialog ref={galleryRef} className="archive-lightbox" onCancel={() => setGalleryIndex(null)} onClose={() => setGalleryIndex(null)} onClick={event => { if (event.target === event.currentTarget) setGalleryIndex(null); }} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); movePhoto(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); movePhoto(-1); } }} aria-label="Galerie de photos">
      {currentImage && entry && <><button className="archive-lightbox-close" onClick={() => setGalleryIndex(null)} aria-label="Fermer la photo"><X size={23}/></button><div className="archive-lightbox-image"><img src={currentImage.src} alt={currentImage.alt}/></div><div className="archive-lightbox-footer"><button onClick={() => movePhoto(-1)} aria-label="Photo précédente" disabled={galleryImages.length < 2}><ChevronLeft size={23}/></button><div aria-live="polite"><p>{photoCaption(currentImage, entry, galleryImages) || displayTitle(entry)}</p><span>{galleryIndex! + 1} / {galleryImages.length}</span>{currentImage.relatedHref && <a href={currentImage.relatedHref} target="_blank" rel="noopener noreferrer">Voir la photo sur Flickr <ExternalLink size={13}/></a>}</div><button onClick={() => movePhoto(1)} aria-label="Photo suivante" disabled={galleryImages.length < 2}><ChevronRight size={23}/></button></div></>}
    </dialog>
  </div>;
}

function ArchiveCard({ entry, href }: { entry: ArchiveSummary; href: string }) {
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [fallbackImages, setFallbackImages] = useState<string[] | null>(null);
  const Icon = entry.kind === 'album' ? ImageIcon : entry.kind === 'page' ? FileText : BookOpen;
  const cover = [copiedImageUrl(entry.cover), ...(fallbackImages || [])].find(src => src && !failedImages.includes(src)) || '';
  useEffect(() => {
    if (cover || entry.kind !== 'album' || entry.imageCount === 0 || fallbackImages !== null) return;
    const controller = new AbortController();
    // Only our own imported JSON is read. A missing cover never falls back to
    // the original host, and illustrations cannot become album photographs.
    fetch(siteUrl('/content/entries/' + encodeURIComponent(entry.id) + '.json'), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Album indisponible');
        return await response.json() as ArchiveEntry;
      })
      .then((detail: ArchiveEntry) => setFallbackImages((detail.images || []).filter(image => !isDocumentImage(image) && !isDecorativeImage(image)).map(image => copiedImageUrl(image.thumbnailUrl || image.src, image.status) || copiedImageUrl(image.src, image.status)).filter(Boolean)))
      .catch(error => { if (error.name !== 'AbortError') setFallbackImages([]); });
    return () => controller.abort();
  }, [cover, entry.id, entry.kind, entry.imageCount, fallbackImages]);
  const excerpt = displayExcerpt(entry);
  return <a className={'archive-card archive-card-' + entry.kind} href={href}>
    <div className={'archive-card-image' + (!cover ? ' is-placeholder' : '')}>{cover ? <img src={cover} alt="" loading="lazy" decoding="async" onError={() => setFailedImages(images => [...images, cover])}/> : <div className="archive-card-placeholder"><Icon size={40}/><span>{entry.kind === 'album' ? 'Sur le blog d’origine' : KIND_NAMES[entry.kind]}</span></div>}{entry.kind !== 'album' && <span className="archive-card-kind"><Icon size={14}/>{KIND_NAMES[entry.kind]}</span>}{entry.kind === 'album' && entry.imageCount > 0 && <span className="archive-card-image-count"><ImageIcon size={13}/>{plural(entry.imageCount, 'photo')}</span>}</div>
    <div className="archive-card-copy">{entry.kind !== 'album' && (displayDate(entry.date) || entry.categories?.[0]) && <div className="archive-card-meta">{displayDate(entry.date) && <time dateTime={entry.date}>{displayDate(entry.date)}</time>}{entry.categories?.[0] && <span>{entry.categories[0]}</span>}</div>}<h2>{displayTitle(entry)}</h2>{excerpt && <p>{excerpt}</p>}<span className="archive-card-read">{entry.kind === 'album' ? entry.imageCount ? 'Ouvrir l’album' : 'Retrouver les images d’origine' : entry.kind === 'page' ? 'Consulter la page' : 'Lire le récit'}<ChevronRight size={17}/></span></div>
  </a>;
}

function paginationNumbers(page: number, total: number): Array<number | 'dots'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const candidates = [...new Set([1, total, page - 1, page, page + 1, ...(page <= 3 ? [2, 3, 4] : []), ...(page >= total - 2 ? [total - 3, total - 2, total - 1] : [])])].filter(value => value >= 1 && value <= total).sort((a, b) => a - b);
  const output: Array<number | 'dots'> = [];
  for (const value of candidates) { if (typeof output[output.length - 1] === 'number' && value - Number(output[output.length - 1]) > 1) output.push('dots'); output.push(value); }
  return output;
}
