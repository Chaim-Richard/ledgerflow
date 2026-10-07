/**
 * Sales tax totals for a period, read from the tax return (src/lib/taxReturnDocs.ts buildTaxReturn),
 * the one place tax is added up since the old report function was retired (L-119).
 */
import { buildTaxReturn } from '../../lib/taxReturnDocs';
import type { TaxableDocument } from '../../lib/taxReturnDocs';

export function taxTotals(invoices: unknown[], bills: unknown[], startDate: string, endDate: string) {
  const ret = buildTaxReturn({ invoices: invoices as TaxableDocument[], bills: bills as TaxableDocument[], startDate, endDate });
  const box = (key: string) => ret.boxes.find(b => b.key === key)?.cents ?? 0;
  return {
    taxCollectedCents: box('1'),
    taxPaidCents: box('4'),
    netTaxLiabilityCents: box('5'),
    taxableSalesCents: box('6'),
    taxablePurchasesCents: box('7'),
  };
}
