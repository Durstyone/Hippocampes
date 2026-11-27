export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_MEDIA_BODY = MAX_MEDIA_BYTES + 64 * 1024;

export interface MediaPhoto {
  id: string;
  version: number;
  title: string;
  alt: string;
  caption: string;
  credit: string;
  album: string;
  takenAt: string;
  published: boolean;
  secureUrl: string;
  publicId: string;
  cloudName: string;
  width: number;
  height: number;
  bytes: number;
  format: "jpg" | "png" | "webp" | "gif";
  createdAt: string;
  updatedAt: string;
}

export interface MediaConfiguration {
  configured: boolean;
  cloudName: string;
  maxBytes: number;
  formats: string[];
  demo: boolean;
}

export interface MediaLibrary {
  configuration: MediaConfiguration;
  photos: MediaPhoto[];
}

/** This helper contains no credentials and is safe to import in browser code. */
export function mediaImageUrl(photo: Pick<MediaPhoto, "secureUrl">, width = 1200): string {
  const local = localSitePath(photo.secureUrl);
  if (/^\/(?:images|media\/archive)\/(?:[A-Za-z0-9][A-Za-z0-9._~-]*\/)*[A-Za-z0-9][A-Za-z0-9._~-]*\.(?:jpe?g|png|webp|gif)$/i.test(local)) return mediaUrl(local);
  if (!/^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/v\d+\/hippocampes-du-robec\/[0-9a-f-]+\.(jpg|png|webp)$/.test(photo.secureUrl)) return "";
  const boundedWidth = Math.max(160, Math.min(2400, Math.round(Number.isFinite(width) ? width : 1200)));
  return photo.secureUrl.replace("/image/upload/", `/image/upload/c_limit,w_${boundedWidth},f_auto,q_auto/`);
}
import { localSitePath, mediaUrl } from './site-delivery';

