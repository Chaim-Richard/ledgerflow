import type { InventoryItem, Invoice } from '../types';
import { INVOICE_IS_ISSUED } from '../server/reports/computeReports';
import { isOpeningBalanceDocument } from './partyOpeningBalance';
import { listForCustomer, listPrice, priceListsProblem, type PriceList } from './priceLists';
import { validCustomReportPeriod } from './reportCustomPeriod';
export interface DiscountMismatchRow {
  invoiceId: string; line: number; number: string; date: string; customer: string; item: string;
  currency: string; actualCents: number; expectedCents: number; differenceCents: number; source: string;
}
/** Current-price review only. Neither historical entitlement nor document-wide discount allocation. */
export function discountMismatches(input: { invoices: Invoice[]; items: InventoryItem[]; lists: PriceList[]; workspaceId: string; currency: string; startDate: string; endDate: string }) {
  if (!validCustomReportPeriod(input)) throw new Error('Choose a valid report period.');
  const problem = priceListsProblem(input.lists); if (problem) throw new Error(problem);
  const items = new Map(input.items.filter(item => item.workspaceId === input.workspaceId).map(item => [item.id, item]));
  const rows: DiscountMismatchRow[] = []; let uncomparableLines = 0;
  for (const invoice of input.invoices) {
    const date = (invoice.date || '').slice(0,10);
    if (invoice.workspaceId !== input.workspaceId || !INVOICE_IS_ISSUED.has(invoice.status) || isOpeningBalanceDocument(invoice) || !date || date < input.startDate || date > input.endDate) continue;
    const list = listForCustomer(input.lists, invoice.customerId), currency = invoice.currency || input.currency;
    (invoice.items || []).forEach((line, index) => {
      const item = line.itemId ? items.get(line.itemId) : undefined;
      if (!item || currency !== input.currency || !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0 || !Number.isSafeInteger(line.rateCents) || line.rateCents < 0) { uncomparableLines++; return; }
      const expected = list ? listPrice(list, item) : item.unitPriceCents;
      if (!Number.isSafeInteger(expected) || expected < 0) { uncomparableLines++; return; }
      if (line.rateCents === expected) return;
      rows.push({ invoiceId: invoice.id, line: index, number: invoice.number || invoice.id, date, customer: invoice.customerName || invoice.customerId || 'No customer', item: item.name, currency,
        actualCents: line.rateCents, expectedCents: expected, differenceCents: line.rateCents - expected,
        source: list ? `Current price list: ${list.name}` : 'Current item price' });
    });
  }
  return { rows: rows.sort((a,b)=>a.date.localeCompare(b.date)||a.number.localeCompare(b.number)||a.line-b.line), uncomparableLines };
}
