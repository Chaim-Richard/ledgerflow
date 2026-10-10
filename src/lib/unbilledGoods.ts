/**
 * Goods not yet billed (CB-18, CB-19): what left or came in before its invoice or bill.
 * - Delivered, not invoiced: for each sales order line, the units delivered and kept (deliveries less
 *   returns, from the delivery entries in force) above the units invoiced from the order, valued at
 *   the order's price.
 * - Received, not billed: for each purchase order without a bill, the units received, valued at the
 *   order's price.
 * Both are read from what the books already hold, so they agree with the order screens.
 */
import type { Estimate, Invoice, PurchaseOrder, Transaction } from '../types';
import { deliveredByLine } from './deliveries';
import { isOrder, orderLineProgress, orderProgress } from './salesOrders';

export interface DeliveredNotInvoiced {
  orderId: string;
  number: string;
  customerName: string;
  currency?: string;
  description: string;
  delivered: number;
  invoiced: number;
  units: number;
  valueCents: number;
}

export interface ReceivedNotBilled {
  orderId: string;
  number: string;
  vendorName: string;
  currency?: string;
  description: string;
  received: number;
  valueCents: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const CLOSED_ESTIMATE = new Set(['void', 'cancelled', 'declined', 'rejected']);

export function deliveredNotInvoiced(orders: Estimate[], invoices: Invoice[], entries: Transaction[]): DeliveredNotInvoiced[] {
  const rows: DeliveredNotInvoiced[] = [];
  for (const order of orders) {
    if (!isOrder(order) || CLOSED_ESTIMATE.has(String(order.status))) continue;
    const delivered = deliveredByLine(entries, order.id);
    if (delivered.size === 0) continue;
    for (const line of orderLineProgress(order, orderProgress(order, invoices))) {
      const done = delivered.get(line.position) || 0;
      const units = round2(done - line.invoicedQuantity);
      if (units <= 0) continue;
      rows.push({
        orderId: order.id, number: String(order.number || order.id), customerName: String(order.customerName || ''),
        description: line.description, delivered: done, invoiced: line.invoicedQuantity, units, valueCents: Math.round(units * line.unitPriceCents),
      });
    }
  }
  return rows;
}

export function receivedNotBilled(orders: PurchaseOrder[]): ReceivedNotBilled[] {
  return orders
    .filter(po => !po.billId && po.status !== 'billed' && po.status !== 'cancelled')
    .flatMap(po => po.items
      .filter(item => (item.receivedQuantity || 0) > 0)
      .map(item => ({
        orderId: po.id, number: po.poNumber, vendorName: po.vendorName || '', currency: po.currency,
        description: item.description, received: item.receivedQuantity || 0, valueCents: Math.round((item.receivedQuantity || 0) * item.unitPriceCents),
      })));
}

/** Totals by currency (a row without one is in the workspace's). */
export function totalsByCurrency(rows: Array<{ currency?: string; valueCents: number }>, home: string): Array<{ currency: string; cents: number }> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency || home, (totals.get(r.currency || home) || 0) + r.valueCents);
  return [...totals].map(([currency, cents]) => ({ currency, cents }));
}
