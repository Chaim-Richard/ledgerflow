import { ChartAccount } from '../types';

export type AccountRole = 'cash' | 'ar' | 'ap' | 'inventory' | 'revenue' | 'expense' | 'cogs' | 'equity' | 'liability' | 'asset' | 'unknown';

export function resolveAccountRole(account: ChartAccount | undefined | null): AccountRole {
  if (!account) return 'unknown';

  const type = (account.type || '').toLowerCase();
  const category = (account.category || '').toLowerCase();
  const name = (account.name || '').toLowerCase();
  const subtype = (account.subtype || '').toLowerCase();

  if (type === 'asset') {
    if (category === 'cash' || subtype === 'cash' || subtype === 'checking' || subtype === 'savings') {
      return 'cash';
    }
    if (category === 'accounts receivable' || subtype === 'accounts receivable' || name === 'accounts receivable') {
      return 'ar';
    }
    if (category === 'inventory' || subtype === 'inventory' || name === 'inventory') {
      return 'inventory';
    }
    return 'asset';
  }

  if (type === 'liability') {
    if (category === 'accounts payable' || subtype === 'accounts payable' || name === 'accounts payable') {
      return 'ap';
    }
    return 'liability';
  }

  if (type === 'revenue' || type === 'income') return 'revenue';
  if (type === 'cost_of_goods') return 'cogs';
  if (type === 'expense') return 'expense';
  if (type === 'equity') return 'equity';

  return 'unknown';
}
