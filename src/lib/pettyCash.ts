/**
 * Petty cash (A-3, K-31, AI #3): the cash box — a cash-type bank account the workspace already
 * has — and the three balanced entries it posts. Nothing here is a new collection: the box IS the
 * account, "cash in the box" is what the ledger says that account holds, and every movement goes
 * through the ordinary posting route (`POST /api/v1/transactions`), so the server checks the
 * balance, the role and the period lock like it does for any other entry.
 *
 *   spending from the box:  debit the expense category, credit the box
 *   topping up from a bank: debit the box, credit the bank (a transfer between two cash accounts)
 *   a count:                the difference between the cash counted and the book balance goes to
 *                           a chosen over/short expense account; counting exactly right posts nothing
 *
 * Pure money maths, whole cents, no React and no database. Nothing here invents an account: the
 * pickers list the workspace's own chart and an entry is refused in plain words when the right
 * account is missing (`src/components/finance/PettyCashView.tsx` is the screen on top).
 */
import type { ChartAccount, Transaction, TransactionLine } from '../types';
import { resolveAccountRole } from './accountUtils';
import { isPostable, lineAmount } from './txFilters';

/** The metadata key every petty cash entry carries, so the screen can tell its movements apart. */
export const PETTY_CASH_KEY = 'pettyCash';

export type PettyCashKind = 'spend' | 'top-up' | 'count';

export interface PettyCashSpendDraft {
  boxAccountId: string;
  categoryAccountId: string;
  amountCents: number;
  date: string;
  note?: string;
  /** a receipt number or reference, kept on the entry's reference */
  receipt?: string;
}

export interface PettyCashTopUpDraft {
  boxAccountId: string;
  bankAccountId: string;
  amountCents: number;
  date: string;
}

export interface PettyCashCountDraft {
  boxAccountId: string;
  overShortAccountId: string;
  /** the cash actually in the box, counted by hand, whole cents */
  countedCents: number;
  date: string;
}

