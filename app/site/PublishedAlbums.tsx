"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import type { MediaPhoto } from "../../lib/media-types";
import { mediaImageUrl, mediaImageSrcSet } from "../../lib/media-images";
import "./published-albums.css";
import { publicFeedUrl } from "../../lib/site-delivery";

export default function PublishedAlbums() {
  const [photos, setPhotos] = useState<MediaPhoto[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [visibleAlbumCount, setVisibleAlbumCount] = useState(6);
  const dialog = useRef<HTMLDialogElement>(null);
  const albums = useMemo(() => {
    const result = new Map<string, MediaPhoto[]>();
    for (const photo of photos) {
      if (!photo.published || !mediaImageUrl(photo)) continue;
      const name = photo.album || "Vie du club";
      result.set(name, [...(result.get(name) || []), photo]);
    }
    return [...result.entries()];
  }, [photos]);
  const albumPhotos = albums.find(([title]) => title === activeAlbum)?.[1] || [];
  const current = albumPhotos[photoIndex];
  useEffect(() => {
    const abort = new AbortController();
    fetch(publicFeedUrl("media"), { signal: abort.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const data = await response.json() as { photos?: MediaPhoto[] };
      if (Array.isArray(data.photos)) setPhotos(data.photos);
    }).catch(() => {});
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (activeAlbum === null) { dialog.current?.close(); return; }
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = oldOverflow; before?.focus(); };
  }, [activeAlbum]);
  if (!albums.length) return null;
  return <div className="site-cloud-albums">
    <div className="site-album-grid">{albums.slice(0, visibleAlbumCount).map(([title, images]) => <button type="button" className="site-album-card site-cloud-album-card" key={title} onClick={() => { setPhotoIndex(0); setActiveAlbum(title); }}><div className="site-album-cover"><img src={mediaImageUrl(images[0], 640)} srcSet={mediaImageSrcSet(images[0])} sizes="(max-width: 640px) 92vw, 32vw" alt={images[0].alt || images[0].title} width={images[0].width} height={images[0].height} loading="lazy" decoding="async" /></div><div className="site-album-copy"><span className="site-album-year">{images[0].takenAt ? new Date(images[0].takenAt + "T12:00:00Z").toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "La vie du club"}</span><h3>{title}</h3><div><span><ImageIcon size={16} />{images.length} photo{images.length > 1 ? "s" : ""}</span><span className="site-album-open">Voir l’album</span></div></div></button>)}</div>
    {albums.length > visibleAlbumCount && <div className="site-cloud-more"><button type="button" className="site-button site-button-outline" onClick={() => setVisibleAlbumCount(count => count + 6)}>Voir les albums suivants</button></div>}
    <div className="site-cloud-history-heading"><h3>Les souvenirs du blog</h3><span>Des albums à retrouver dans les archives</span></div>
    <dialog ref={dialog} className="site-cloud-dialog" aria-label={activeAlbum || "Album photo"} onCancel={() => setActiveAlbum(null)} onClick={event => { if (event.target === event.currentTarget) setActiveAlbum(null); }} onKeyDown={event => { if (event.key === "ArrowRight" && photoIndex < albumPhotos.length - 1) setPhotoIndex(index => index + 1); if (event.key === "ArrowLeft" && photoIndex > 0) setPhotoIndex(index => index - 1); }}>
      <header><div><small>Les albums du club</small><h2>{activeAlbum}</h2></div><button type="button" aria-label="Fermer l’album" onClick={() => setActiveAlbum(null)}><X size={23} /></button></header>
      {current && <><figure className="site-cloud-photo"><img key={current.id} src={mediaImageUrl(current, 1600)} srcSet={mediaImageSrcSet(current)} sizes="(max-width: 1050px) 90vw, 1000px" alt={current.alt || current.title} width={current.width} height={current.height} decoding="async" /><figcaption><h3>{current.title}</h3>{current.caption && <p>{current.caption}</p>}{current.credit && <small>Photo : {current.credit}</small>}</figcaption></figure><div className="site-cloud-pagination"><button type="button" disabled={!photoIndex} onClick={() => setPhotoIndex(index => index - 1)}>Précédente</button><span aria-live="polite">{photoIndex + 1} / {albumPhotos.length}</span><button type="button" disabled={photoIndex >= albumPhotos.length - 1} onClick={() => setPhotoIndex(index => index + 1)}>Suivante</button></div><div className="site-cloud-thumbnails" aria-label="Choisir une photo">{albumPhotos.map((photo, index) => <button type="button" key={photo.id} className={index === photoIndex ? "active" : ""} aria-label={`Voir ${photo.title}`} aria-pressed={index === photoIndex} onClick={() => setPhotoIndex(index)}><img src={mediaImageUrl(photo, 320)} width={photo.width} height={photo.height} alt="" loading="lazy" decoding="async" /></button>)}</div></>}
    </dialog>
  </div>;
}
