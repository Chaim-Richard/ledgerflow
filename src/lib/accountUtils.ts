import { ChartAccount } from '../types';

export type AccountRole = 'cash' | 'ar' | 'ap' | 'inventory' | 'revenue' | 'expense' | 'cogs' | 'equity' | 'liability' | 'asset' | 'unknown';

export function resolveAccountRole(account: ChartAccount | undefined | null): AccountRole {
  if (!account) return 'unknown';

  const type = (account.type || '').toLowerCase();
  const category = (account.category || '').toLowerCase();
  const name = (account.name || '').toLowerCase();
  const subtype = (account.subtype || '').toLowerCase();

  // Handle COGS first (could be type: cost_of_goods or type: expense with category: cogs / direct costs)
  if (type === 'cost_of_goods' || category === 'cogs' || category === 'direct costs' || name.includes('cost of goods') || name.includes('cogs')) {
    return 'cogs';
  }

  if (type === 'asset') {
    if (category === 'cash' || subtype === 'cash' || subtype === 'checking' || subtype === 'savings' || name.includes('checking') || name.includes('bank') || name.includes('petty cash')) {
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
    if (category === 'payables' || category === 'accounts payable' || category === 'payable' || subtype.includes('payable') || name.includes('payable')) {
      return 'ap';
    }
    return 'liability';
  }

  if (type === 'revenue' || type === 'income' || category === 'sales' || category === 'revenue') return 'revenue';
  if (type === 'expense') return 'expense';
  if (type === 'equity' || category === 'equity') return 'equity';

  return 'unknown';
}
