"use client";

import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, ExternalLink, Loader2, Waves } from "lucide-react";
import "../archives/archives.css";
import "./news.css";
import { isStaticSite, mediaUrl, publicFeedUrl, siteUrl } from "../../lib/site-delivery";

import { PublicHeader, PublicFooter } from "../site/PublicLayout";
import { publicSiteSettings as settings } from "../../lib/public-site-content";
import "../site/apnea-home.css";

export type PublicNews = { id: string; title: string; date: string; excerpt: string; body?: string; image: string; url: string };
export function newsDate(value: string) {
  const date = new Date(value.length === 10 ? value + "T12:00:00Z" : value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "";
}
function safeImage(value: string) { try { const u = new URL(value, "https://club.example"); return value && !value.includes("\\") && u.protocol === "https:" && !u.username && !u.password ? mediaUrl(value) : ""; } catch { return ""; } }
function safeLink(value: string) { try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; } catch { return ""; } }

export default function NewsPage({ initialId }: { initialId?: string }) {
  const [items, setItems] = useState<PublicNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const query = initialId ? "?id=" + encodeURIComponent(initialId) : "?summary=1";
    fetch(publicFeedUrl("club") + (isStaticSite ? "" : query), { signal: controller.signal, cache: "no-store" })
      .then(async response => { const data = await response.json() as { news?: PublicNews[]; error?: string }; if (!response.ok) throw new Error(data.error || "Les actualités sont momentanément indisponibles."); setItems(data.news || []); })
      .catch(error => { if (error.name !== "AbortError") setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialId]);
  const selected = initialId ? items.find(item => item.id === initialId) : null;
  return <div className="archive-page news-page apnea-news">
    <a className="archive-skip" href="#actualites-contenu">Aller au contenu</a>
    <PublicHeader current="news" />
    <main id="actualites-contenu">
      <section className="archive-hero"><div className="archive-container"><div className="archive-hero-copy"><div className="archive-eyebrow"><Waves size={20} /> LE JOURNAL DES HIPPOCAMPES</div><h1>À la surface,<br /><span>la vie du club.</span></h1><p>Les rendez-vous, les projets et les moments que l’on partage. Un journal pour garder le fil, entre deux immersions.</p></div><div className="apnea-journal-aside"><span>LES NOUVELLES DU BORD</span><p>Des visages.<br />Des sorties.<br /><strong>Des histoires à partager.</strong></p></div></div></section>
      <section className="archive-container archive-reader-shell news-reading" aria-busy={loading}>
        {loading ? <p className="news-status" role="status"><Loader2 size={22} />Chargement des actualités…</p> : error ? <div role="alert"><h2>Impossible de charger les actualités</h2><p>{error}</p><a className="news-link" href={siteUrl("/actualites")}>Réessayer</a></div> : initialId ? selected ? <article>
          <a className="news-link" href={siteUrl("/actualites")}>Toutes les actualités</a>
          <div className="news-date"><CalendarDays size={16} /><time dateTime={selected.date}>{newsDate(selected.date)}</time></div>
          <h2 className="news-title">{selected.title}</h2><p className="news-lead">{selected.excerpt}</p>
          {safeImage(selected.image) && <img className="news-cover" src={safeImage(selected.image)} alt="" />}
          <div className="news-body">{(selected.body || "").split(/\n\s*\n/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
          {safeLink(selected.url) && <a className="news-link" href={safeLink(selected.url)} target="_blank" rel="noreferrer">Informations complémentaires <ExternalLink size={16} /></a>}
        </article> : <div className="news-status"><BookOpen size={30} /><h2>Cette actualité n’est pas disponible.</h2><p>Elle a peut-être été retirée ou n’est pas encore publiée.</p><a className="news-link" href={siteUrl("/actualites")}>Consulter les actualités</a></div> : items.length ? <>
          <div className="news-section-heading"><div><h2>La vie du club</h2><p>Les publications de l’équipe.</p></div><a className="news-link" href={siteUrl("/archives?type=article")}>Retrouver les articles du blog</a></div>
          <div className="news-grid">{items.map(item => <a className="news-card" key={item.id} href={siteUrl("/actualites/" + encodeURIComponent(item.id))}>{safeImage(item.image) ? <img src={safeImage(item.image)} alt="" loading="lazy" /> : <div className="news-card-symbol"><Waves size={44} strokeWidth={1.2} /></div>}<div><time dateTime={item.date}>{newsDate(item.date)}</time><h3>{item.title}</h3><p>{item.excerpt}</p><span>Lire l’actualité</span></div></a>)}</div>
        </> : null}
        {!initialId && !loading && <section className={"apnea-news-blog" + (!items.length && !error ? " apnea-news-blog-first" : "")} aria-labelledby="blog-news-heading">
          <div className="news-section-heading"><div><h2 id="blog-news-heading">Le club en images</h2><p>Les derniers récits du blog, avec leurs photos.</p></div><a className="news-link" href={siteUrl("/archives?type=article")}>Tous les récits</a></div>
          <div className="news-grid apnea-journal-grid">{settings.featuredNews.map(item => <a className="news-card" key={item.title} href={siteUrl(item.url)}><img src={mediaUrl(item.image)} alt={item.alt} loading="lazy" /><div><time>{item.date}</time><h3>{item.title}</h3><p>{item.summary}</p><span>Lire le récit</span></div></a>)}</div>
        </section>}
      </section>
    </main><PublicFooter />
  </div>;
}
