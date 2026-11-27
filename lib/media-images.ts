import type { MediaPhoto } from "./media-types";
import { mediaImageUrl } from "./media-types";
export { mediaImageUrl } from "./media-types";

export function mediaImageSrcSet(photo: Pick<MediaPhoto, "secureUrl" | "cloudName" | "publicId">): string | undefined {
  const entries = [320, 640, 960, 1600].map(width => {
    const url = mediaImageUrl(photo, width);
    return url ? `${url} ${width}w` : "";
  }).filter(Boolean);
  return entries.length ? entries.join(", ") : undefined;
}