const accountName = (a: ChartAccount) => (a.code ? `${a.code} · ${a.name}` : a.name);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The accounts a petty cash box can be — the workspace's own cash-type accounts, never a new one. */
export function pettyCashBoxChoices(accounts: ChartAccount[]): ChartAccount[] {
  return accounts
    .filter(a => !a.isArchived && a.isActive !== false && resolveAccountRole(a) === 'cash')
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Expense accounts the spending can be booked to (the "category" on the spend form). */
export function pettyCashCategoryChoices(accounts: ChartAccount[]): ChartAccount[] {
  return accounts
    .filter(a => !a.isArchived && a.isActive !== false && a.type === 'expense')
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Expense accounts a count difference can go to (cash over/short). */
export function overShortChoices(accounts: ChartAccount[]): ChartAccount[] {
  return pettyCashCategoryChoices(accounts);
}

/**
 * What the ledger says is in the box: every posted line on the box account, in the entry's own
 * exchange rate. This is the "book" side of a count — a draft or void entry moves nothing.
 */
export function pettyCashBalanceCents(boxAccountId: string, transactions: Transaction[]): number {
  let sum = 0;
  for (const tx of transactions || []) {
    if (!isPostable(tx)) continue;
    for (const transactionLine of tx.lines || []) {
      if (transactionLine.accountId === boxAccountId) sum += lineAmount(transactionLine, tx);
    }
  }
  return sum === 0 ? 0 : sum;
}

export interface PettyCashMovement {
  transaction: Transaction;
  /** what this entry moved in or out of the box (signed, whole cents) */
  amountCents: number;
  /** which of the box's own actions posted it, when it was posted from the petty cash screen */
  kind?: PettyCashKind;
}

/** The posted entries that touched the box, newest first, with what each moved. */
export function pettyCashMovements(boxAccountId: string, transactions: Transaction[]): PettyCashMovement[] {
  const movements: PettyCashMovement[] = [];
  for (const tx of transactions || []) {
    if (!isPostable(tx)) continue;
    const amountCents = (tx.lines || [])
      .filter(l => l.accountId === boxAccountId)
      .reduce((sum, l) => sum + lineAmount(l, tx), 0);
    if (!amountCents) continue;
    const kind = tx.metadata?.[PETTY_CASH_KEY];
    movements.push({
      transaction: tx,
      amountCents,
      ...(kind === 'spend' || kind === 'top-up' || kind === 'count' ? { kind } : {}),
    });
  }
  return movements.sort((a, b) => b.transaction.date.localeCompare(a.transaction.date)
    || (b.transaction.createdAt || '').localeCompare(a.transaction.createdAt || ''));
}

function boxProblem(boxAccountId: string, accounts: ChartAccount[]): string | null {
  const box = accounts.find(a => a.id === boxAccountId);
  if (!box) return 'Choose the petty cash account (a cash-type bank account).';
  if (resolveAccountRole(box) !== 'cash') return `${accountName(box)} is not a bank or cash account.`;
  return null;
}

/** What is wrong with the spending as typed, in plain words; null when it can be posted. */
export function spendProblem(draft: PettyCashSpendDraft, accounts: ChartAccount[]): string | null {
  const badBox = boxProblem(draft.boxAccountId, accounts);
  if (badBox) return badBox;
  if (!Number.isInteger(draft.amountCents) || draft.amountCents <= 0) return 'Give a positive amount.';
  const category = accounts.find(a => a.id === draft.categoryAccountId);
  if (!category) return 'Choose the expense account the spending goes to.';
  if (category.type !== 'expense') return `${accountName(category)} is not an expense account.`;
  if (!DATE.test(draft.date)) return 'Give the date of the spending.';
  return null;
}

/** What is wrong with the top-up as typed, in plain words; null when it can be posted. */
export function topUpProblem(draft: PettyCashTopUpDraft, accounts: ChartAccount[]): string | null {
  const badBox = boxProblem(draft.boxAccountId, accounts);
  if (badBox) return badBox;
  if (!Number.isInteger(draft.amountCents) || draft.amountCents <= 0) return 'Give a positive amount.';
  const bank = accounts.find(a => a.id === draft.bankAccountId);
  if (!bank) return 'Choose the bank account the top-up comes from.';
  if (resolveAccountRole(bank) !== 'cash') return `${accountName(bank)} is not a bank or cash account.`;
  if (bank.id === draft.boxAccountId) return 'The top-up must come from a different account than the box itself.';
  if (!DATE.test(draft.date)) return 'Give the date of the top-up.';
  return null;
}

/** What is wrong with the count as typed, in plain words; null when it can be posted. */
export function countProblem(draft: PettyCashCountDraft, accounts: ChartAccount[]): string | null {
  const badBox = boxProblem(draft.boxAccountId, accounts);
  if (badBox) return badBox;
  if (!Number.isInteger(draft.countedCents) || draft.countedCents < 0) return 'The cash counted cannot be negative.';
  const overShort = accounts.find(a => a.id === draft.overShortAccountId);
  if (!overShort) return 'Choose the over/short account the difference goes to.';
  if (overShort.type !== 'expense') return `${accountName(overShort)} is not an expense account.`;
  if (overShort.id === draft.boxAccountId) return 'The over/short account cannot be the box itself.';
  if (!DATE.test(draft.date)) return 'Give the date of the count.';
  return null;
}

function line(account: ChartAccount, amountCents: number, extra?: Partial<TransactionLine>): TransactionLine {
  return {
    id: `line-${account.id}`,
    accountId: account.id,
    accountName: account.name,
    amountCents,
    exchangeRate: 1,
    ...extra,
  };
}

interface EntryContext {
  workspaceId: string;
  uid?: string;
  currency?: string;
}

/**
 * Spending from the box: the expense category is debited, the box credited, one balanced entry.
 * The note goes on the category line, never on the box line (the categoriser must learn
 * "this spending → this category", not "→ the box"). The receipt number rides on the reference.
 */
export function createPettyCashSpendEntry(input: EntryContext & {
  draft: PettyCashSpendDraft;
  box: ChartAccount;
  category: ChartAccount;
}): Partial<Transaction> {
  const amount = Math.abs(Math.round(input.draft.amountCents));
  const note = input.draft.note?.trim();
  const description = note ? `Petty cash: ${note}` : `Petty cash — ${input.category.name}`;
  const receipt = input.draft.receipt?.trim().slice(0, 100);
  return {
    workspaceId: input.workspaceId,
    ...(input.uid ? { uid: input.uid } : {}),
    date: input.draft.date,
    description,
    ...(receipt ? { reference: receipt } : {}),
    totalAmountCents: amount,
    currency: input.currency || 'USD',
    exchangeRate: 1,
    type: 'actual',
    status: 'completed',
    lines: [
      line(input.category, amount, { description }),
      line(input.box, -amount),
    ],
    metadata: { [PETTY_CASH_KEY]: 'spend' },
  };
}

/** Topping up the box from a bank account: a transfer between two of the workspace's own cash accounts. */
export function createPettyCashTopUpEntry(input: EntryContext & {
  draft: PettyCashTopUpDraft;
  box: ChartAccount;
  bank: ChartAccount;
}): Partial<Transaction> {
  const amount = Math.abs(Math.round(input.draft.amountCents));
  const description = `Petty cash top-up from ${input.bank.name}`;
  return {
    workspaceId: input.workspaceId,
    ...(input.uid ? { uid: input.uid } : {}),
    date: input.draft.date,
    description,
    totalAmountCents: amount,
    currency: input.currency || 'USD',
    exchangeRate: 1,
    type: 'actual',
    status: 'completed',
    isTransfer: true,
    transferDetails: { fromAccountId: input.bank.id, toAccountId: input.box.id },
    lines: [
      line(input.box, amount, { isTransfer: true, description: `Transfer in from ${input.bank.name}` }),
      line(input.bank, -amount, { isTransfer: true, description: `Transfer out to ${input.box.name}` }),
    ],
    metadata: { [PETTY_CASH_KEY]: 'top-up' },
  };
}

/**
 * A count ("cash in the box"): the difference between what was counted and what the books say is
 * posted to the over/short account, so the box matches the drawer again. Cash missing debits the
 * over/short expense; extra cash credits it. Counting exactly the book balance returns null —
 * there is nothing to post.
 */
export function createPettyCashCountEntry(input: EntryContext & {
  draft: PettyCashCountDraft;
  box: ChartAccount;
  overShort: ChartAccount;
  /** what the ledger said was in the box when it was counted */
  bookCents: number;
  /** how money reads in this workspace, for the entry's description */
  money: (cents: number) => string;
}): Partial<Transaction> | null {
  const counted = Math.abs(Math.round(input.draft.countedCents));
  const book = Math.round(input.bookCents);
  const diff = counted - book;
  if (diff === 0) return null;
  const description = `Petty cash count: ${input.money(counted)} counted, ${input.money(book)} in the books — ${input.money(Math.abs(diff))} ${diff < 0 ? 'short' : 'over'}`;
  return {
    workspaceId: input.workspaceId,
    ...(input.uid ? { uid: input.uid } : {}),
    date: input.draft.date,
    description,
    totalAmountCents: Math.abs(diff),
    currency: input.currency || 'USD',
    exchangeRate: 1,
    type: 'actual',
    status: 'completed',
    lines: [
      line(input.overShort, -diff, { description }),
      line(input.box, diff),
    ],
    metadata: { [PETTY_CASH_KEY]: 'count', countedCents: counted, bookCents: book },
  };
}

/** The sentence over the box: what the ledger says is in it. */
export function boxSentence(box: ChartAccount, balanceCents: number, money: (cents: number) => string): string {
  return `${money(balanceCents)} in ${box.name}, by the books.`;
}
