'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Download, FileText, FolderOpen, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { PublicFooter, PublicHeader } from '../site/PublicLayout';
import { publicSiteSettings as settings } from '../../lib/public-site-content';
import { siteUrl } from '../../lib/site-delivery';
import { validatePublicDocument, type PublicDocumentEntry } from '../../lib/public-documents.mjs';
import './documents.css';

const CATEGORY_LABELS: Record<PublicDocumentEntry['category'], string> = {
  adhesion: 'Adhésion', administratif: 'Vie de l’association', formation: 'Formation & matériel', autre: 'Ressource du club',
};
const sameSeason = (one: string, two: string) => one.replace(/\D/g, '') === two.replace(/\D/g, '');
const isLocal = (url: string) => url.startsWith('/') && !url.startsWith('//');

function DocumentActions({ document, prominent = false }: { document: PublicDocumentEntry; prominent?: boolean }) {
  const href = siteUrl(document.url);
  return <div className="documents-actions">
    <a className={'documents-button ' + (prominent ? 'documents-button-primary' : 'documents-button-outline')} href={href} target="_blank" rel="noopener noreferrer">
      {document.format === 'pdf' ? <FileText size={18} aria-hidden="true"/> : <BookOpen size={18} aria-hidden="true"/>}
      {document.format === 'pdf' ? 'Ouvrir le PDF' : 'Consulter le document'}<span className="documents-sr-only"> : {document.title} (nouvel onglet)</span>
    </a>
    {document.format === 'pdf' && isLocal(document.url) && <a className="documents-download" href={href} download={document.id + '.pdf'}><Download size={17} aria-hidden="true"/>Télécharger<span className="documents-sr-only"> : {document.title}</span></a>}
  </div>;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<PublicDocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(siteUrl('/content/public-documents.json'), { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Les documents ne sont pas disponibles pour le moment.');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('documents' in data) || !Array.isArray(data.documents)) throw new Error('La liste des documents n’a pas pu être chargée.');
        const ids = new Set<string>();
        const parsed = data.documents.map((item: unknown) => {
          if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(item.id) || ids.has(item.id)) throw new Error('La liste des documents n’a pas pu être chargée.');
          const { id, ...record } = item;
          ids.add(id);
          return { id, ...validatePublicDocument(record) };
        });
        if (!controller.signal.aborted) setDocuments(parsed.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'fr')));
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Les documents ne sont pas disponibles pour le moment.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const featured = documents.find(item => item.category === 'adhesion' && sameSeason(item.season, settings.season.name))
    || documents.find(item => item.category === 'adhesion');
  const otherDocuments = documents.filter(item => item.id !== featured?.id);

  return <div className="site-page apnea-page documents-page">
    <a className="site-skip" href="#documents-contenu">Aller au contenu</a>
    <PublicHeader current="documents"/>
    <main id="documents-contenu">
      <section className="documents-hero">
        <div className="documents-container">
          <nav className="documents-breadcrumb" aria-label="Fil d’Ariane"><a href={siteUrl('/')}>Accueil</a><span aria-hidden="true">/</span><a href={siteUrl('/le-club/')}>Le club</a><span aria-hidden="true">/</span><span>Documents</span></nav>
          <div className="documents-intro"><div><p className="documents-kicker">LES DOCUMENTS DU CLUB</p><h1>Avant de plonger,<br/><em>tout est ici.</em></h1><p className="documents-lead">Préparer son adhésion, retrouver un règlement, consulter les ressources de l’association.</p></div><div className="documents-hero-note"><FolderOpen size={35} strokeWidth={1.3} aria-hidden="true"/><span>Les bons documents,<br/>à portée de main.</span><small>Saison {settings.season.name}</small></div></div>
        </div>
      </section>

      <section className="documents-container documents-content" aria-busy={loading}>
        {loading ? <p className="documents-status" role="status"><Loader2 size={22} aria-hidden="true"/>Chargement des documents…</p> : error ? <div className="documents-feedback" role="alert"><h2>Les documents sont momentanément indisponibles.</h2><p>{error}</p><button className="documents-button documents-button-outline" type="button" onClick={() => setAttempt(value => value + 1)}>Réessayer</button><a href={siteUrl('/archives/dossier-d-inscription-b57a8c92/')}>Retrouver le dossier dans les archives</a></div> : <>
          {featured && <article className="documents-featured" aria-labelledby="adhesion-document-title">
            <div className="documents-featured-symbol" aria-hidden="true"><FileText size={60} strokeWidth={1.1}/><span>{featured.format === 'pdf' ? 'PDF' : 'DOCUMENT'}</span>{featured.season && <strong>{featured.season}</strong>}</div>
            <div className="documents-featured-content"><p className="documents-kicker">POUR REJOINDRE LE CLUB</p><h2 id="adhesion-document-title">{featured.title}</h2><p>{featured.description}</p>{featured.format === 'pdf' && <p className="documents-print-note">À imprimer et à compléter. Il ne s’agit pas d’un formulaire d’inscription en ligne.</p>}<DocumentActions document={featured} prominent/></div>
          </article>}

          {otherDocuments.length > 0 && <section className="documents-resources" aria-labelledby="documents-resources-title"><div className="documents-section-heading"><div><p className="documents-kicker">LES REPÈRES DE L’ASSOCIATION</p><h2 id="documents-resources-title">La vie du club, en pratique.</h2></div><span>{otherDocuments.length} document{otherDocuments.length > 1 ? 's' : ''}</span></div><div className="documents-grid">{otherDocuments.map(item => <article className="documents-card" key={item.id}><div className="documents-card-top">{item.category === 'administratif' ? <ShieldCheck size={24} strokeWidth={1.5} aria-hidden="true"/> : <BookOpen size={24} strokeWidth={1.5} aria-hidden="true"/>}<span>{CATEGORY_LABELS[item.category]}</span></div><h3>{item.title}</h3><p>{item.description}</p>{item.season && <p className="documents-card-season">Saison {item.season}</p>}<DocumentActions document={item}/></article>)}</div></section>}
          {!documents.length && <div className="documents-feedback"><FolderOpen size={30} aria-hidden="true"/><h2>Les documents arrivent bientôt.</h2><p>Contactez le club pour préparer votre adhésion.</p></div>}
        </>}

        <aside className="documents-contact"><div><p className="documents-kicker">BESOIN D’UN COUP DE MAIN ?</p><h2>Préparons votre inscription.</h2><p>Le club vous accompagne pour choisir votre activité et constituer votre dossier. Les formulaires complétés sont à remettre aux responsables du club.</p></div><a className="documents-button documents-button-outline" href={siteUrl('/le-club/') + '?sujet=' + encodeURIComponent('Rejoindre le club') + '#contact'}><Mail size={18} aria-hidden="true"/>Contacter le club</a></aside>
      </section>
    </main>
    <PublicFooter/>
  </div>;
}
