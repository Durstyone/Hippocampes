import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import ClubWebsite from '../../app/site/ClubWebsite';
import { ClubPage, ActivitiesPage } from '../../app/site/ClubPages';
import ArchiveHub from '../../app/archives/ArchiveHub';
import NewsPage from '../../app/actualites/NewsPage';
import AgendaPage from '../../app/agenda/AgendaPage';
import AdminPage from '../../app/admin/AdminPage';
import DocumentsPage from '../../app/documents/DocumentsPage';
import { mediaUrl, siteUrl } from '../../lib/site-delivery';
import '../../app/globals.css';
import '../../app/ocean-background.css';
import '../../app/apnea-theme.css';

declare const __SITE_DELIVERY__: { basePath: string };

const basePath = __SITE_DELIVERY__.basePath;
const pathname = window.location.pathname;
const path = basePath === '/' ? pathname : pathname.startsWith(basePath) ? '/' + pathname.slice(basePath.length) : '';
const pieces = path.replace(/\/$/, '').split('/').filter(Boolean);
let id: string | undefined;
try { id = pieces[1] ? decodeURIComponent(pieces[1]) : undefined; } catch { id = undefined; }
const element = document.getElementById('root');
if (!element) throw new Error('La zone d’affichage du site est absente.');
document.body.classList.add('ocean-theme');
const oceanScene = `url(${JSON.stringify(mediaUrl('/images/apnee-immersion.webp'))})`;
document.documentElement.style.setProperty('--site-ocean-image', oceanScene);
document.documentElement.style.setProperty('--apnea-scene', oceanScene);

const isHome = Boolean(path) && (pieces.length === 0 || path === '/index.html');
const isClub = pieces[0] === 'le-club' && pieces.length === 1;
const isActivities = pieces[0] === 'activites' && pieces.length === 1;
const isArchive = pieces[0] === 'archives' && pieces.length <= 2;
const isNews = pieces[0] === 'actualites' && pieces.length <= 2;
const isAgenda = pieces[0] === 'agenda' && pieces.length === 1;
const isDocuments = pieces[0] === 'documents' && pieces.length === 1;
const isAdmin = pieces[0] === 'admin' && pieces.length === 1;
function SiteRoute() {
  useEffect(() => {
    if (!window.location.hash) return;
    try { document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ block: 'start' }); } catch { /* Ignore malformed fragments. */ }
  }, []);
  return isHome ? <ClubWebsite /> : isClub ? <ClubPage /> : isActivities ? <ActivitiesPage /> : isArchive ? <ArchiveHub initialId={id} /> : isNews ? <NewsPage initialId={id} /> : isAgenda ? <AgendaPage /> : isDocuments ? <DocumentsPage /> : isAdmin ? <AdminPage /> : <main style={{ maxWidth: 700, margin: '12vh auto', padding: 32, borderRadius: 16, background: '#0b3039', color: '#eaf5f3', border: '1px solid #27515a' }}><h1>Cette page n’est pas disponible.</h1><p style={{ marginTop: 20 }}>Retrouvez les informations et les archives des Hippocampes du Robec depuis l’accueil.</p><a href={siteUrl('/')} style={{ display: 'inline-block', marginTop: 24, color: '#8be5d5', textDecoration: 'underline' }}>Retour au site du club</a></main>;
}
createRoot(element).render(<SiteRoute />);
