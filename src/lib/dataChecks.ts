/**
 * Data-health checks (launch step 8; shortcut 11): each check is one entry in DATA_CHECKS with an
 * id, a label and a pure `run` over the workspace's records; the Data Health screen lists the
 * registry and links each finding to its record (Z-32). Adding a check = adding one entry.
 * Money is compared in integer cents with lineAmount() on postable entries (AGENTS.md).
 */
import type { Bill, ChartAccount, Invoice, RecurringTransaction, Transaction } from '../types';
import { isPostable, lineAmount } from './txFilters';
import { calculateAmountDue } from './documentMath';
import type { RecordType } from './recordLinks';

export { RECORD_TABS } from './recordLinks';
export type { RecordType } from './recordLinks';

export type CheckSeverity = 'high' | 'medium' | 'low';

export interface CheckFinding {
  id: string;
  checkId: string;
  severity: CheckSeverity;
  title: string;
  description: string;
  record?: { type: RecordType; id: string };
}

export interface CheckContext {
  transactions: Transaction[];
  accounts: ChartAccount[];
  invoices: Invoice[];
  bills: Bill[];
  recurring: RecurringTransaction[];
  inventory?: Array<{ id: string; name?: string; quantityAtHand?: number }>;
  /** The workspace's today (YYYY-MM-DD). */
  today: string;
  /** Home currency, for documents without one. */
  baseCurrency: string;
}

export interface DataCheck {
  id: string;
  label: string;
  /** What to do about a finding, in one sentence. */
  remedy: string;
  run: (ctx: CheckContext) => CheckFinding[];
}

const ISSUED = new Set(['sent', 'pending', 'approved', 'paid', 'partially_paid', 'overdue']);
const BILL_OPEN = new Set(['pending', 'approved', 'paid', 'partially_paid', 'overdue', 'unpaid']);
const label = (doc: { number?: string; id: string }) => doc.number || doc.id;

/** Groups by key and returns the groups with more than one member. */
function duplicates<T>(items: T[], key: (item: T) => string | null): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) || []), item]);
  }
  return [...groups.values()].filter(g => g.length > 1);
}

