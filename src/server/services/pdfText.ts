import bidiFactory from 'bidi-js';
import type PDFDocument from 'pdfkit';

/**
 * Text for the document PDF in any script, Hebrew and mixed Hebrew/English included (owner
 * decision 10): lines are wrapped in reading order, then put in display order with the Unicode
 * bidi algorithm and drawn word by word. pdfkit's font engine reverses a right-to-left word by
 * itself, so such a word is handed over in reading order; everything else in display order.
 */

const bidi = bidiFactory();
const RTL_LETTER = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}]/u;
const ANY_LETTER = /\p{L}/u;

type Doc = InstanceType<typeof PDFDocument>;

/** True when the font engine will treat this word as right-to-left (its first letter is). */
function engineReadsRtl(word: string): boolean {
  for (const ch of word) {
    if (RTL_LETTER.test(ch)) return true;
    if (ANY_LETTER.test(ch)) return false;
  }
  return false;
}

/** The words of one line in display order, each ready to hand to pdfkit. */
export function displayWords(line: string): string[] {
  const visual = RTL_LETTER.test(line) ? bidi.getReorderedString(line, bidi.getEmbeddingLevels(line)) : line;
  return visual.split(' ').map(w => (engineReadsRtl(w) ? [...w].reverse().join('') : w));
}

/** Splits text into lines that fit `width` at the current font and size (reading order). */
export function wrapText(doc: Doc, text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of String(text ?? '').split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (!line || doc.widthOfString(next) <= width) { line = next; continue; }
      out.push(line);
      line = word;
      // a single word longer than the column: cut it
      while (doc.widthOfString(line) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && doc.widthOfString(line.slice(0, cut)) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

/** Draws one line at (x, y), aligned inside `width`. */
export function drawLine(doc: Doc, line: string, x: number, y: number, width: number, align: 'left' | 'right' | 'center' = 'left'): void {
  const words = displayWords(line);
  const space = doc.widthOfString(' ');
  const widths = words.map(w => doc.widthOfString(w));
  const total = widths.reduce((a, b) => a + b, 0) + space * Math.max(0, words.length - 1);
  let cursor = align === 'right' ? x + width - total : align === 'center' ? x + (width - total) / 2 : x;
  words.forEach((word, i) => {
    if (word) doc.text(word, cursor, y, { lineBreak: false });
    cursor += widths[i] + space;
  });
}
