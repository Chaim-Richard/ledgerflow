/**
 * A-69: customer credit limits. A customer can carry a limit the business will sell up to on credit,
 * and the report shows who is past it before the next invoice goes out.
 *
 * Where the limit lives: the customer's own record, in `metadata.creditLimitCents` — an integer in
 * whole minor units, in the workspace's base currency. It is a field of the customer, so it travels
 * with the record, and it is read here and never invented: a customer with no recorded limit is
 * "not limited", never assumed to be at zero.
 *
 * What the exposure is: the unpaid part of each **issued** invoice (amount less what has been paid or
 * written off). Drafts, void and cancelled invoices are not sales, so they are left out; a credit
 * note or refund is already reflected in what is paid, so nothing is subtracted twice. Invoices are
 * compared only inside one currency: the limit is compared with the customer's own base-currency
 * exposure, and anything in another currency is listed separately and never added in or converted.
 *
 * What it is not: a credit decision, a bureau score or a posting. A limit breach is a reason to look
 * before selling more; a person decides, and nothing here changes an amount.
 *
 * Pure: no storage, no fetching, no clock.
 */
import type { Customer, Invoice } from '../types';

export const CREDIT_LIMIT_METADATA_KEY = 'creditLimitCents';

export interface CreditLimitCustomer extends Pick<Customer, 'id' | 'name'> {
  metadata?: Record<string, unknown> | null;
  currency?: string;
}

export interface CreditLimitInvoice extends Pick<Invoice, 'id' | 'customerId'> {
  number?: string;
  date?: string;
  dueDate?: string;
  amountCents?: number;
  amountPaidCents?: number;
  writtenOffCents?: number;
  status?: string;
  currency?: string;
}

export interface CreditLimitRow {
  customerId: string;
  name: string;
  /** the recorded limit, when there is one */
  limitCents?: number;
  /** what the customer owes in the workspace's base currency */
  openCents: number;
  /** the part of the open balance already past its due date on the as-of date */
  overdueCents: number;
  /** limit − open, only when a limit is recorded; negative means over it */
  headroomCents?: number;
  /** open ÷ limit in percent to two decimals; undefined without a limit or with a zero limit */
  utilizationPct?: number;
  /** what the customer owes in each other currency: never added to openCents, never converted */
  otherCurrencies: Array<{ currency: string; openCents: number }>;
  invoices: number;
  openInvoices: number;
  oldestDueDate?: string;
  /** over-limit customers first (worst excess first), then by exposure */
  state: 'over' | 'within' | 'not-limited';
}

export interface CustomerCreditLimitsInput {
  customers: CreditLimitCustomer[];
  invoices: CreditLimitInvoice[];
  /** the workspace's base currency; the limit is stated in it */
  homeCurrency?: string;
  /** the date overdue is measured on (YYYY-MM-DD); omitted means no overdue is computed */
  asOfDate?: string;
}

/** The issued statuses: an invoice that is a sale. */
const ISSUED = new Set(['pending', 'paid', 'partially_paid', 'overdue', 'unpaid', 'sent', 'approved', 'invoiced']);

/** A whole, non-negative number of minor units, or nothing (a corrupt value is not a limit). */
export function creditLimitOf(customer: CreditLimitCustomer): number | undefined {
  const raw = (customer.metadata || {})[CREDIT_LIMIT_METADATA_KEY];
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : undefined;
}

/** What is still owed on one invoice: the issued amount less paid and written off, never below zero. */
export function openBalanceCents(invoice: CreditLimitInvoice): number {
  if (!ISSUED.has(String(invoice.status))) return 0;
  const owed = (invoice.amountCents || 0) - (invoice.amountPaidCents || 0) - (invoice.writtenOffCents || 0);
  return owed > 0 ? owed : 0;
}

export function customerCreditLimits(input: CustomerCreditLimitsInput): CreditLimitRow[] {
  const home = input.homeCurrency || 'USD';
  const byCustomer = new Map<string, CreditLimitRow & { currencies: Map<string, number> }>();
  for (const customer of input.customers) {
    const limitCents = creditLimitOf(customer);
    byCustomer.set(customer.id, {
      customerId: customer.id,
      name: customer.name,
      ...(limitCents !== undefined ? { limitCents } : {}),
      openCents: 0, overdueCents: 0, otherCurrencies: [], invoices: 0, openInvoices: 0,
      state: limitCents !== undefined ? 'within' : 'not-limited',
      currencies: new Map<string, number>(),
    });
  }

  for (const invoice of input.invoices) {
    const row = invoice.customerId ? byCustomer.get(invoice.customerId) : undefined;
    if (!row) continue;
    if (!ISSUED.has(String(invoice.status))) continue;
    row.invoices += 1;
    const open = openBalanceCents(invoice);
    if (open <= 0) continue;
    row.openInvoices += 1;
    const currency = invoice.currency || home;
    row.currencies.set(currency, (row.currencies.get(currency) || 0) + open);
    if (currency === home) {
      row.openCents += open;
      const due = (invoice.dueDate || invoice.date || '').slice(0, 10);
      if (input.asOfDate && due && due < input.asOfDate) row.overdueCents += open;
      if (due && (!row.oldestDueDate || due < row.oldestDueDate)) row.oldestDueDate = due;
    }
  }

  return [...byCustomer.values()]
    .map(({ currencies, ...row }) => {
      const otherCurrencies = [...currencies.entries()]
        .filter(([currency]) => currency !== home)
        .map(([currency, openCents]) => ({ currency, openCents }))
        .sort((a, b) => a.currency.localeCompare(b.currency));
      if (row.limitCents === undefined) return { ...row, otherCurrencies, state: 'not-limited' as const };
      const headroomCents = row.limitCents - row.openCents;
      const utilizationPct = row.limitCents > 0 ? Math.round((row.openCents / row.limitCents) * 10000) / 100 : undefined;
      return {
        ...row, otherCurrencies, headroomCents,
        ...(utilizationPct !== undefined ? { utilizationPct } : {}),
        state: row.openCents > row.limitCents ? ('over' as const) : ('within' as const),
      };
    })
    .filter(row => row.limitCents !== undefined || row.openCents > 0 || row.otherCurrencies.length > 0)
    .sort((a, b) =>
      (a.state === 'over' ? 0 : 1) - (b.state === 'over' ? 0 : 1)
      || (a.state === 'over' && b.state === 'over' ? a.headroomCents! - b.headroomCents! : 0)
      || b.openCents - a.openCents
      || a.name.localeCompare(b.name));
}

export const CREDIT_LIMITS_CSV_HEADERS = [
  'Customer', 'State', 'Currency', 'Limit (minor units)', 'Open balance (minor units)', 'Overdue (minor units)',
  'Headroom (minor units)', 'Utilisation (%)', 'Open invoices', 'Invoices', 'Oldest due date',
  'Other currencies', 'Other currency open (minor units)',
];

/** One CSV row per customer and other currency, so a foreign balance is never summed into the limit. */
export function customerCreditLimitsCsvRows(rows: CreditLimitRow[], homeCurrency = 'USD'): Array<Array<string | number>> {
  return rows.flatMap(row => {
    const base = [
      row.name, row.state, homeCurrency, row.limitCents ?? '', row.openCents, row.overdueCents,
      row.headroomCents ?? '', row.utilizationPct ?? '', row.openInvoices, row.invoices, row.oldestDueDate || '',
    ];
    if (!row.otherCurrencies.length) return [[...base, '', '']];
    return row.otherCurrencies.map(currency => [...base, currency.currency, currency.openCents]);
  });
}
