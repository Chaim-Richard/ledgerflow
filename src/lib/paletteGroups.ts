import type { RecordRef } from './recordLinks';
export interface SearchResultIdentity { id: string; type: string; record?: RecordRef }
export function paletteGroup(result: SearchResultIdentity): string {
  if (result.type === 'recent') return 'Recent items';
  if (result.type === 'command') return 'Commands';
  const prefix = result.id.split('-')[0];
  return ({ tx: 'Transactions', dim: 'Dimensions', proj: 'Projects', cust: 'Customers', vend: 'Vendors', acc: 'Accounts', inv: 'Invoices', bill: 'Bills' } as Record<string, string>)[prefix] || 'Records';
}
export function groupPaletteResults<T extends SearchResultIdentity>(results: T[]): { label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const result of results) { const label = paletteGroup(result); if (!groups.has(label)) groups.set(label, []); groups.get(label)!.push(result); }
  return Array.from(groups, ([label, items]) => ({ label, items }));
}
