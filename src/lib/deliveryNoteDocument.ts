/**
 * A-46: delivery notes, as a document. A delivery note goes with the goods: what left on one
 * delivery of a sales order (or invoice), to the customer, with no prices unless the sender asks
 * for them. This module lays the note out as plain data in English or Hebrew (right to left) and
 * numbers it in its own series (DN-YYYY-NNN, separate from invoices, orders and estimates). It
 * never posts, never moves stock, and never changes an order: the delivery entries it reads are
 * the ones the existing delivery flow already kept (src/lib/deliveries.ts).
 *
 * The PDF and print layout live on the server (src/server/services/deliveryNotePdf.ts, owned by
 * AI #1); they should draw this structure rather than read the order again.
 */
import type { Delivery } from './deliveries';

export type DeliveryNoteLanguage = 'en' | 'he';

export const DELIVERY_NOTE_LANGUAGES: DeliveryNoteLanguage[] = ['en', 'he'];

export type DeliveryNoteLabels = Record<'title' | 'number' | 'date' | 'customer' | 'order' | 'customerReference' | 'item' | 'quantity' | 'unitPrice' | 'amount' | 'total' | 'receivedBy' | 'receivedDate' | 'noPrices' | 'serials' | 'lot', string>;

export const DELIVERY_NOTE_LABELS: Record<DeliveryNoteLanguage, DeliveryNoteLabels> = {
  en: {
    title: 'Delivery note',
    number: 'Number',
    date: 'Date',
    customer: 'Customer',
    order: 'Order',
    customerReference: 'Your reference',
    item: 'Item',
    quantity: 'Quantity',
    unitPrice: 'Unit price',
    amount: 'Amount',
    total: 'Total',
    receivedBy: 'Received by (name and signature)',
    receivedDate: 'Date received',
    noPrices: 'Goods only; prices are on the invoice.',
    serials: 'Serials',
    lot: 'Lot',
  },
  he: {
    title: 'תעודת משלוח',
    number: 'מספר',
    date: 'תאריך',
    customer: 'לקוח',
    order: 'הזמנה',
    customerReference: 'האסמכתא שלכם',
    item: 'פריט',
    quantity: 'כמות',
    unitPrice: 'מחיר ליחידה',
    amount: 'סכום',
    total: 'סה"כ',
    receivedBy: 'התקבל על ידי (שם וחתימה)',
    receivedDate: 'תאריך קבלה',
    noPrices: 'סחורה בלבד; המחירים מופיעים בחשבונית.',
    serials: 'מספרים סידוריים',
    lot: 'סידרה',
  },
};

/** The prefix of the delivery note series. */
export const DELIVERY_NOTE_PREFIX = 'DN';

const clean = (value: unknown, max = 120) => [...String(value ?? '')]
  .map(ch => { const code = ch.charCodeAt(0); return code < 32 || code === 127 ? ' ' : ch; })
  .join('')
  .trim()
  .slice(0, max);

/**
 * The next number in the delivery note series for a year: DN-2026-001, DN-2026-002 … Numbers
 * from other series or years are ignored. The caller passes every existing delivery note number
 * of the workspace (the series is only as unique as that list is complete).
 */
