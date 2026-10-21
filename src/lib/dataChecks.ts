/**
 * Data-health checks (launch step 8; shortcut 11): each check is one entry in DATA_CHECKS with an
 * id, a label and a pure `run` over the workspace's records; the Data Health screen lists the
 * registry and links each finding to its record (Z-32). Adding a check = adding one entry.
 * Money is compared in integer cents with lineAmount() on postable entries (AGENTS.md).
 */
import type { BankStatementLine, Bill, ChartAccount, DimensionDefinition, Invoice, RecurringTransaction, Transaction } from '../types';
import { isPostable, lineAmount } from './txFilters';
import { calculateAmountDue } from './documentMath';
import { findTaxDifferences } from './taxRecompute';
import { missingLabels } from './requiredLabels';
import { labelRoleFindings } from './labelRoles';
import { stockHistoryProblem, type StockMove } from './stockMoves';
import { formatCurrency } from './utils';
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
  bankLines?: BankStatementLine[];
  /** The workspace's today (YYYY-MM-DD). */
  today: string;
  /** Home currency, for documents without one. */
  baseCurrency: string;
  /** The workspace's labels, with their required-label rules (Z-12). */
  dimensions?: DimensionDefinition[];
  /** The stock-moves ledger (W-02); the nightly check reads it, the browser does not load it. */
  stockMoves?: StockMove[];
  /** Payment records (CB-23: each has its entry in the ledger). */
  payments?: Array<{ id: string; number?: string; status?: string; amountCents?: number; exchangeRate?: number; paymentExchangeRate?: number; paymentDate?: string; date?: string; contactName?: string; entityName?: string }>;
}

export interface DataCheck {
  id: string;
  label: string;
  /** What to do about a finding, in one sentence. */
  remedy: string;
  run: (ctx: CheckContext) => CheckFinding[];
}

