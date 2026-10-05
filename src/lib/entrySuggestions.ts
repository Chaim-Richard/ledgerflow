/**
 * Adding an entry right in the transaction list (I-22, I-23): the category is suggested from the
 * workspace's own past entries with a similar description (the account they were booked to most
 * often), the bank account defaults to the one used most, and the entry is built balanced.
 */
import type { ChartAccount, Transaction, TransactionLine } from '../types';
import { resolveAccountRole } from './accountUtils';
import { soleCategoryLine } from './accountChoices';

/** "AMAZON MKTP US*2K3 4411" → "amazon mktp us": lower case, no digits or punctuation, first 3 words. */
export function descriptionKey(text: string): string {
  return text.toLowerCase().replace(/[^a-zÀ-ɏ֐-׿؀-ۿ\s]+/g, ' ').split(/\s+/).filter(w => w.length > 1).slice(0, 3).join(' ');
}

/** The account most past entries with this description were booked to; ties go to the latest. */
export function suggestCategory(description: string, transactions: Transaction[], accounts: ChartAccount[]): ChartAccount | null {
  const key = descriptionKey(description);
  if (!key) return null;
  const firstWord = key.split(' ')[0];
  const exact = new Map<string, { n: number; last: string }>();
  const near = new Map<string, { n: number; last: string }>();
  for (const tx of transactions) {
    if (tx.status === 'void' || tx.status === 'draft') continue;
    const line = soleCategoryLine(tx, accounts);
    if (!line?.accountId) continue;
    const txKey = descriptionKey(tx.description || '');
    const bucket = txKey === key ? exact : firstWord.length >= 3 && txKey.split(' ')[0] === firstWord ? near : null;
    if (!bucket) continue;
    const seen = bucket.get(line.accountId) ?? { n: 0, last: '' };
    bucket.set(line.accountId, { n: seen.n + 1, last: String(tx.date || '') > seen.last ? String(tx.date || '') : seen.last });
  }
  const best = [...(exact.size ? exact : near).entries()].sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last))[0];
  return best ? accounts.find(a => a.id === best[0] && !a.isArchived) || null : null;
}

/** The bank/cash account most entries use (else the first one). */
export function defaultBankAccount(transactions: Transaction[], accounts: ChartAccount[]): ChartAccount | null {
  const banks = accounts.filter(a => !a.isArchived && resolveAccountRole(a) === 'cash');
  const uses = new Map<string, number>();
  for (const tx of transactions) for (const l of tx.lines || []) if (banks.some(b => b.id === l.accountId)) uses.set(l.accountId, (uses.get(l.accountId) || 0) + 1);
  return [...banks].sort((a, b) => (uses.get(b.id) || 0) - (uses.get(a.id) || 0))[0] || null;
}

/** Money out for expenses (and most other accounts), money in for income. */
export function defaultDirection(category: ChartAccount | null | undefined): 'in' | 'out' {
  return category && (category.type === 'income' || category.type === 'revenue') ? 'in' : 'out';
}

export interface InlineEntryInput {
  date: string;
  description: string;
  amountCents: number;
  direction: 'in' | 'out';
  category: ChartAccount;
  bank: ChartAccount;
}

/** A balanced two-line entry: money out = category debit, bank credit; money in the other way. */
export function inlineEntry(input: InlineEntryInput): Partial<Transaction> & { lines: TransactionLine[] } {
  const sign = input.direction === 'out' ? 1 : -1;
  return {
    date: input.date,
    description: input.description.trim(),
    totalAmountCents: input.amountCents,
    lines: [
      { accountId: input.category.id, accountName: input.category.name, amountCents: sign * input.amountCents },
      { accountId: input.bank.id, accountName: input.bank.name, amountCents: -sign * input.amountCents },
    ],
  };
}
