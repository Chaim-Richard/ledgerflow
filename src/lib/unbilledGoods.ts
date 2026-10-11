/**
 * Goods not yet billed (CB-18, CB-19): what left or came in before its invoice or bill.
 * - Delivered, not invoiced: for each sales order line, the units delivered and kept (deliveries less
 *   returns, from the delivery entries in force) above the units invoiced from the order, valued at
 *   the order's price.
 * - Received, not billed: for each purchase order without a bill, the units received, valued at the
 *   order's price.
 * - Billed, not received (CB-17): for each purchase order line, the units its bills say they bill
 *   (bills made from the order keep the order line and units) above the units received.
 * They are read from what the books already hold, so they agree with the order screens.
 */
import type { Bill, Estimate, Invoice, PurchaseOrder, Transaction } from '../types';
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
  /** the order's date: the age of the row is counted from it */
  issueDate: string;
  currency?: string;
  description: string;
  /** units received on this line */
  received: number;
  /** units received and not yet on a bill (received less billed on this line) */
  units: number;
  valueCents: number;
}

export interface OrderedNotReceived {
  orderId: string;
  number: string;
  vendorName: string;
  issueDate: string;
  currency?: string;
  description: string;
  ordered: number;
  received: number;
  /** units ordered and not yet received */
  units: number;
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

const NOT_COUNTED_BILL = new Set(['void', 'draft', 'cancelled', 'rejected']);

/** The bills that bill an order: the ones made from it (metadata.poId) or linked by billId. */
function billsOfOrder(po: PurchaseOrder, bills: Bill[]): Bill[] {
  return bills.filter(b => !NOT_COUNTED_BILL.has(String(b.status)) && ((b.metadata as { poId?: string } | undefined)?.poId === po.id || b.id === po.billId));
}

/** Units billed on one order line, from the bills' splits that point at that line (BE-11, A-14). */
function billedOnLine(bills: Bill[], line: number): number {
  return round2(bills.flatMap(b => b.splits || []).filter(s => s.orderLine === line).reduce((s, x) => s + (Number(x.orderQuantity) || 0), 0));
}

/**
 * Received, not billed (CB-18, A-14): per order line, the units received above the units its bills
 * bill. An order received in full and billed half still lists the other half. Billed and cancelled
 * orders are not listed. `bills` is optional: without them every received unit counts.
 */
export function receivedNotBilled(orders: PurchaseOrder[], bills: Bill[] = []): ReceivedNotBilled[] {
  return orders
    .filter(po => po.status !== 'billed' && po.status !== 'cancelled')
    .flatMap(po => {
      const mine = billsOfOrder(po, bills);
      return po.items.flatMap((item, line) => {
        const received = item.receivedQuantity || 0;
        const units = round2(received - billedOnLine(mine, line));
        if (received <= 0 || units <= 0) return [];
        return [{
          orderId: po.id, number: po.poNumber, vendorName: po.vendorName || '', issueDate: po.issueDate, currency: po.currency,
          description: item.description, received, units, valueCents: Math.round(units * item.unitPriceCents),
        }];
      });
    });
}

/**
 * Ordered, not received (A-14): per order line, the units ordered above the units received, at the
 * order's price. Billed, cancelled and closed orders are not listed.
 */
export function orderedNotReceived(orders: PurchaseOrder[]): OrderedNotReceived[] {
  return orders
    .filter(po => po.status !== 'billed' && po.status !== 'cancelled' && po.status !== 'closed')
    .flatMap(po => po.items.flatMap(item => {
      const received = item.receivedQuantity || 0;
      const units = round2(item.quantity - received);
      if (units <= 0) return [];
      return [{
        orderId: po.id, number: po.poNumber, vendorName: po.vendorName || '', issueDate: po.issueDate, currency: po.currency,
        description: item.description, ordered: item.quantity, received, units, valueCents: Math.round(units * item.unitPriceCents),
      }];
    }));
}

/** Whole days from the order date to the day shown; null when either is not a day. */
export function ageInDays(issueDate: string | undefined, asOf: string): number | null {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!issueDate || !day.test(issueDate) || !day.test(asOf)) return null;
  return Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${issueDate}T00:00:00Z`)) / 86_400_000);
}

export interface BilledNotReceived {
  orderId: string;
  number: string;
  vendorName: string;
  currency?: string;
  description: string;
  billed: number;
  received: number;
  units: number;
  valueCents: number;
}

export function billedNotReceived(orders: PurchaseOrder[], bills: Bill[]): BilledNotReceived[] {
  return orders.filter(po => po.status !== 'cancelled').flatMap(po => {
    const mine = billsOfOrder(po, bills);
    return po.items.flatMap((item, line) => {
      const billed = billedOnLine(mine, line);
      const received = item.receivedQuantity || 0;
      const units = round2(billed - received);
      if (units <= 0) return [];
      return [{ orderId: po.id, number: po.poNumber, vendorName: po.vendorName || '', currency: po.currency, description: item.description, billed, received, units, valueCents: Math.round(units * item.unitPriceCents) }];
    });
  });
}

/** Totals by currency (a row without one is in the workspace's). */
export function totalsByCurrency(rows: Array<{ currency?: string; valueCents: number }>, home: string): Array<{ currency: string; cents: number }> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency || home, (totals.get(r.currency || home) || 0) + r.valueCents);
  return [...totals].map(([currency, cents]) => ({ currency, cents }));
}
