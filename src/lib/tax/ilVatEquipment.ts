/**
 * ISS-160 (GitHub #160, found by AI #4): which saved purchases are equipment (ציוד) on Israel's VAT report, so their
 * input VAT is reported apart from other inputs (ilVatReturn.ts `fixedAsset`). Worked out from what is saved, with
 * the rule the asset register already uses for bills (`isFixedAssetAccount`, assetFromBill.ts: an asset account that
 * is not cash, a receivable, stock, a prepayment or accumulated depreciation):
 *   - a bill whose lines are all on such accounts is equipment; a bill with none is other input;
 *   - a bill that mixes the two is not split by guess: it is reported as other input and named, so it can be split
 *     into two bills (the VAT to pay is the same either way — only the line it is reported on differs);
 *   - a vendor credit follows the bill it credits (it has no lines of its own), so a credit on equipment takes its
 *     VAT off the equipment line; a credit with no bill is other input;
 *   - a document already marked (`fixedAsset`, or `metadata.fixedAsset`) keeps the mark.
 * Pure; nothing is written.
 */
import type { ChartAccount } from '../../types';
import { isFixedAssetAccount } from '../assetFromBill';

export type EquipmentKind = 'equipment' | 'other' | 'mixed';

interface PurchaseDoc {
  id: string;
  number?: string;
  date?: string;
  issueDate?: string;
  billId?: string;
  fixedAsset?: boolean;
  metadata?: { fixedAsset?: boolean; [key: string]: unknown } | null;
  splits?: Array<{ accountId: string; amountCents: number }>;
}

const marked = (doc: PurchaseDoc): boolean | undefined =>
  typeof doc.fixedAsset === 'boolean' ? doc.fixedAsset : typeof doc.metadata?.fixedAsset === 'boolean' ? doc.metadata.fixedAsset : undefined;

/** A bill's kind from its own lines' accounts (lines of zero are left out). */
export function billEquipmentKind(bill: PurchaseDoc, accounts: ChartAccount[]): EquipmentKind {
  const own = marked(bill);
  if (own !== undefined) return own ? 'equipment' : 'other';
  const byId = new Map(accounts.map(a => [a.id, a]));
  const lines = (bill.splits || []).filter(l => Number(l.amountCents) !== 0);
  const assets = lines.filter(l => isFixedAssetAccount(byId.get(l.accountId))).length;
  if (assets === 0) return 'other';
  return assets === lines.length ? 'equipment' : 'mixed';
}

/** The bills and vendor credits marked for the VAT report, and the mixed bills to name. */
export function withEquipment<B extends PurchaseDoc, C extends PurchaseDoc>(bills: B[], vendorCredits: C[], accounts: ChartAccount[]): {
  bills: Array<B & { fixedAsset: boolean }>;
  vendorCredits: Array<C & { fixedAsset: boolean }>;
  mixed: B[];
} {
  const kinds = new Map(bills.map(b => [b.id, billEquipmentKind(b, accounts)]));
  return {
    bills: bills.map(b => ({ ...b, fixedAsset: kinds.get(b.id) === 'equipment' })),
    vendorCredits: vendorCredits.map(c => {
      const own = marked(c);
      return { ...c, fixedAsset: own !== undefined ? own : kinds.get(String(c.billId || '')) === 'equipment' };
    }),
    mixed: bills.filter(b => kinds.get(b.id) === 'mixed'),
  };
}
