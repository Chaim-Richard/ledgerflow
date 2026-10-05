/** What a document number looks like (matches the server's formatDocumentNumber in numberingService.ts). */
export const previewNumber = (prefix: string, next: number, padding: number) =>
  `${prefix}${String(Number.isFinite(next) && next > 0 ? Math.floor(next) : 1).padStart(Math.min(Math.max(padding || 1, 1), 10), '0')}`;