const ISSUED = new Set(['sent', 'pending', 'approved', 'paid', 'partially_paid', 'overdue']);
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
      // balanced in the entry's own currency (the server's rule) or after each line's own rate.
      // Only the converted sum used to count, and rounding each converted line makes balanced
      // foreign entries look a cent off (+5.5 → 6, −5.5 → −5; see L-164).
      const sum = lines.reduce((s, l) => s + (l.amountCents || 0), 0);
      if (sum === 0 || lines.reduce((s, l) => s + lineAmount(l, tx), 0) === 0) return [];
      return [{
        id: `unbalanced-${tx.id}`, checkId: 'unbalanced', severity: 'high' as const,
        title: `Entry ${tx.description || tx.id} does not balance`,
        description: `Its debits exceed its credits by ${formatCurrency(sum, tx.currency)} (${tx.date || 'no date'}).`,
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
        description: `Amounts: ${group.map(b => formatCurrency(b.amountCents, b.currency)).join(', ')}. Paying both would pay the vendor twice.`,
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
      description: `Paid ${formatCurrency(d.amountPaidCents, d.currency)} on a total of ${formatCurrency(d.amountCents, d.currency)}.`,
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
        description: `Due ${i.dueDate.slice(0, 10)}; ${formatCurrency(calculateAmountDue(i), i.currency)} still due.`,
        record: { type: 'invoice' as const, id: i.id },
      })),
  },
  {
    id: 'tax-posting',
    label: 'Tax in the ledger differs from the document',
    remedy: 'Repost the document (Month-end close → Postings), or have the owner run the tax recompute, which posts an adjusting entry.',
    run: ({ invoices, bills, transactions, baseCurrency }) => findTaxDifferences({ invoices, bills, transactions }).map(d => ({
      id: `tax-${d.id}`, checkId: 'tax-posting', severity: 'medium' as const,
      title: `${d.kind === 'invoice' ? 'Invoice' : 'Bill'} ${d.number}: tax in the ledger is ${formatCurrency(d.postedTaxCents, baseCurrency)}, the document says ${formatCurrency(d.expectedTaxCents, baseCurrency)}`,
      description: `${d.party ? `${d.party}. ` : ''}Difference ${formatCurrency(d.differenceCents, baseCurrency)} (home currency).`,
      record: { type: d.kind, id: d.id },
    })),
  },
  {
    id: 'suspense-balance',
    label: 'Suspense, uncategorized or clearing accounts not at zero (Z-11)',
    remedy: 'Move each entry in it to the right account; these accounts should end at zero.',
    run: ({ accounts, transactions, baseCurrency }) => {
      const holding = accounts.filter(a => SUSPENSE.test(`${a.name || ''} ${a.category || ''} ${a.subtype || ''}`));
      if (holding.length === 0) return [];
      const balance = new Map(holding.map(a => [a.id, { cents: 0, entries: 0 }]));
      for (const tx of transactions) {
        if (!isPostable(tx)) continue;
        for (const l of tx.lines || []) {
          const b = balance.get(l.accountId);
          if (b) { b.cents += lineAmount(l, tx); b.entries += 1; }
        }
      }
      return holding.flatMap(a => {
        const b = balance.get(a.id)!;
        return b.cents === 0 ? [] : [{
          id: `suspense-${a.id}`, checkId: 'suspense-balance', severity: 'medium' as const,
          title: `${a.name} holds ${formatCurrency(Math.abs(b.cents), baseCurrency)}`,
          description: `${b.entries} line(s) are parked there (${b.cents > 0 ? 'debit' : 'credit'} balance); reports show them in the wrong place until they are moved.`,
          record: { type: 'account' as const, id: a.id },
        }];
      });
    },
  },
  {
    id: 'stale-unreconciled',
    label: 'Bank lines waiting more than 30 days to be matched (Z-13)',
    remedy: 'Match each line to its entry in Reconcile, create the entry, or ignore the line if it is not yours.',
    run: ({ bankLines, accounts, today }) => {
      const cutoff = shiftDays(today, -30);
      const waiting = (bankLines || []).filter(l => l.status === 'pending' && typeof l.date === 'string' && l.date.slice(0, 10) < cutoff);
      const byAccount = new Map<string, BankStatementLine[]>();
      for (const line of waiting) byAccount.set(line.accountId || '', [...(byAccount.get(line.accountId || '') || []), line]);
      return [...byAccount.entries()].map(([accountId, lines]) => {
        const oldest = lines.reduce((a, b) => (a.date <= b.date ? a : b));
        const name = accounts.find(a => a.id === accountId)?.name || 'a bank account';
        return {
          id: `stale-bank-${accountId || 'none'}`, checkId: 'stale-unreconciled', severity: 'low' as const,
          title: `${lines.length} bank line(s) in ${name} not matched for over 30 days`,
          description: `The oldest is from ${oldest.date.slice(0, 10)}: ${oldest.description || 'no description'}. The bank balance and the books can't agree until they are matched.`,
          record: { type: 'bankLine' as const, id: oldest.id },
        };
      });
    },
  },
  {
    id: 'cleared-before-issued',
    label: 'Entries the bank cleared before they were made (CB-21)',
    remedy: 'Check the entry\'s date, or whether its statement line belongs to another entry: undo the match in Reconcile and match it again.',
    run: ({ bankLines, transactions }) => {
      const byId = new Map(transactions.filter(isPostable).map(t => [t.id, t]));
      return (bankLines || []).flatMap(line => {
        const tx = line.status === 'matched' && line.matchedTransactionId ? byId.get(line.matchedTransactionId) : undefined;
        const cleared = String(line.date || '').slice(0, 10);
        const made = String(tx?.date || '').slice(0, 10);
        // a few days' difference is how banks and books date the same payment
        if (!tx || !cleared || !made || shiftDays(made, -3) <= cleared) return [];
        return [{
          id: `cleared-early-${line.id}`, checkId: 'cleared-before-issued', severity: 'medium' as const,
          title: `${tx.description || 'An entry'} (${made}) was cleared by a statement line of ${cleared}`,
          description: 'A cheque or payment can\'t clear before it is made: the entry\'s date is wrong, or the statement line was matched to the wrong entry.',
          record: { type: 'transaction' as const, id: tx.id },
        }];
      });
    },
  },
  {
    id: 'payment-ledger',
    label: 'Payments without their entry, or with another amount (CB-23)',
    remedy: 'Open the payment: void it and record it again, or undo the entry that cancelled its posting.',
    run: ({ payments, transactions }) => {
      if (!payments) return [];
      const reversed = new Set(transactions.filter(t => t.metadata?.isReversal || t.metadata?.reversesTxId).map(t => String(t.metadata?.reversesTxId || t.metadata?.reversedTransactionId || '')));
      const posting = new Map<string, Transaction>();
      for (const t of transactions) {
        // older postings carry the payment id without a type; a later application of it is not its posting
        if (t.metadata?.paymentId && t.metadata?.type !== 'payment-application' && isPostable(t) && !t.reversalEventId && !reversed.has(t.id)) posting.set(String(t.metadata.paymentId), t);
      }
      // only payments inside the entries read (the browser reads the newest ones), so none looks missing for that
      const oldest = transactions.reduce((min, t) => (t.date && String(t.date).slice(0, 10) < min ? String(t.date).slice(0, 10) : min), '9999-12-31');
      return payments.filter(p => p.status !== 'void' && (p.amountCents || 0) > 0 && String(p.paymentDate || p.date || '').slice(0, 10) >= oldest).flatMap(p => {
        const name = p.number || p.id;
        const who = p.contactName || p.entityName || '';
        const entry = posting.get(p.id);
        if (!entry) {
          return [{ id: `payment-ledger-${p.id}`, checkId: 'payment-ledger', severity: 'high' as const,
            title: `Payment ${name}${who ? ` (${who})` : ''} has no entry in the ledger`,
            description: 'The payment is recorded but its money is not in the books, so the bank and the receivables or payables disagree with it.' }];
        }
        // a payment at another day's rate books the difference as exchange gain or loss: not compared
        if (p.paymentExchangeRate) return [];
        const expected = Math.round((p.amountCents || 0) * (p.exchangeRate && p.exchangeRate > 0 ? p.exchangeRate : 1));
        const booked = Math.round(Number(entry.totalAmountCents) || 0);
        if (booked === expected) return [];
        return [{ id: `payment-ledger-${p.id}`, checkId: 'payment-ledger', severity: 'high' as const,
          title: `Payment ${name}${who ? ` (${who})` : ''} is ${formatCurrency(expected)}, its entry ${formatCurrency(booked)}`,
          description: 'The payment record and its entry in the ledger say different amounts.',
          record: { type: 'transaction' as const, id: entry.id } }];
      });
    },
  },
  {
    id: 'missing-label',
    label: 'Entries missing a required label (Z-12)',
    remedy: 'Open the entry and fill in the label. The rules (which label on which accounts) are in Settings → Dimensions.',
    run: ({ transactions, accounts, dimensions }) => {
      // an entry that was corrected and its reversal cancel out: only the entry that replaced them counts
      const reversed = new Set(transactions.map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId).filter(Boolean));
      return transactions.flatMap(tx => {
      if (tx.reversalEventId || tx.metadata?.isReversal || tx.metadata?.reversesTxId || reversed.has(tx.id)) return [];
      const missing = missingLabels(tx, dimensions, accounts);
      if (missing.length === 0) return [];
      return [{
        id: `missing-label-${tx.id}`, checkId: 'missing-label', severity: 'low' as const,
        title: `${tx.description || 'Entry'} (${missing[0].date}): ${missing.map(m => `no ${m.dimensionName} on ${m.accountName}`).join('; ')}`,
        description: 'Reports by that label show this entry under "Unassigned" until it is filled in.',
        record: { type: 'transaction' as const, id: tx.id },
      }];
      });
    },
  },
  {
    id: 'label-role',
    label: 'Entries that do not meet a label\'s role (DIM-3)',
    remedy: 'Open the entry and give every line a value of the label; for a self-balancing label, each value\'s lines must add up to zero (split the line). The roles are in Settings → Dimensions.',
    run: ({ transactions, accounts, dimensions }) => {
      const byEntry = new Map<string, ReturnType<typeof labelRoleFindings>>();
      for (const p of labelRoleFindings(transactions, dimensions, accounts)) byEntry.set(p.transactionId, [...(byEntry.get(p.transactionId) || []), p]);
      return [...byEntry.values()].map(problems => {
        const first = problems[0];
        const unbalanced = problems.some(p => p.kind === 'unbalanced');
        return {
          id: `label-role-${first.transactionId}`, checkId: 'label-role', severity: unbalanced ? 'medium' as const : 'low' as const,
          title: `${first.description} (${first.date}): ${problems.map(p => (p.kind === 'unbalanced'
            ? `${p.dimensionName} ${p.value} is off by ${((p.cents || 0) / 100).toFixed(2)}`
            : `no ${p.dimensionName} on ${p.accountName}`)).join('; ')}`,
          description: unbalanced
            ? 'This label is self-balancing: its values\' balance sheets do not balance until each value\'s lines in this entry add up to zero.'
            : 'This label is fully attributed: reports by it show this line under "Unassigned" until it is filled in.',
          record: { type: 'transaction' as const, id: first.transactionId },
        };
      });
    },
  },
  {
    id: 'stock-history',
    label: 'Stock on hand that its history does not explain (W-02)',
    remedy: 'Open the item\'s Stock history on Inventory: the changes listed should end at the quantity on hand. Count the stock to set it right.',
    run: ({ inventory, stockMoves }) => {
      if (!stockMoves?.length) return [];
      const byItem = new Map<string, StockMove[]>();
      for (const m of stockMoves) byItem.set(m.itemId, [...(byItem.get(m.itemId) || []), m]);
      return (inventory || []).flatMap(item => {
        const problem = stockHistoryProblem(item, byItem.get(item.id) || []);
        return problem ? [{ id: `stock-history-${item.id}`, checkId: 'stock-history', severity: 'medium' as const, title: problem, description: 'The quantity changed without a recorded reason, or a change was recorded twice.', record: { type: 'item' as const, id: item.id } }] : [];
      });
    },
  },
];

const SUSPENSE = /suspense|uncategori[sz]ed|ask my accountant|clearing/i;

function shiftDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function runDataChecks(ctx: CheckContext, checks: DataCheck[] = DATA_CHECKS): CheckFinding[] {
  const order: Record<CheckSeverity, number> = { high: 0, medium: 1, low: 2 };
  return checks.flatMap(check => check.run(ctx)).sort((a, b) => order[a.severity] - order[b.severity]);
}