export const DATA_CHECKS: DataCheck[] = [
  {
    id: 'unbalanced',
    label: 'Entries whose debits and credits differ',
    remedy: 'Open the entry and correct its lines, or reverse it.',
    run: ({ transactions }) => transactions.filter(isPostable).flatMap(tx => {
      const lines = tx.lines || [];
      if (lines.length === 0) return [];
      const sum = lines.reduce((s, l) => s + lineAmount(l, tx), 0);
      return sum === 0 ? [] : [{
        id: `unbalanced-${tx.id}`, checkId: 'unbalanced', severity: 'high' as const,
        title: `Entry ${tx.description || tx.id} does not balance`,
        description: `Its lines add up to ${sum} cents instead of 0 (${tx.date || 'no date'}).`,
        record: { type: 'transaction' as const, id: tx.id },
      }];
    }),
  },
  {
    id: 'missing-account',
    label: 'Entry lines pointing to an account that no longer exists',
    remedy: 'Move the line to an existing account.',
    run: ({ transactions, accounts }) => {
      const ids = new Set(accounts.map(a => a.id));
      return transactions.filter(isPostable).flatMap(tx => (tx.lines || []).flatMap((l, n) => (l.accountId && !ids.has(l.accountId) ? [{
        id: `missing-account-${tx.id}-${n}`, checkId: 'missing-account', severity: 'high' as const,
        title: `Entry ${tx.description || tx.id} uses a missing account`,
        description: `Line ${n + 1} points to "${l.accountName || l.accountId}", which is not in the chart of accounts.`,
        record: { type: 'transaction' as const, id: tx.id },
      }] : [])));
    },
  },
  {
    id: 'duplicate-invoice-number',
    label: 'Two invoices with the same number (Z-07)',
    remedy: 'Give one of them a new number, or void the duplicate.',
    run: ({ invoices }) => duplicates(invoices.filter(i => i.status !== 'void' && i.status !== 'draft'), i => (i.number ? i.number.trim().toLowerCase() : null))
      .map(group => ({
        id: `dup-invoice-${group[0].number}`, checkId: 'duplicate-invoice-number', severity: 'medium' as const,
        title: `Invoice number ${group[0].number} is used ${group.length} times`,
        description: `Customers: ${group.map(i => i.customerName || i.customerId).join(', ')}.`,
        record: { type: 'invoice' as const, id: group[1].id },
      })),
  },
  {
    id: 'duplicate-bill',
    label: 'The same vendor bill entered twice (Z-08)',
    remedy: 'Check both bills; void the one entered by mistake.',
    run: ({ bills }) => duplicates(bills.filter(b => b.status !== 'void' && b.status !== 'draft'), b => (b.number ? `${b.vendorId}|${b.number.trim().toLowerCase()}` : null))
      .map(group => ({
        id: `dup-bill-${group[0].vendorId}-${group[0].number}`, checkId: 'duplicate-bill', severity: 'high' as const,
        title: `Bill ${group[0].number} from ${group[0].vendorName || 'the same vendor'} is entered ${group.length} times`,
        description: `Amounts: ${group.map(b => b.amountCents).join(', ')} cents. Paying both would pay the vendor twice.`,
        record: { type: 'bill' as const, id: group[1].id },
      })),
  },
  {
    id: 'future-dated',
    label: 'Entries dated in the future (Z-10)',
    remedy: 'Check the date; future dates are usually typing mistakes.',
    run: ({ transactions, today }) => {
      const limit = today;
      return transactions.filter(tx => isPostable(tx) && typeof tx.date === 'string' && tx.date.slice(0, 10) > limit && !tx.metadata?.scheduled)
        .map(tx => ({
          id: `future-${tx.id}`, checkId: 'future-dated', severity: 'low' as const,
          title: `Entry dated ${tx.date.slice(0, 10)}`,
          description: `${tx.description || tx.id} is dated after today.`,
          record: { type: 'transaction' as const, id: tx.id },
        }));
    },
  },
  {
    id: 'empty-invoice',
    label: 'Issued invoices with no amount, no lines, or lines without an account (Z-14)',
    remedy: 'Add the missing lines or accounts, or void the invoice.',
    run: ({ invoices }) => invoices.filter(i => ISSUED.has(i.status)).flatMap(inv => {
      const items = inv.items || [];
      const problems: string[] = [];
      if (!(inv.amountCents > 0)) problems.push('its total is zero');
      if (items.length === 0) problems.push('it has no lines');
      const noAccount = items.filter(it => (it.amountCents || 0) !== 0 && !it.accountId).length;
      if (noAccount > 0) problems.push(`${noAccount} line(s) have no income account (posted to the default one)`);
      return problems.length === 0 ? [] : [{
        id: `empty-invoice-${inv.id}`, checkId: 'empty-invoice', severity: inv.amountCents > 0 ? 'low' as const : 'medium' as const,
        title: `Invoice ${label(inv)}: ${problems[0]}`,
        description: problems.join('; ') + '.',
        record: { type: 'invoice' as const, id: inv.id },
      }];
    }),
  },
  {
    id: 'overpaid',
    label: 'Invoices and bills paid more than their total',
    remedy: 'Check the payments; refund or keep the extra as a credit.',
    run: ({ invoices, bills }) => [
      ...invoices.map(d => ({ d, type: 'invoice' as const })),
      ...bills.map(d => ({ d, type: 'bill' as const })),
    ].filter(({ d }) => (d.amountPaidCents || 0) > (d.amountCents || 0)).map(({ d, type }) => ({
      id: `overpaid-${type}-${d.id}`, checkId: 'overpaid', severity: 'medium' as const,
      title: `${type === 'invoice' ? 'Invoice' : 'Bill'} ${label(d)} is overpaid`,
      description: `Paid ${d.amountPaidCents} cents on a total of ${d.amountCents} cents.`,
      record: { type, id: d.id },
    })),
  },
  {
    id: 'foreign-without-rate',
    label: 'Documents in another currency without an exchange rate (Z-15)',
    remedy: 'Set the exchange rate on the document so it is booked at the right amount.',
    run: ({ invoices, bills, baseCurrency }) => [
      ...invoices.map(d => ({ d, type: 'invoice' as const })),
      ...bills.map(d => ({ d, type: 'bill' as const })),
    ].filter(({ d }) => d.currency && d.currency !== baseCurrency && !(Number(d.exchangeRate) > 0 && d.exchangeRate !== 1) && d.status !== 'draft' && d.status !== 'void')
      .map(({ d, type }) => ({
        id: `fx-${type}-${d.id}`, checkId: 'foreign-without-rate', severity: 'high' as const,
        title: `${type === 'invoice' ? 'Invoice' : 'Bill'} ${label(d)} is in ${d.currency} at rate 1`,
        description: `It is booked as if 1 ${d.currency} = 1 ${baseCurrency}.`,
        record: { type, id: d.id },
      })),
  },
  {
    id: 'negative-stock',
    label: 'Items with negative stock (Z-09)',
    remedy: 'Record the missing purchase or correct the stock count.',
    run: ({ inventory }) => (inventory || []).filter(i => (i.quantityAtHand || 0) < 0).map(i => ({
      id: `negative-stock-${i.id}`, checkId: 'negative-stock', severity: 'medium' as const,
      title: `${i.name || i.id}: ${i.quantityAtHand} in stock`,
      description: 'More was sold than was bought or counted.',
      record: { type: 'item' as const, id: i.id },
    })),
  },
  {
    id: 'recurring-problem',
    label: 'Recurring schedules that could not run',
    remedy: 'Open the schedule and fix what it says, or pause it.',
    run: ({ recurring }) => recurring.filter(r => r.isActive && r.lastErrorCode).map(r => ({
      id: `recurring-${r.id}`, checkId: 'recurring-problem', severity: 'medium' as const,
      title: `Recurring "${r.description}" could not run`,
      description: String(r.lastErrorCode),
      record: { type: 'recurring' as const, id: r.id },
    })),
  },
  {
    id: 'stale-receivable',
    label: 'Invoices unpaid for more than 180 days',
    remedy: 'Chase the customer, or write the invoice off as bad debt.',
    run: ({ invoices, today }) => invoices.filter(i => ISSUED.has(i.status) && i.dueDate && calculateAmountDue(i) > 0 && i.dueDate.slice(0, 10) < shiftDays(today, -180))
      .map(i => ({
        id: `stale-${i.id}`, checkId: 'stale-receivable', severity: 'low' as const,
        title: `Invoice ${label(i)} is more than 180 days overdue`,
        description: `Due ${i.dueDate.slice(0, 10)}; ${calculateAmountDue(i)} cents still due.`,
        record: { type: 'invoice' as const, id: i.id },
      })),
  },
];

function shiftDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function runDataChecks(ctx: CheckContext, checks: DataCheck[] = DATA_CHECKS): CheckFinding[] {
  const order: Record<CheckSeverity, number> = { high: 0, medium: 1, low: 2 };
  return checks.flatMap(check => check.run(ctx)).sort((a, b) => order[a.severity] - order[b.severity]);
}
