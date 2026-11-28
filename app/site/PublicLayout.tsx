'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Mail, Menu, Settings, X } from 'lucide-react';
import { publicSiteSettings as settings } from '../../lib/public-site-content';
import { mediaUrl, siteUrl } from '../../lib/site-delivery';
import './site.css';

type PublicSection = 'club' | 'activities' | 'agenda' | 'news' | 'archives' | 'documents';
const BLOG_URL = 'https://les-hippocampes-du-robec.over-blog.com/';
const PUBLIC_LINKS: { id: PublicSection; label: string; path: string }[] = [
  { id: 'club', label: 'Le club', path: '/le-club/' },
  { id: 'activities', label: 'Nos activités', path: '/activites/' },
  { id: 'agenda', label: 'L’agenda', path: '/agenda/' },
  { id: 'news', label: 'Actualités', path: '/actualites/' },
  { id: 'archives', label: 'Archives', path: '/archives/' },
  { id: 'documents', label: 'Documents', path: '/documents/' },
];

function PublicBrand({ light = false }: { light?: boolean }) {
  return <a className={`site-brand${light ? ' site-brand-light' : ''}`} href={siteUrl('/')} aria-label="Les Hippocampes du Robec, accueil">
    <img src={mediaUrl('/images/logo-club.jpg')} alt="" width="80" height="80" />
    <span>Les Hippocampes<small>DU ROBEC</small></span>
  </a>;
}

export function PublicHeader({ current }: { current?: PublicSection }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationId = useId();
  const navigationRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    };
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!navigationRef.current?.contains(event.target) && !toggleRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [menuOpen]);

  function toggleMenu() {
    setMenuOpen(open => !open);
    if (!menuOpen) window.requestAnimationFrame(() => navigationRef.current?.querySelector<HTMLAnchorElement>('a')?.focus());
  }

  return <header className="site-header">
    <div className="site-container site-header-inner">
      <PublicBrand />
      <nav id={navigationId} ref={navigationRef} className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label="Navigation principale">
        {PUBLIC_LINKS.map(link => <a key={link.id} href={siteUrl(link.path)} aria-current={current === link.id ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
      </nav>
      <div className="site-header-actions">
        <a className="site-member-link" href={siteUrl('/admin/')}><Settings size={17} aria-hidden="true" /><span>Administration</span></a>
        <button ref={toggleRef} type="button" className="site-menu-toggle" aria-expanded={menuOpen} aria-controls={navigationId} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} onClick={toggleMenu}>{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
      </div>
    </div>
  </header>;
}

export function PublicFooter({ onPrivacy, onSources }: { onPrivacy?: () => void; onSources?: () => void } = {}) {
  return <footer className="site-footer">
    <div className="site-container">
      <div className="site-footer-top">
        <div><PublicBrand light /><p>Plonger. Partager. Se retrouver.</p></div>
        <nav aria-label="Liens de pied de page">
          {PUBLIC_LINKS.map(link => <a key={link.id} href={siteUrl(link.path)}>{link.label}</a>)}
          <a href={siteUrl('/admin/')}>Administration du site</a>
          <a href={BLOG_URL} target="_blank" rel="noopener noreferrer" aria-label="Le blog d’origine (nouvel onglet)">Le blog d’origine</a>
        </nav>
        <div className="site-footer-location"><span>{settings.contact.venueShort}</span><span>Darnétal, Normandie</span><a href={`mailto:${settings.contact.email}`}>Écrivez-nous <Mail size={16} aria-hidden="true" /></a></div>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Les Hippocampes du Robec</span>
        {(onSources || onPrivacy) && <div>{onSources && <button type="button" onClick={onSources}>Crédits & sources</button>}{onPrivacy && <button type="button" onClick={onPrivacy}>Informations & confidentialité</button>}</div>}
      </div>
    </div>
  </footer>;
}
