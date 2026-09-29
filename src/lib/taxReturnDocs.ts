/**
 * Turns invoices, bills, credit notes and vendor credits into the tax return's inputs
 * (src/lib/taxCodes.ts computeTaxReturn), using the one money rule for net and tax
 * (documentMath.ts). Used by the Tax return screen and by the server when a return is filed.
 */
import { calculateDocumentNet, calculateDocumentTax } from './documentMath';
import type { DocumentTaxInput } from './documentMath';
import { computeTaxReturn } from './taxCodes';
import type { TaxReturn, TaxReturnDocument, TaxTreatment } from './taxCodes';

export interface TaxableDocument extends DocumentTaxInput {
  id: string;
  date?: string;
  issueDate?: string;
  status?: string;
  exchangeRate?: number;
  taxTreatment?: TaxTreatment;
  selfAssessedTaxCents?: number;
}

export function taxReturnDocument(doc: TaxableDocument): TaxReturnDocument {
  return {
    id: doc.id,
    date: doc.date || doc.issueDate,
    status: doc.status,
    exchangeRate: doc.exchangeRate,
    taxTreatment: doc.taxTreatment,
    netCents: calculateDocumentNet(doc),
    taxCents: calculateDocumentTax(doc),
    selfAssessedCents: doc.selfAssessedTaxCents || 0,
  };
}

export function buildTaxReturn(input: {
  invoices: TaxableDocument[];
  bills: TaxableDocument[];
  creditNotes?: TaxableDocument[];
  vendorCredits?: TaxableDocument[];
  startDate: string;
  endDate: string;
}): TaxReturn {
  return computeTaxReturn({
    startDate: input.startDate,
    endDate: input.endDate,
    sales: input.invoices.map(taxReturnDocument),
    salesCredits: (input.creditNotes || []).map(taxReturnDocument),
    purchases: input.bills.map(taxReturnDocument),
    purchaseCredits: (input.vendorCredits || []).map(taxReturnDocument),
  });
}

/** Box-by-box differences between a filed return and the same period recomputed now (T-07, T-08). */
export function returnChanges(filed: Pick<TaxReturn, 'boxes'>, now: Pick<TaxReturn, 'boxes'>): Array<{ key: string; label: string; filedCents: number; nowCents: number }> {
  return now.boxes
    .map(box => ({ key: box.key, label: box.label, filedCents: filed.boxes.find(b => b.key === box.key)?.cents ?? 0, nowCents: box.cents }))
    .filter(change => change.filedCents !== change.nowCents);
}
