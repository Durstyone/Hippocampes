export interface PublicDocument {
  title: string;
  description: string;
  category: 'adhesion' | 'administratif' | 'formation' | 'autre';
  season: string;
  url: string;
  /** ISO calendar date, or an empty string when the publication date is unknown. */
  date: string;
  format: 'pdf' | 'page';
  order: number;
}
export type PublicDocumentEntry = PublicDocument & { id: string };
export const MAX_PUBLIC_PDF_BYTES: number;
export function validatePublicDocument(value: unknown): PublicDocument;
export function validatePublicPdf(bytes: Uint8Array): void;
