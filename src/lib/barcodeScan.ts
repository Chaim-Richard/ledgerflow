/**
 * A-79: barcode scanning for items. A scanner (or a camera reader) sends the code as typed text,
 * usually followed by Enter or Tab. This module cleans that text, finds the item it names, and
 * tells a keyboard-wedge scanner's burst of keys apart from a person typing.
 *
 * Items carry their barcode as their SKU (the item record has no separate barcode field). Matching
 * is exact first, then ignores case and width differences; two items with the same code are reported
 * as ambiguous and never picked silently. Nothing here adds a line or changes stock: the screen that
 * calls it adds the line through its own path.
 */
import { code128Problem, CODE128_MAX_LENGTH } from './code128';

export type ScanReading = { ok: true; code: string } | { ok: false; reason: string };

/** The code from raw scanner text, or the reason it cannot be a barcode. */
export function readScan(raw: unknown): ScanReading {
  if (typeof raw !== 'string') return { ok: false, reason: 'Nothing was scanned.' };
  // scanners end a code with Enter, Tab or a line feed; a stray control character is noise
  const code = [...raw].map(ch => { const c = ch.charCodeAt(0); return c < 32 || c === 127 ? ' ' : ch; }).join('').trim();
  if (!code) return { ok: false, reason: 'Nothing was scanned.' };
  if (code.length > CODE128_MAX_LENGTH) return { ok: false, reason: `A barcode is at most ${CODE128_MAX_LENGTH} characters.` };
  const problem = code128Problem(code);
  if (problem) return { ok: false, reason: problem };
  return { ok: true, code };
}

const fold = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');

export type ItemMatch<T extends { sku: string }> =
  | { status: 'found'; item: T }
  | { status: 'none' }
  | { status: 'ambiguous'; items: T[] };

/** The item whose SKU is this code. Exact matches win; then a match that ignores case and width. */
export function findItemByBarcode<T extends { sku: string }>(items: T[], code: string): ItemMatch<T> {
  const exact = items.filter(item => item.sku === code);
  if (exact.length === 1) return { status: 'found', item: exact[0] };
  if (exact.length > 1) return { status: 'ambiguous', items: exact };
  const folded = fold(code);
  const loose = items.filter(item => fold(item.sku || '') === folded);
  if (loose.length === 1) return { status: 'found', item: loose[0] };
  if (loose.length > 1) return { status: 'ambiguous', items: loose };
  return { status: 'none' };
}

/**
 * Whether a run of key presses (timestamps in milliseconds) looks like a keyboard-wedge scanner:
 * several characters arriving faster than a person types them. A person typing a code does not
 * produce this burst, so the screen can take the text as a scan rather than as typing.
 */
export function isScannerBurst(timesMs: number[], maxGapMs = 50, minKeys = 4): boolean {
  if (timesMs.length < minKeys) return false;
  for (let i = 1; i < timesMs.length; i += 1) {
    if (timesMs[i] - timesMs[i - 1] > maxGapMs) return false;
  }
  return true;
}
