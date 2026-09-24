/**
 * Canonical Document Arithmetic & Tax Calculation Library
 * 
 * Central source of truth for:
 * 1. Tax calculation (inclusive vs. exclusive rates)
 * 2. Net taxable base calculations
 * 3. Amount due and payment settlements
 * 4. Line-item arithmetic across Invoices, Bills, Estimates, and Credit Notes.
 */

export interface DocumentTaxInput {
  amountCents?: number;
  taxAmountCents?: number;
  taxCents?: number;
  salesTaxCents?: number;
  taxRate?: number;
  taxInclusive?: boolean;
  discountCents?: number;
  retainageCents?: number;
}

/**
 * Normalizes user-entered tax rate (e.g. 20, 20.0, 0.20 -> 0.20)
 */
export function normalizeTaxRate(taxRate?: number): number {
  if (taxRate === undefined || taxRate === null || isNaN(taxRate) || taxRate <= 0) {
    return 0;
  }
  return taxRate > 1 ? taxRate / 100 : taxRate;
}

/**
 * Computes exact tax in integer cents for an invoice or bill.
 * Handles explicit overrides, tax-inclusive gross amounts, and tax-exclusive net amounts.
 */
export function calculateDocumentTax(doc: DocumentTaxInput): number {
  if (doc.taxAmountCents !== undefined && doc.taxAmountCents !== null && !isNaN(doc.taxAmountCents)) {
    return Math.max(0, Math.round(doc.taxAmountCents));
  }
  if (doc.taxCents !== undefined && doc.taxCents !== null && !isNaN(doc.taxCents)) {
    return Math.max(0, Math.round(doc.taxCents));
  }
  if (doc.salesTaxCents !== undefined && doc.salesTaxCents !== null && !isNaN(doc.salesTaxCents)) {
    return Math.max(0, Math.round(doc.salesTaxCents));
  }

  const rate = normalizeTaxRate(doc.taxRate);
  if (rate === 0) return 0;

  const discount = Math.max(0, doc.discountCents || 0);

  if (doc.taxInclusive) {
    // Total is tax inclusive (Total = Net + Tax)
    const grossTotal = Math.max(0, (doc.amountCents || 0) - discount);
    if (grossTotal === 0) return 0;
    const computedTax = grossTotal - (grossTotal / (1 + rate));
    return Math.max(0, Math.round(computedTax));
  } else {
    // Total/Amount is tax exclusive (Tax = Base * Rate)
    const taxableBase = Math.max(0, (doc.amountCents || 0) - discount);
    if (taxableBase === 0) return 0;
    return Math.max(0, Math.round(taxableBase * rate));
  }
}

/**
 * Computes the net pre-tax amount in integer cents.
 */
export function calculateDocumentNet(doc: DocumentTaxInput): number {
  const discount = Math.max(0, doc.discountCents || 0);

  if (doc.taxInclusive) {
    const grossTotal = Math.max(0, (doc.amountCents || 0) - discount);
    const tax = calculateDocumentTax(doc);
    return Math.max(0, grossTotal - tax);
  } else {
    const base = Math.max(0, (doc.amountCents || 0) - discount);
    return base;
  }
}

/**
 * Computes remaining amount due for invoices or bills considering payments made.
 */
export function calculateAmountDue(doc: {
  amountCents?: number;
  amountPaidCents?: number;
}): number {
  const total = Math.max(0, doc.amountCents || 0);
  const paid = Math.max(0, doc.amountPaidCents || 0);
  return Math.max(0, total - paid);
}

/**
 * The part of an invoice/bill's paid amount that its own ledger posting records as cash.
 * Payments recorded as payment records, and credits applied to the document, post their own
 * entries (or none: a credit already reduced receivables/payables when it was issued); they are
 * counted in `settledByRecordsCents` and must not be posted again when the document is re-posted.
 * A document marked paid without a recorded amount counts as paid in full ("mark as paid").
 */
export function cashPostedWithDocumentCents(doc: {
  amountCents?: number;
  amountPaidCents?: number;
  settledByRecordsCents?: number;
  status?: string;
}): number {
  if (doc.status !== 'paid' && doc.status !== 'partially_paid') return 0;
  const paid = doc.amountPaidCents || (doc.status === 'paid' ? Math.max(0, doc.amountCents || 0) : 0);
  return Math.max(0, paid - Math.max(0, doc.settledByRecordsCents || 0));
}
