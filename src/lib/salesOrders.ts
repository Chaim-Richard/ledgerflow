/**
 * Sales orders (K-04): an estimate the customer said yes to becomes an order, and the order is
 * invoiced in one go or in parts (a percentage, an amount, or the rest). How much is invoiced is
 * read from the invoices made from it (`metadata.convertedFromEstimateId`, voided ones not
 * counted), so there is no second running total that could disagree with the invoices.
 */
import type { Estimate, Invoice } from '../types';
import { convertEstimateToInvoice } from './estimateConverter';

export type OrderPart = { mode: 'rest' } | { mode: 'percent'; percent: number } | { mode: 'amount'; cents: number };

export type OrderStage = 'quote' | 'declined' | 'expired' | 'order' | 'partly invoiced' | 'invoiced';

export interface OrderProgress {
  totalCents: number;
  invoicedCents: number;
  leftCents: number;
  /** the invoices made from it, oldest first (voided and cancelled ones left out) */
  invoices: Invoice[];
}

const NOT_COUNTED = new Set(['void', 'cancelled']);

export const isOrder = (est: Pick<Estimate, 'orderedAt'>) => Boolean(est.orderedAt);

/** What has been invoiced from an estimate or order so far, and what is left. */
export function orderProgress(est: Estimate, invoices: Invoice[]): OrderProgress {
  const made = invoices
    .filter(inv => inv.metadata?.convertedFromEstimateId === est.id && !NOT_COUNTED.has(String(inv.status)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const totalCents = Math.round(Number(est.amountCents) || 0);
  const invoicedCents = made.reduce((sum, inv) => sum + Math.round(Number(inv.amountCents) || 0), 0);
  return { totalCents, invoicedCents, leftCents: Math.max(0, totalCents - invoicedCents), invoices: made };
}

/** Where an estimate stands, in the words the list shows. */
export function orderStage(est: Estimate, progress: OrderProgress): OrderStage {
  if (est.status === 'declined') return 'declined';
  if (!isOrder(est)) return est.status === 'converted' ? 'invoiced' : est.status === 'expired' ? 'expired' : 'quote';
  if (progress.totalCents > 0 && progress.invoicedCents >= progress.totalCents) return 'invoiced';
  return progress.invoicedCents > 0 ? 'partly invoiced' : 'order';
}

/** The amount a part stands for, in cents. */
export function partCents(part: OrderPart, progress: OrderProgress): number {
  if (part.mode === 'rest') return progress.leftCents;
  if (part.mode === 'percent') return Math.round(progress.totalCents * part.percent / 100);
  return Math.round(part.cents);
}

/** Why this part can't be invoiced, or null. */
export function partProblem(part: OrderPart, progress: OrderProgress): string | null {
  if (progress.leftCents <= 0) return 'Nothing is left to invoice on this order';
  if (part.mode === 'percent' && !(Number.isFinite(part.percent) && part.percent > 0 && part.percent <= 100)) return 'Enter a percentage between 0 and 100';
  if (part.mode === 'amount' && !(Number.isFinite(part.cents) && part.cents > 0)) return 'Enter an amount above zero';
  const cents = partCents(part, progress);
  if (cents <= 0) return 'Enter an amount above zero';
  if (cents > progress.leftCents) return 'That is more than is left to invoice';
  return null;
}

function orderLines(est: Estimate) {
  return est.lines?.length
    ? est.lines
    : [{ description: `Estimate ${est.number || ''}`.trim(), quantity: 1, unitPriceCents: est.amountCents, amountCents: est.amountCents }];
}

/** Each line's share once `cumulative` of the order is invoiced: proportional, whole cents, the remainder on the last line. */
function allocate(amounts: number[], total: number, cumulative: number): number[] {
  if (total <= 0 || cumulative >= total) return amounts.slice();
  const shares = amounts.map(a => Math.round(a * cumulative / total));
  shares[shares.length - 1] = cumulative - shares.slice(0, -1).reduce((s, x) => s + x, 0);
  return shares;
}

/**
 * The draft invoice for one part of an order (without id, uid and workspace, which saving sets).
 * Each order line gets its share of the part, so once everything is invoiced every line has been
 * invoiced exactly; a line invoiced whole keeps its quantity and price.
 */
export function orderPartInvoice(est: Estimate, progress: OrderProgress, cents: number, label: string): Omit<Invoice, 'id' | 'uid' | 'workspaceId'> {
  const lines = orderLines(est);
  const amounts = lines.map(l => Math.round(Number(l.amountCents) || (l.quantity || 1) * (l.unitPriceCents || 0)));
  const before = allocate(amounts, progress.totalCents, progress.invoicedCents);
  const after = allocate(amounts, progress.totalCents, progress.invoicedCents + cents);
  const part = progress.invoices.length + 1;
  const items = lines.map((line, i) => {
    const share = after[i] - before[i];
    const whole = share === amounts[i] && before[i] === 0;
    return {
      id: `${est.id}-${part}-${i}`,
      description: whole ? line.description || '' : `${line.description || 'Order line'} (${label})`,
      quantity: whole ? line.quantity || 1 : 1,
      rateCents: whole ? line.unitPriceCents || 0 : share,
      amountCents: share,
      // no account picked: posting uses the workspace's income account
      accountId: '',
    };
  }).filter(item => item.amountCents !== 0);
  const { id: _id, uid: _uid, workspaceId: _ws, ...base } = convertEstimateToInvoice(est);
  return {
    ...base,
    amountCents: cents,
    items,
    metadata: { convertedFromEstimateId: est.id, convertedFromEstimateNumber: est.number || est.id, salesOrderPart: part },
  };
}

/** The words on a part's lines: "40% of order EST-0012" or "part 2 of order EST-0012". */
export function partLabel(part: OrderPart, est: Estimate, progress: OrderProgress): string {
  const order = `order ${est.number || ''}`.trim();
  if (part.mode === 'percent') return `${part.percent}% of ${order}`;
  if (part.mode === 'rest' && progress.invoices.length > 0) return `rest of ${order}`;
  return `part ${progress.invoices.length + 1} of ${order}`;
}