export function nextDeliveryNoteNumber(existing: string[], year: string): string {
  const prefix = `${DELIVERY_NOTE_PREFIX}-${year}-`;
  const highest = existing.reduce((max, number) => {
    if (!number || !number.startsWith(prefix)) return max;
    const tail = number.slice(prefix.length);
    const n = /^\d{1,9}$/.test(tail) ? Number(tail) : 0;
    return n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

/** The order line a delivery line refers to; the fields the note prints for it. */
export interface DeliveryNoteOrderLine {
  description?: string;
  unitPriceCents?: number;
  measurementUnit?: string;
  /** A-112: the serials and lot this source line recorded (invoice lines only); printed when present */
  serialNumbers?: string[];
  lotNumber?: string;
}

export interface DeliveryNoteOrder {
  id: string;
  number?: string;
  customerName?: string;
  customerReference?: string;
  lines: DeliveryNoteOrderLine[];
}

export interface DeliveryNoteRow {
  /** 1-based line number on the note */
  line: number;
  item: string;
  quantity: number;
  unit: string;
  /** shown only when the note carries prices */
  unitPriceCents?: number;
  amountCents?: number;
  /** A-112: the source line's recorded serials (joined) and lot; absent when none were recorded */
  serials?: string;
  lot?: string;
}

export interface DeliveryNoteDocument {
  language: DeliveryNoteLanguage;
  direction: 'ltr' | 'rtl';
  labels: DeliveryNoteLabels;
  number: string;
  date: string;
  company: string;
  customer: string;
  order: string;
  customerReference: string;
  showPrices: boolean;
  rows: DeliveryNoteRow[];
  /** the sum of the row amounts, when prices are shown; undefined otherwise */
  totalCents?: number;
  /** what the signature line asks for */
  signatureLine: { receivedBy: string; receivedDate: string };
}

export interface DeliveryNoteInput {
  order: DeliveryNoteOrder;
  delivery: Pick<Delivery, 'deliveryId' | 'date' | 'lines'>;
  number: string;
  company?: string;
  language?: DeliveryNoteLanguage;
  /** default false: a delivery note travels with the goods and shows no prices */
  showPrices?: boolean;
}

/**
 * The delivery note for one delivery of an order, or null when the delivery has no lines on that
 * order. Only the quantities the delivery recorded are shown (never the order's full quantity), in
 * the order's own line order. Serials and the lot print only as the source line recorded them:
 * an invoice line's recorded numbers print, while order and delivery lines record none and print
 * none — nothing is ever guessed.
 */
export function buildDeliveryNote(input: DeliveryNoteInput): DeliveryNoteDocument | null {
  const { order, delivery } = input;
  const lines = [...(delivery.lines || [])]
    .filter(l => Number.isInteger(l.position) && l.position >= 0 && l.position < (order.lines || []).length && l.quantity > 0)
    .sort((a, b) => a.position - b.position);
  if (!lines.length) return null;
  const language: DeliveryNoteLanguage = input.language === 'he' ? 'he' : 'en';
  const showPrices = input.showPrices === true;
  const rows: DeliveryNoteRow[] = lines.map((l, index) => {
    const source = order.lines[l.position] || {};
    const unitPriceCents = Number.isSafeInteger(source.unitPriceCents) ? source.unitPriceCents as number : 0;
    const row: DeliveryNoteRow = {
      line: index + 1,
      item: clean(source.description || '', 200) || '—',
      quantity: l.quantity,
      unit: clean(source.measurementUnit || '', 20),
    };
    if (showPrices) {
      row.unitPriceCents = unitPriceCents;
      row.amountCents = Math.round(unitPriceCents * l.quantity);
    }
    // A-112: the source line's recorded serials and lot print as they were recorded; lines that
    // recorded none (order and delivery lines always) print no column.
    const serials = (source.serialNumbers || []).map(serial => String(serial ?? '').trim()).filter(serial => serial);
    if (serials.length) row.serials = clean(serials.join(', '), 200);
    const lot = String(source.lotNumber ?? '').trim();
    if (lot) row.lot = clean(lot, 40);
    return row;
  });
  const totalCents = showPrices ? rows.reduce((sum, r) => sum + (r.amountCents || 0), 0) : undefined;
  const labels = DELIVERY_NOTE_LABELS[language];
  return {
    language,
    direction: language === 'he' ? 'rtl' : 'ltr',
    labels,
    number: clean(input.number, 20),
    date: clean(delivery.date, 10),
    company: clean(input.company || '', 120),
    customer: clean(order.customerName || '', 120),
    order: clean(order.number || order.id, 60),
    customerReference: clean(order.customerReference || '', 60),
    showPrices,
    rows,
    ...(totalCents !== undefined ? { totalCents } : {}),
    signatureLine: { receivedBy: labels.receivedBy, receivedDate: labels.receivedDate },
  };
}

/** The note's columns for the chosen options (prices only when shown; serials/lot only when recorded). */
export function deliveryNoteColumns(showPrices: boolean, language: DeliveryNoteLanguage = 'en', extra: { serials?: boolean; lot?: boolean } = {}): string[] {
  const labels = DELIVERY_NOTE_LABELS[language];
  const base = showPrices
    ? [labels.item, labels.quantity, labels.unitPrice, labels.amount]
    : [labels.item, labels.quantity];
  if (extra.serials) base.push(labels.serials);
  if (extra.lot) base.push(labels.lot);
  return base;
}
