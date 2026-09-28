/**
 * Purchase order rules shared by the screen (PurchaseOrdersView.tsx) and tests: the next order
 * number, and the bill lines an order turns into (BE-11).
 */
import type { Bill, PurchaseOrder } from '../types';
import { formatCurrency } from './utils';

/** What the bill should say: the received quantities when anything was received, else what was ordered. */
export function billLinesFromOrder(po: PurchaseOrder): NonNullable<Bill['splits']> {
  const anyReceived = po.items.some(i => (i.receivedQuantity || 0) > 0);
  return po.items
    .map(item => {
      const qty = anyReceived ? item.receivedQuantity || 0 : item.quantity;
      const detail = qty !== 1 ? ` (${qty} × ${formatCurrency(item.unitPriceCents, po.currency)})` : '';
      return { amountCents: Math.round(qty * item.unitPriceCents), accountId: item.accountId || '', description: `${po.poNumber}: ${item.description}${detail}` };
    })
    .filter(line => line.amountCents !== 0);
}

/** PO-<year>-<nnn>, one more than the highest number used this year. */
export function nextPoNumber(existing: Pick<PurchaseOrder, 'poNumber'>[], year: string): string {
  const prefix = `PO-${year}-`;
  const highest = existing.reduce((max, po) => {
    const n = po.poNumber?.startsWith(prefix) ? Number(po.poNumber.slice(prefix.length)) : 0;
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}
