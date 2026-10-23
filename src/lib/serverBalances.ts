/**
 * L-123 step 3 (docs/design/L-123-server-balances.md): an account balance on screen = the server's balance through a
 * cut-off day (GET /api/v1/balances, every entry of the books, past the browser's loading cap) + the loaded entries
 * dated after that day.
 *
 * The cut-off is the oldest day among the loaded entries: the browser loads the newest entries first (cap in
 * LEDGER_COLLECTIONS), so every entry after that day is loaded, and the day itself may be cut part-way, which is why
 * the server counts it whole. Step 4 moves the cut-off to the newest fresh snapshot.
 */
import type { ChartAccount, Transaction } from '../types';
import { LedgerEngine } from '../kernel/ledger/LedgerEngine';
import { transactionDate } from './txFilters';

/** What the server answered: base-currency cents per account id, debit positive, entries dated ≤ asOf (no account openings). */
export interface ServerOpening {
  workspaceId: string;
  asOf: string;
  accounts: Record<string, number>;
}

/** The oldest book date among the loaded entries ('' when none is loaded). */
export function openingCutoff(transactions: Transaction[]): string {
  let oldest = '';
  for (const tx of transactions) {
    const d = tx && typeof tx === 'object' ? transactionDate(tx) : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!oldest || d < oldest)) oldest = d;
  }
  return oldest;
}

/** The loaded entries the server's answer does not hold: dated after its day. */
export function entriesAfter(transactions: Transaction[], asOf: string): Transaction[] {
  return transactions.filter(tx => tx && typeof tx === 'object' && transactionDate(tx) > asOf);
}

const debitNature = (a: ChartAccount) => a.type === 'asset' || a.type === 'expense' || a.type === 'cost_of_goods';

/**
 * Each account with `balanceCents` (its natural sign, as computedAccounts in useLedgerStore): the account's own
 * opening, the server's sum through `opening.asOf`, and the loaded entries after it (LedgerEngine, as today).
 */
export function withServerOpening(accounts: ChartAccount[], transactions: Transaction[], opening: ServerOpening): ChartAccount[] {
  const open = LedgerEngine.computeDimensionalBalances(accounts, entriesAfter(transactions, opening.asOf));
  return accounts.map(acc => {
    const signed = (open.get(acc.id)?.total || 0) + (opening.accounts[acc.id] || 0);
    return { ...acc, balanceCents: debitNature(acc) ? signed : -signed };
  });
}

