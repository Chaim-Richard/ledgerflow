import { ChartAccount } from '../types';

export type AccountRole = 'cash' | 'ar' | 'ap' | 'inventory' | 'revenue' | 'expense' | 'cogs' | 'equity' | 'liability' | 'asset' | 'fx_rounding' | 'unknown';

/**
 * An income account. Both spellings are saved: 'income' (the chart's own form) and 'revenue'
 * (spreadsheet imports, `parseAccountType`); code that looks for income accounts must accept both,
 * or an imported "Sales" account is missed (found by the main-path test, DA-07).
 */
export function isIncomeAccount(account: { type?: string } | undefined | null): boolean {
  const type = String(account?.type || '').toLowerCase();
  return type === 'income' || type === 'revenue';
}

export function resolveAccountRole(account: ChartAccount | undefined | null): AccountRole {
  if (!account) return 'unknown';

  const type = (account.type || '').toLowerCase();
  const category = (account.category || '').toLowerCase();
  const name = (account.name || '').toLowerCase();
  const subtype = (account.subtype || '').toLowerCase();

  // Handle explicit role overrides first
  if (account.role === 'fx_rounding' || account.subtype === 'rounding' || category === 'rounding differences') {
    return 'fx_rounding';
  }

  // Handle COGS first (could be type: cost_of_goods or type: expense with category: cogs / direct costs)
  if (type === 'cost_of_goods' || category === 'cogs' || category === 'direct costs' || name.includes('cost of goods') || name.includes('cogs')) {
    return 'cogs';
  }

  if (type === 'asset') {
    if (subtype === 'undeposited_funds' || name.includes('undeposited')) return 'asset';
    if (
      category === 'cash' ||
      category.includes('cash') ||
      category.includes('bank') ||
      subtype === 'cash' ||
      subtype === 'bank' ||
      subtype === 'checking' ||
      subtype === 'savings' ||
      name.includes('checking') ||
      name.includes('bank') ||
      name.includes('petty cash') ||
      name.includes('operating cash') ||
      name.includes('cash') ||
      account.role === 'cash'
    ) {
      return 'cash';
    }
    if (category === 'receivables' || category === 'accounts receivable' || category === 'receivable' || subtype.includes('receivable') || name.includes('receivable')) {
      return 'ar';
    }
    if (category === 'inventory' || subtype === 'inventory' || name.includes('inventory')) {
      return 'inventory';
    }
    return 'asset';
  }

  if (type === 'liability') {
    if (category === 'payables' || category === 'accounts payable' || category === 'payable' || subtype.includes('payable')) {
      return 'ap';
    }
    // W8-GOLD: "Sales Tax Payable" (the business templates' 2100, category Tax) is a tax liability, not
    // Accounts Payable; read as A/P, bills and their payments could land on two different accounts
    if (name.includes('payable') && !name.includes('tax') && category !== 'tax' && category !== 'taxes') return 'ap';
    return 'liability';
  }

  if (type === 'revenue' || type === 'income' || category === 'sales' || category === 'revenue') return 'revenue';
  if (type === 'expense') return 'expense';
  if (type === 'equity' || category === 'equity') return 'equity';

  return 'unknown';
}

/**
 * The holding account for payments received but not yet taken to the bank ("Undeposited Funds"):
 * an asset account with subtype undeposited_funds, or named so. "Make deposit" moves its payments
 * to a bank account in one entry, so the bank statement's single deposit line matches.
 */
export function isUndepositedFundsAccount(account: ChartAccount | undefined | null): boolean {
  if (!account || (account.type || '').toLowerCase() !== 'asset') return false;
  return (account.subtype || '').toLowerCase() === 'undeposited_funds' || /undeposited/i.test(account.name || '');
}

/**
 * N-13: an account's opening balance is kept in its own direction, as the new-account form asks for
 * it (a 10,000 loan is 10,000; an overdrawn bank is negative). The books are debit-positive, so a
 * credit account's opening balance is turned around before it is added to its entries.
 */
export const isDebitNatureType = (type: string | undefined) => ['asset', 'expense', 'cost_of_goods', 'cogs'].includes(String(type || ''));
export function openingDebitCents(account: { type?: string; openingBalanceCents?: number | null }): number {
  const opening = Number(account.openingBalanceCents) || 0;
  return isDebitNatureType(account.type) ? opening : -opening;
}

