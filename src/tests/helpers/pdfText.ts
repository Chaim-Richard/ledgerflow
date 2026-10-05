/**
 * Reads the text back out of a PDF made by pdfService (pdfkit, embedded fonts) for tests: content
 * streams are inflated, glyph codes mapped through each font's ToUnicode table. Returns the text
 * runs in drawing order (one per word, as the PDF draws words one by one); right-to-left words come
 * out in display order, so tests compare them reversed.
 */
import zlib from 'node:zlib';

interface PdfObject { dict: string; stream?: Buffer }

function objects(pdf: Buffer): Map<number, PdfObject> {
  const text = pdf.toString('latin1');
  const out = new Map<number, PdfObject>();
  const re = /(\d+) 0 obj\s*([\s\S]*?)endobj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const body = m[2];
    const s = body.indexOf('stream');
    if (s === -1) { out.set(Number(m[1]), { dict: body }); continue; }
    const dict = body.slice(0, s);
    const start = s + 'stream'.length + (body[s + 6] === '\r' ? 2 : 1);
    const end = body.lastIndexOf('endstream');
    let raw = Buffer.from(body.slice(start, end), 'latin1');
    if (/\/FlateDecode/.test(dict)) {
      try { raw = zlib.inflateSync(raw); } catch { raw = zlib.inflateSync(raw.subarray(0, raw.length - 1)); }
    }
    out.set(Number(m[1]), { dict, stream: raw });
  }
  return out;
}

const utf16 = (hex: string) => {
  let s = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return s;
};

function parseCmap(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
    for (const line of block.split('\n')) {
      const arr = line.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]*)\]/);
      if (arr) {
        const first = parseInt(arr[1], 16);
        (arr[3].match(/<([0-9a-fA-F]+)>/g) || []).forEach((h, i) => map.set(first + i, utf16(h.slice(1, -1))));
        continue;
      }
      const seq = line.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
      if (seq) {
        const [a, b, dst] = [parseInt(seq[1], 16), parseInt(seq[2], 16), parseInt(seq[3], 16)];
        for (let g = a; g <= b; g++) map.set(g, String.fromCharCode(dst + g - a));
      }
    }
  }
  for (const block of cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
    for (const pair of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(pair[1], 16), utf16(pair[2]));
  }
  return map;
}

export function pdfTextRuns(pdf: Buffer): string[] {
  const objs = objects(pdf);
  // font resource name (F1, F2…) → glyph map
  const fontMaps = new Map<string, Map<number, string>>();
  for (const obj of objs.values()) {
    for (const ref of obj.dict.matchAll(/\/(F\d+)\s+(\d+) 0 R/g)) {
      const font = objs.get(Number(ref[2]));
      const toUnicode = font?.dict.match(/\/ToUnicode (\d+) 0 R/);
      const cmap = toUnicode ? objs.get(Number(toUnicode[1]))?.stream : undefined;
      if (cmap) fontMaps.set(ref[1], parseCmap(cmap.toString('latin1')));
    }
  }
  const runs: string[] = [];
  for (const obj of objs.values()) {
    const content = obj.stream?.toString('latin1');
    if (!content || !/ Tf\b/.test(content)) continue;
    let font: Map<number, string> | undefined;
    for (const op of content.matchAll(/\/(F\d+) [\d.]+ Tf|\[([^\]]*)\] TJ|<([0-9a-fA-F]*)> Tj/g)) {
      if (op[1]) { font = fontMaps.get(op[1]); continue; }
      const hexes = op[2] !== undefined ? (op[2].match(/<([0-9a-fA-F]*)>/g) || []).map(h => h.slice(1, -1)) : [op[3]];
      let run = '';
      for (const hex of hexes) for (let i = 0; i + 4 <= hex.length; i += 4) run += font?.get(parseInt(hex.slice(i, i + 4), 16)) ?? '?';
      if (run) runs.push(run);
    }
  }
  return runs;
}

/** All the text, words separated by spaces. */
export const pdfText = (pdf: Buffer) => pdfTextRuns(pdf).join(' ');

/** How many pages the PDF has. */
export const pdfPageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
