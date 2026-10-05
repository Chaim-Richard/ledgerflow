/**
 * A customer's or vendor's opening balance (BA-02): what they owed you (or you owed them) on the
 * day the books start, entered as one open invoice (bill) booked against Opening Balance Equity.
 * It then shows in aging, statements and the contact's balance, and is paid like any other.
 */
import type { Bill, Invoice } from '../types';

export const OPENING_DOCUMENT_TYPE = 'opening-balance';

export function isOpeningBalanceDocument(doc: { metadata?: Record<string, unknown> | null }): boolean {
  return doc.metadata?.type === OPENING_DOCUMENT_TYPE;
}

interface Party { id: string; name: string }
interface Equity { id: string; name: string }

/** The opening-balance invoice (customer) or bill (vendor); amounts in whole cents above zero. */
export function openingBalanceDocument(side: 'customer', party: Party, equity: Equity, amountCents: number, date: string, currency?: string): Partial<Invoice>;
export function openingBalanceDocument(side: 'vendor', party: Party, equity: Equity, amountCents: number, date: string, currency?: string): Partial<Bill>;
export function openingBalanceDocument(side: 'customer' | 'vendor', party: Party, equity: Equity, amountCents: number, date: string, currency?: string): Partial<Invoice> | Partial<Bill> {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Enter an amount above 0');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Enter the date the books start');
  const common = {
    number: `OB-${party.id.slice(0, 6).toUpperCase()}`,
    amountCents,
    date,
    dueDate: date,
    ...(currency ? { currency } : {}),
    exchangeRate: 1,
    metadata: { type: OPENING_DOCUMENT_TYPE },
  };
  if (side === 'customer') {
    return {
      ...common, customerId: party.id, customerName: party.name, status: 'sent',
      items: [{ id: 'opening', description: 'Opening balance', quantity: 1, rateCents: amountCents, amountCents, accountId: equity.id }],
    };
  }
  return {
    ...common, vendorId: party.id, vendorName: party.name, status: 'pending',
    splits: [{ accountId: equity.id, amountCents, description: 'Opening balance' }],
  };
}
