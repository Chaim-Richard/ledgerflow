import { AlgorithmDefinition } from './types';

/**
 * AUD-14: reads the merchant, date and total from a receipt's text lines (from a scanner or OCR) with simple positional
 * rules — no model. It reads the text the person pastes; the built-in receipt is shown only as a labelled example. What
 * the rules cannot be sure of is a warning, never a confident answer: more than one total, more than one date, a total
 * found without the word "total", a currency that is not stated. No accuracy figure is claimed: none was measured.
 */
export interface ReceiptReading {
  merchant: string;
  dateStr: string;
  totalCents: number;
  /** the currency the receipt states ($, €, £, ₪ or a code), when it states one */
  currency?: string;
  warnings: string[];
}

const SYMBOLS: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₪': 'ILS' };
const AMOUNT = /(?:([$€£₪])\s*)?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\b/;
const DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g;

const cents = (whole: string, fraction: string) => Number(whole.replace(/,/g, '')) * 100 + Number(fraction);

export function parseReceiptOCR(ocrLines: string[], existingMerchants: string[]): ReceiptReading {
  const lines = ocrLines.map(l => l.trim()).filter(Boolean);
  const warnings: string[] = [];

  // 1. Merchant: a known merchant in the first lines, else the first line
  let merchant = lines[0] || 'Unknown';
  for (const line of lines.slice(0, 5)) {
    const match = existingMerchants.find(m => m && line.toLowerCase().includes(m.toLowerCase()));
    if (match) { merchant = match; break; }
  }
  if (!lines.length) warnings.push('The receipt has no text.');

  // 2. Date: the first one; a second, different one is a warning
  const dates = [...new Set(lines.flatMap(l => l.match(DATE) || []))];
  const dateStr = dates[0] || '';
  if (!dateStr) warnings.push('No date was found.');
  if (dates.length > 1) warnings.push(`More than one date (${dates.join(', ')}): the first is used — check it.`);

  // 3. Total: the amount on a line that says "total" (not "subtotal"), from the bottom; else the largest amount
  const totals = lines.filter(l => /\btotal\b/i.test(l) && !/sub\s*-?\s*total/i.test(l)).map(l => l.match(AMOUNT)).filter((m): m is RegExpMatchArray => Boolean(m));
  const amounts = lines.map(l => l.match(AMOUNT)).filter((m): m is RegExpMatchArray => Boolean(m));
  let chosen: RegExpMatchArray | undefined = totals[totals.length - 1];
  if (!chosen) {
    chosen = [...amounts].sort((a, b) => cents(b[2], b[3]) - cents(a[2], a[3]))[0];
    if (chosen) warnings.push('No line says "total": the largest amount is used — check it.');
  } else if (new Set(totals.map(m => cents(m[2], m[3]))).size > 1) {
    warnings.push(`More than one total (${totals.map(m => `${m[2]}.${m[3]}`).join(', ')}): the last is used — check it.`);
  }
  if (!chosen) warnings.push('No amount was found.');
  const totalCents = chosen ? cents(chosen[2], chosen[3]) : 0;

  // 4. Currency: a symbol or code on the receipt; none stated is a warning
  const symbol = chosen?.[1] || lines.map(l => l.match(/[$€£₪]/)?.[0]).find(Boolean);
  const code = lines.map(l => l.match(/\b(USD|EUR|GBP|ILS|NIS|CAD|AUD)\b/)?.[1]).find(Boolean);
  const currency = symbol ? SYMBOLS[symbol] : code === 'NIS' ? 'ILS' : code;
  if (!currency) warnings.push('The receipt states no currency: check which it is in.');

  return { merchant, dateStr, totalCents, ...(currency ? { currency } : {}), warnings };
}

/** A sample receipt, shown only when no text was pasted, and labelled as an example. */
const EXAMPLE = [
  'HOME DEPOT 123',
  '123 MAIN ST',
  '04/15/2026 14:23',
  'HAMMER      12.99',
  'NAILS        5.49',
  'SUBTOTAL    18.48',
  'TAX          1.52',
  'TOTAL      $20.00',
  'VISA **** 1234',
];

export const RECEIPT_CAPTURE_ALGO: AlgorithmDefinition = {
  id: 'receipt_capture',
  domain: 'operations',
  name: 'Positional Receipt Capture (No ML)',
  description: 'Reads the merchant, date and total from the text of a receipt you paste (from a scanner or OCR), with positional rules and no vision model. What it cannot be sure of is listed as a warning.',
  inputs: [{ kind: 'text', key: 'receiptText', label: 'Receipt text (one line per row)', defaultValue: '', placeholder: 'Paste the text of a receipt' }],
  compute: (ctx, inputs) => {
    const { transactions } = ctx;
    const start = performance.now();
    const pasted = String(inputs.receiptText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const example = pasted.length === 0;
    const merchants = Array.from(new Set<string>(transactions.map(t => t.payee || t.description || ''))).filter(m => m.length > 3);
    const result = parseReceiptOCR(example ? EXAMPLE : pasted, merchants);
    const ms = performance.now() - start;
    const money = result.currency ? `${result.currency} ${(result.totalCents / 100).toFixed(2)}` : (result.totalCents / 100).toFixed(2);

    return {
      metrics: [
        { label: 'Merchant', value: result.merchant },
        { label: 'Date', value: result.dateStr || 'Not found' },
        { label: 'Total', value: money },
        { label: 'Warnings', value: result.warnings.length },
      ],
      charts: [],
      insights: [
        ...(example ? ['Example only: no receipt text was pasted, so this reads a built-in sample receipt. Paste a receipt\'s text to read yours.'] : []),
        ...result.warnings,
        'How it reads: merchant from a known payee in the first lines (else the first line); date by pattern; total from the last line that says "total" (not subtotal), else the largest amount.',
        `Read in ${ms.toFixed(2)} ms. Nothing is posted: check the figures before using them.`,
      ],
    };
  },
};
