/**
 * A fixed asset from a bill (X-01): bill lines posted to a fixed-asset account (an asset account
 * that is not cash, a receivable, stock, a prepayment or accumulated depreciation) that are not in
 * the asset register yet. Picking one fills the new asset's name, cost, purchase date and asset
 * account; the asset keeps which bill line it came from, so the line is not offered twice.
 */
import type { Bill, ChartAccount, FixedAsset } from '../types';
import { isCashAccount } from './txFilters';

export interface AssetCandidate {
  billId: string;
  line: number;
  label: string;
  name: string;
  costCents: number;
  date: string;
  accountId: string;
}

const NOT_FIXED = /receivable|inventory|stock|prepaid|prepayment|deposit|undeposited|accumulated|clearing|suspense/i;
const SKIPPED = new Set(['draft', 'void', 'rejected', 'cancelled']);

export function isFixedAssetAccount(account: ChartAccount | undefined): boolean {
  if (!account || String(account.type).toLowerCase() !== 'asset' || isCashAccount(account)) return false;
  return !NOT_FIXED.test(`${account.name} ${account.category || ''} ${account.subtype || ''}`);
}

export function assetCandidates(bills: Bill[], accounts: ChartAccount[], assets: Array<Pick<FixedAsset, 'sourceBillId' | 'sourceBillLine'>>): AssetCandidate[] {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const taken = new Set(assets.filter(a => a.sourceBillId).map(a => `${a.sourceBillId}#${a.sourceBillLine ?? 0}`));
  const out: AssetCandidate[] = [];
  for (const bill of bills) {
    if (SKIPPED.has(String(bill.status)) || (bill as { deletedAt?: unknown }).deletedAt) continue;
    (bill.splits || []).forEach((line, i) => {
      if (!isFixedAssetAccount(byId.get(line.accountId)) || !(line.amountCents > 0) || taken.has(`${bill.id}#${i}`)) return;
      const date = String(bill.issueDate || bill.date || '').slice(0, 10);
      const name = (line.description || '').trim() || `${bill.vendorName || 'Bill'} ${bill.number || ''}`.trim();
      out.push({
        billId: bill.id, line: i, name, costCents: line.amountCents, date, accountId: line.accountId,
        label: `${bill.number ? `Bill ${bill.number}` : 'Bill'}${bill.vendorName ? ` · ${bill.vendorName}` : ''} · ${name} · ${(line.amountCents / 100).toFixed(2)} · ${date}`,
      });
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
