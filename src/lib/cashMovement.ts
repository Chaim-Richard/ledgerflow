import type { ChartAccount, Transaction, TransactionLine } from '../types';
import { resolveAccountRole } from './accountUtils';
import { categoryChoices, type AccountChoice } from './accountChoices';

/**
 * Money in and money out (BA-17): the two dialogs on the banking page that record cash arriving or
 * leaving without a document behind it — interest, a owner putting money in, a payment to a supplier
 * there is no bill for, money held for a customer before their invoice exists.
 *
 * One entry, two lines: the bank or cash account on one side and what the money is for on the other.
 * That is all this does, and it is why three things are refused here: two cash accounts (that is a
 * transfer, and the transfer dialog is what keeps it out of income and expense), an accounts
 * receivable or payable account (money that settles an invoice or bill belongs on that document —
 * booked here the document would go on reading as owed), and a zero or unwhole amount.
 *
 * The entry is not a payment record: it does not touch an invoice, a bill or a bank feed line, and
 * it never marks anything as settled. Money in against a customer deposits liability is what an
 * advance payment is (BE-05): the invoice's deposit later draws the same money back out, so it is
 * counted once.
 */
export type CashMovementDirection = 'in' | 'out';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface CashMovementDraft {
  direction: CashMovementDirection;
  amountCents: number;
  date: string;
  cashAccountId: string;
  counterAccountId: string;
}

export interface CashMovementLabels {
  /** the dialog's title */
  title: string;
  /** what the money is doing, for a sentence */
  verb: string;
  /** what to ask for the account the money belongs to */
  whatFor: string;
  /** "from" / "to" in front of a name */
  who: string;
  /** the button that posts it */
  button: string;
}

export const CASH_MOVEMENT_LABELS: Record<CashMovementDirection, CashMovementLabels> = {
  in: { title: 'Money In', verb: 'Money received', whatFor: 'What is it for?', who: 'from', button: 'Record money in' },
  out: { title: 'Money Out', verb: 'Money paid', whatFor: 'What was it for?', who: 'to', button: 'Record money out' },
};

const accountName = (a: ChartAccount) => (a.code ? `${a.code} · ${a.name}` : a.name);

/** The bank or cash account the money moves in or out of: yours, open, of a type money sits in. */
export function cashAccountOptions(accounts: ChartAccount[]): AccountChoice[] {
  return accounts
    .filter(a => !a.isArchived && a.isActive !== false && resolveAccountRole(a) === 'cash')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(a => ({ value: a.id, label: accountName(a) }));
}

/**
 * What the money can be booked against: the category picker's own list (open accounts, no bank or cash,
 * the ones used most first), with the accounts that hold what people owe taken out of it.
 */
export function counterAccountChoices(accounts: ChartAccount[], transactions: Transaction[]): AccountChoice[] {
  const byId = new Map(accounts.map(a => [a.id, a]));
  return categoryChoices(accounts, transactions).filter(c => {
    const account = byId.get(c.value);
    return account ? isCounterAccount(account) : false;
  });
}

export function isCounterAccount(account: ChartAccount): boolean {
  const role = resolveAccountRole(account);
  return role !== 'cash' && role !== 'ar' && role !== 'ap';
}

/** What the picker is missing, in the words to show; null when both sides are known accounts. */
export function cashMovementProblem(draft: CashMovementDraft, accounts: ChartAccount[]): string | null {
  const amountCents = draft.amountCents;
  if (!Number.isFinite(amountCents) || Math.round(amountCents) !== amountCents || amountCents <= 0) {
    return 'Type how much it is, in whole cents — money in and money out are never zero.';
  }
  if (!DAY.test(draft.date)) return 'Give it a date.';
  const cash = accounts.find(a => a.id === draft.cashAccountId);
  if (!cash) return 'Say which bank or cash account the money moves ' + (draft.direction === 'in' ? 'into' : 'out of') + '.';
  if (resolveAccountRole(cash) !== 'cash') return `${cash.name} is not an account money sits in. Pick a bank or cash account.`;
  const counter = accounts.find(a => a.id === draft.counterAccountId);
  if (!counter) {
    return draft.direction === 'in'
      ? 'Say what the money is for — which account it belongs to. That is what makes it income, a loan, or money held for someone.'
      : 'Say what you paid for — which account it belongs to.';
  }
  const role = resolveAccountRole(counter);
  if (role === 'cash') {
    return `${counter.name} is one of your own accounts. Use Transfer Funds for money moving between them, so it stays out of income and expense.`;
  }
  if (role === 'ar' || role === 'ap') {
    return `${counter.name} holds what people owe you or what you owe them. Money that settles an invoice or a bill goes on that document (Record payment / Pay), otherwise it keeps reading as owed.`;
  }
  return null;
}

export interface CashMovementInput {
  workspaceId: string;
  uid: string;
  direction: CashMovementDirection;
  amountCents: number;
  date: string;
  cashAccount: { id: string; name: string };
  counterAccount: { id: string; name: string };
  currency: string;
  description?: string;
  /** a name to write into the description; the entry does not link to the contact (L-155: a name that goes stale must not be copyable) */
  contactName?: string;
  reference?: string;
}

/**
 * The entry itself. Lines are signed the way the ledger reads them — positive is a debit — and they
 * sum to exactly zero. The cash line is left without a description on purpose: the entry's description
 * is what the workspace learns as a pattern for a category, and it belongs to the account the money
 * is for, not to the bank.
 */
export function createCashMovement(input: CashMovementInput): Partial<Transaction> {
  const amountCents = Math.abs(Math.round(input.amountCents));
  const moneyIn = input.direction === 'in';
  const labels = CASH_MOVEMENT_LABELS[input.direction];
  const who = input.contactName ? `${labels.verb} ${labels.who} ${input.contactName.trim()}` : labels.verb;
  const description = input.description?.trim() || (input.contactName ? who : `${labels.verb}: ${input.counterAccount.name}`);
  const lines: TransactionLine[] = [
    {
      accountId: input.cashAccount.id,
      accountName: input.cashAccount.name,
      amountCents: moneyIn ? amountCents : -amountCents,
      exchangeRate: 1,
    },
    {
      accountId: input.counterAccount.id,
      accountName: input.counterAccount.name,
      amountCents: moneyIn ? -amountCents : amountCents,
      exchangeRate: 1,
      description,
    },
  ];
  const reference = input.reference?.trim();
  return {
    workspaceId: input.workspaceId,
    uid: input.uid,
    date: input.date,
    description,
    ...(reference ? { reference } : {}),
    // the amount of the entry is what moved, never the sum of the two lines (L-55)
    totalAmountCents: amountCents,
    currency: input.currency,
    // the dialog asks for the amount in the workspace's currency, so there is nothing to convert
    exchangeRate: 1,
    type: 'actual',
    status: 'completed',
    lines,
  };
}

/** What to tell the person afterwards, in their money format. */
export function cashMovementSentence(input: CashMovementInput, money: (cents: number) => string): string {
  const amount = money(Math.abs(Math.round(input.amountCents)));
  const where = `${input.direction === 'in' ? 'into' : 'out of'} ${input.cashAccount.name}`;
  const who = input.contactName ? ` ${CASH_MOVEMENT_LABELS[input.direction].who} ${input.contactName.trim()}` : '';
  return `${CASH_MOVEMENT_LABELS[input.direction].verb}${who}: ${amount} ${where}.`;
}
