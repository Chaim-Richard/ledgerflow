// bidi-js ships without type declarations; the part the PDF uses.
declare module 'bidi-js' {
  interface EmbeddingLevels { levels: Uint8Array; paragraphs: Array<{ start: number; end: number; level: number }> }
  interface Bidi {
    getEmbeddingLevels(text: string, baseDirection?: 'ltr' | 'rtl' | 'auto'): EmbeddingLevels;
    getReorderedString(text: string, levels: EmbeddingLevels, start?: number, end?: number): string;
  }
  export default function bidiFactory(): Bidi;
}
