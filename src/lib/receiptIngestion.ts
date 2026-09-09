import { ChartAccount, TransactionLine } from '../types';
import { MatchingEngine } from './MatchingEngine';
import { matchDeepLabel, decomposeHierarchicalLabel, setLineDimension } from './dimensionUtils';
import { resolveAccountRole } from './accountUtils';

export interface ReceiptLineItem {
  description: string;
  amountCents: number;
  category?: string;
  quantity?: number;
  unitPriceCents?: number;
  tags?: string[];
}

export interface ParsedReceiptData {
  vendorName?: string;
  date?: string;
  totalAmountCents: number;
  taxAmountCents?: number;
  tipAmountCents?: number;
  discountAmountCents?: number;
  serviceChargeAmountCents?: number;
  roundingAdjustmentCents?: number;
  categorySuggestion?: string;
  lines?: ReceiptLineItem[];
}

/**
 * Computes the canonical expected total cents for a receipt:
 * expectedTotal = sum(lines) - discount + serviceCharge + tax + tip + rounding
 */
export function computeExpectedTotalCents(d: ParsedReceiptData): number {
  const itemsSum = (d.lines || []).reduce((acc, l) => acc + (l.amountCents || 0), 0);
  const discountCents = d.discountAmountCents || 0;
  const serviceChargeCents = d.serviceChargeAmountCents || 0;
  const taxCents = d.taxAmountCents || 0;
  const tipCents = d.tipAmountCents || 0;
  const roundingCents = d.roundingAdjustmentCents || 0;

  return itemsSum - discountCents + serviceChargeCents + taxCents + tipCents + roundingCents;
}

/**
 * Derives the pre-tax item expense amount for unitemized fallback receipts:
 * items = total - tax - tip - serviceCharge + discount - rounding
 */
export function computeFallbackItemExpenseCents(d: ParsedReceiptData): number {
  const totalCents = d.totalAmountCents || 0;
  const discountCents = d.discountAmountCents || 0;
  const serviceChargeCents = d.serviceChargeAmountCents || 0;
  const taxCents = d.taxAmountCents || 0;
  const tipCents = d.tipAmountCents || 0;
  const roundingCents = d.roundingAdjustmentCents || 0;

  return totalCents - taxCents - tipCents - serviceChargeCents + discountCents - roundingCents;
}

/**
 * Detects whether a receipt line item description is an aggregate / summary row
 * (e.g. SUBTOTAL, TAX, TOTAL, TIP, PAYMENT) rather than a purchasable item.
 */
export function isReceiptAggregateRow(description: string): boolean {
  if (!description || typeof description !== 'string') return false;
  const d = description.toLowerCase().trim();
  
  const exactKeywords = [
    'subtotal', 'sub total', 'sub-total',
    'tax', 'sales tax', 'tax total', 'hst', 'gst', 'pst', 'vat',
    'tip', 'gratuity',
    'total', 'grand total', 'amount due', 'balance due', 'total due',
    'change', 'change due',
    'payment', 'cash', 'visa', 'mastercard', 'amex', 'debit', 'credit card'
  ];

  if (exactKeywords.includes(d)) return true;

  // Regex check for words like "subtotal: $18.48", "tax: 1.52", "total due $20.00"
  if (/^(subtotal|sub\s*total|tax|sales\s*tax|tax\s*total|hst|gst|pst|vat|tip|gratuity|total|grand\s*total|amount\s*due|balance\s*due|total\s*due|change|payment)\b/i.test(d)) {
    return true;
  }
  // Standalone single word checks with trailing punctuation/symbols
  if (/^(subtotal|tax|tip|total|change|payment)[:\s$\d.,]*$/i.test(d)) {
    return true;
  }

  return false;
}

/**
 * Validates a parsed receipt payload for mathematical consistency, absence of summary rows,
 * and individual line item arithmetic integrity.
 * 
 * Rejects payloads containing:
 * 1. Non-finite or negative total, tax, tip, or line amounts.
 * 2. SUBTOTAL/TAX/TOTAL/CHANGE summary rows in `lines`.
 * 3. Individual line items whose quantity × unitPriceCents deviates from amountCents.
 * 4. Overall reconciliation mismatch between item sum + tax + tip and totalAmountCents.
 */
export function validateReceiptPayload(data: ParsedReceiptData): { valid: boolean; error?: string } {
  if (!data) {
    return { valid: false, error: 'Receipt data is null or empty.' };
  }

  const totalCents = data.totalAmountCents;
  if (typeof totalCents !== 'number' || !Number.isFinite(totalCents) || !Number.isInteger(totalCents) || totalCents < 0) {
    return {
      valid: false,
      error: `Invalid receipt total amount: ${totalCents}. Must be an integer number of cents.`
    };
  }

  const taxCents = data.taxAmountCents ?? 0;
  if (typeof taxCents !== 'number' || !Number.isFinite(taxCents) || !Number.isInteger(taxCents) || taxCents < 0) {
    return {
      valid: false,
      error: `Invalid receipt tax amount: ${taxCents}. Must be an integer number of cents.`
    };
  }

  const tipCents = data.tipAmountCents ?? 0;
  if (typeof tipCents !== 'number' || !Number.isFinite(tipCents) || !Number.isInteger(tipCents) || tipCents < 0) {
    return {
      valid: false,
      error: `Invalid receipt tip amount: ${tipCents}. Must be an integer number of cents.`
    };
  }

  const discountCents = data.discountAmountCents ?? 0;
  if (typeof discountCents !== 'number' || !Number.isFinite(discountCents) || !Number.isInteger(discountCents) || discountCents < 0) {
    return {
      valid: false,
      error: `Invalid receipt discount amount: ${discountCents}. Must be an integer number of cents.`
    };
  }

  const serviceChargeCents = data.serviceChargeAmountCents ?? 0;
  if (typeof serviceChargeCents !== 'number' || !Number.isFinite(serviceChargeCents) || !Number.isInteger(serviceChargeCents) || serviceChargeCents < 0) {
    return {
      valid: false,
      error: `Invalid receipt service charge amount: ${serviceChargeCents}. Must be an integer number of cents.`
    };
  }

  const roundingCents = data.roundingAdjustmentCents ?? 0;
  if (typeof roundingCents !== 'number' || !Number.isFinite(roundingCents) || !Number.isInteger(roundingCents)) {
    return {
      valid: false,
      error: `Invalid receipt rounding adjustment amount: ${roundingCents}. Must be an integer number of cents.`
    };
  }

  const lines = data.lines || [];

  // 1. Detect summary rows and enforce per-item quantity / unit-price arithmetic
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const desc = line.description?.trim() || '';

    if (!desc) {
      return {
        valid: false,
        error: `Receipt rejected: Line item #${i + 1} has an empty description.`
      };
    }

    if (isReceiptAggregateRow(desc)) {
      return {
        valid: false,
        error: `Receipt rejected: Line items contain summary row "${desc}". Lines must only contain itemized purchasable products.`
      };
    }

    if (typeof line.amountCents !== 'number' || !Number.isFinite(line.amountCents) || !Number.isInteger(line.amountCents) || line.amountCents < 0) {
      return {
        valid: false,
        error: `Receipt rejected: Line item "${desc}" has invalid amountCents (${line.amountCents}). Must be an integer number of cents.`
      };
    }

    if (line.quantity !== undefined && line.quantity !== null) {
      if (typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity <= 0) {
        return {
          valid: false,
          error: `Receipt rejected: Line item "${desc}" has invalid quantity (${line.quantity}). Must be a positive finite number.`
        };
      }
    }

    if (line.unitPriceCents !== undefined && line.unitPriceCents !== null) {
      if (typeof line.unitPriceCents !== 'number' || !Number.isFinite(line.unitPriceCents) || !Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
        return {
          valid: false,
          error: `Receipt rejected: Line item "${desc}" has invalid unitPriceCents (${line.unitPriceCents}). Must be an integer number of cents.`
        };
      }
    }

    // If both quantity and unitPriceCents are specified, check internal arithmetic consistency
    if (line.quantity !== undefined && line.quantity !== null && line.quantity > 0 &&
        line.unitPriceCents !== undefined && line.unitPriceCents !== null && line.unitPriceCents >= 0) {
      const calculatedAmount = Math.round(line.quantity * line.unitPriceCents);
      // Allow up to 2 cents rounding discrepancy for fractional item tax/unit calculations
      if (Math.abs(calculatedAmount - line.amountCents) > 2) {
        return {
          valid: false,
          error: `Receipt item arithmetic mismatch on "${desc}": quantity (${line.quantity}) × unit price ($${(line.unitPriceCents / 100).toFixed(2)}) = $${(calculatedAmount / 100).toFixed(2)}, which deviates from item amount ($${(line.amountCents / 100).toFixed(2)}).`
        };
      }
    }
  }

  // 2. Enforce complete economic equation using canonical calculation helper
  if (lines.length > 0) {
    const expectedSum = computeExpectedTotalCents(data);
    const itemsSum = lines.reduce((acc, l) => acc + (l.amountCents || 0), 0);

    if (Math.abs(expectedSum - totalCents) > 1) {
      return {
        valid: false,
        error: `Receipt reconciliation mismatch: items sum ($${(itemsSum / 100).toFixed(2)}) - discount ($${(discountCents / 100).toFixed(2)}) + service charge ($${(serviceChargeCents / 100).toFixed(2)}) + tax/tip ($${((taxCents + tipCents) / 100).toFixed(2)}) + rounding ($${(roundingCents / 100).toFixed(2)}) = $${(expectedSum / 100).toFixed(2)}, which does not match total ($${(totalCents / 100).toFixed(2)}).`
      };
    }
  }

  return { valid: true };
}

/**
 * Checks if a chart account is active and not archived.
 */
export function isAccountActiveAndAvailable(a: ChartAccount | undefined | null): boolean {
  if (!a) return false;
  if ((a as any).archived === true || (a as any).isArchived === true) return false;
  if (a.isActive === false) return false;
  return true;
}

/**
 * Resolves an account from the chart of accounts using deep hierarchical matching.
 * Guarantees that accountName and accountId are completely synchronized, never leaving
 * accountName set to an unmapped string while accountId points elsewhere.
 * Skips accounts where archived === true || isActive === false, falling through
 * to Manual Review with the original category preserved in dimensions.
 */
export function resolveDeepAccount(
  categoryCandidate: string,
  accounts: ChartAccount[],
  fallbackReviewAccount?: ChartAccount
): { accountId: string; accountName: string; isFallback?: boolean } {
  const activeAccounts = accounts.filter(isAccountActiveAndAvailable);
  const fallback = (fallbackReviewAccount && isAccountActiveAndAvailable(fallbackReviewAccount) ? fallbackReviewAccount : undefined) ||
    activeAccounts.find(a =>
      a.name === 'Manual Review' ||
      a.name === 'Uncategorized Expense' ||
      a.name === 'Suspense' ||
      a.name === 'Review Required'
    ) ||
    activeAccounts.find(a => resolveAccountRole(a) === 'expense' || a.type === 'expense') ||
    activeAccounts[0];

  if (!categoryCandidate) {
    return {
      accountId: fallback ? fallback.id : '',
      accountName: fallback ? fallback.name : 'Manual Review',
      isFallback: true
    };
  }

  // Exact full name match first (only active accounts)
  let matched = activeAccounts.find(a => a.name.toLowerCase() === categoryCandidate.toLowerCase());

  // Check from most specific leaf segment up to root
  if (!matched) {
    const { segments } = decomposeHierarchicalLabel(categoryCandidate);
    const reversedSegments = [...segments].reverse();
    for (const segment of reversedSegments) {
      matched = activeAccounts.find(a =>
        a.name.toLowerCase() === segment.toLowerCase() ||
        matchDeepLabel(a.name, segment, true) ||
        (a.category && matchDeepLabel(a.category, segment, true))
      );
      if (matched) break;
    }
  }

  // If still not matched, try matching full path with matchDeepLabel
  if (!matched) {
    matched = activeAccounts.find(a =>
      matchDeepLabel(a.name, categoryCandidate, true) ||
      (a.category && matchDeepLabel(a.category, categoryCandidate, true))
    );
  }

  const finalAccount = matched || fallback;
  const isFallback = !matched;
  return {
    accountId: finalAccount ? finalAccount.id : '',
    accountName: finalAccount ? finalAccount.name : 'Manual Review',
    isFallback
  };
}

/**
 * Maps receipt line items to multi-dimensional coordinate lines.
 * Per-line execution of MatchingEngine + deep labeling coordinates (category, location, world, class).
 * Appends separate tax and tip lines mapped to appropriate accounts.
 */
export function mapReceiptToCoordinates(
  data: ParsedReceiptData,
  accounts: ChartAccount[],
  matchingEngine?: MatchingEngine,
  headerDimensions?: { world?: string; class?: string; project?: string }
): TransactionLine[] {
  const lines = data.lines || [];
  const vendorName = (data.vendorName || '').trim();

  const fallbackReviewAccount = accounts.find(a =>
    a.name === 'Manual Review' ||
    a.name === 'Uncategorized Expense' ||
    a.name === 'Suspense' ||
    a.name === 'Review Required'
  ) || accounts.find(a => resolveAccountRole(a) === 'expense' || a.type === 'expense') || accounts[0];

  const processedLines: TransactionLine[] = [];

  for (const rawLine of lines) {
    const desc = rawLine.description || 'Item';
    const amountCents = rawLine.amountCents || 0;

    // Per-line category resolution via MatchingEngine
    const engineMatch = matchingEngine?.resolveCategory(desc);

    // Determine category candidate
    const categoryCandidate = rawLine.category || engineMatch?.accountName || data.categorySuggestion || '';

    // Synchronized account resolution
    const { accountId, accountName } = resolveDeepAccount(categoryCandidate, accounts, fallbackReviewAccount);

    let line: TransactionLine = {
      accountId,
      accountName,
      amountCents,
      description: desc,
      quantity: rawLine.quantity,
      unitPriceCents: rawLine.unitPriceCents,
      tags: [...(rawLine.tags || []), ...(engineMatch?.tags || [])],
      dimensions: { ...(engineMatch?.dimensions || {}) }
    };

    // Determine deep hierarchical category path
    // If account fell through to Manual Review, ensure original category candidate is preserved in dimensions
    const categoryPath = (rawLine.category && (rawLine.category.includes('/') || rawLine.category.includes('>') || rawLine.category.includes(':')))
      ? rawLine.category
      : (categoryCandidate && (accountName === 'Manual Review' || accountName === 'Uncategorized Expense' || accountName === 'Suspense' || accountName === 'Review Required')
          ? categoryCandidate
          : (engineMatch?.dimensions?.category || rawLine.category || categoryCandidate || accountName));

    // Coordinate 1: Category (hierarchical path e.g. Groceries/Dairy/Milk)
    line = setLineDimension(line, 'category', categoryPath);

    // Coordinate 2: Location (the merchant)
    if (vendorName) {
      line = setLineDimension(line, 'location', vendorName);
    }

    // Coordinates 3, 4, 5: Carry world, class, project from header/context
    if (headerDimensions?.world) {
      line = setLineDimension(line, 'world', headerDimensions.world);
    }
    if (headerDimensions?.class) {
      line = setLineDimension(line, 'class', headerDimensions.class);
    }
    if (headerDimensions?.project) {
      line = setLineDimension(line, 'project', headerDimensions.project);
    }

    processedLines.push(line);
  }

  // If no item lines were extracted, provide single expense line
  if (processedLines.length === 0 && data.totalAmountCents > 0) {
    const defaultAmount = computeFallbackItemExpenseCents(data);
    const { accountId, accountName } = resolveDeepAccount(data.categorySuggestion || '', accounts, fallbackReviewAccount);

    let defaultLine: TransactionLine = {
      accountId,
      accountName,
      amountCents: defaultAmount,
      description: vendorName || 'Receipt Expense',
      dimensions: {}
    };
    if (data.categorySuggestion) {
      defaultLine = setLineDimension(defaultLine, 'category', data.categorySuggestion);
    }
    if (vendorName) {
      defaultLine = setLineDimension(defaultLine, 'location', vendorName);
    }
    processedLines.push(defaultLine);
  }

  // Tax Line: Post as dedicated line to Tax account
  const taxCents = data.taxAmountCents || 0;
  if (taxCents > 0) {
    const taxAccount = accounts.find(a =>
      (a as any).role === 'tax' ||
      (resolveAccountRole(a) as string) === 'tax' ||
      ((a.type === 'expense' || a.type === 'liability') && (a.name.toLowerCase().includes('tax') || (a.category && a.category.toLowerCase().includes('tax'))))
    ) || accounts.find(a => a.name.toLowerCase().includes('tax')) || fallbackReviewAccount;

    let taxLine: TransactionLine = {
      accountId: taxAccount ? taxAccount.id : '',
      accountName: taxAccount ? taxAccount.name : 'Sales Tax Expense',
      amountCents: taxCents,
      description: 'Sales Tax',
      tags: ['tax', 'sales-tax']
    };
    taxLine = setLineDimension(taxLine, 'category', 'Taxes');
    if (vendorName) {
      taxLine = setLineDimension(taxLine, 'location', vendorName);
    }
    if (headerDimensions?.world) {
      taxLine = setLineDimension(taxLine, 'world', headerDimensions.world);
    }
    processedLines.push(taxLine);
  }

  // Tip Line: Post as dedicated line if present
  const tipCents = data.tipAmountCents || 0;
  if (tipCents > 0) {
    const tipAccount = accounts.find(a =>
      a.name.toLowerCase().includes('tip') ||
      a.name.toLowerCase().includes('meals') ||
      (a.category && a.category.toLowerCase().includes('meals'))
    ) || fallbackReviewAccount;

    let tipLine: TransactionLine = {
      accountId: tipAccount ? tipAccount.id : '',
      accountName: tipAccount ? tipAccount.name : 'Tips & Gratuities',
      amountCents: tipCents,
      description: 'Tip / Gratuity',
      tags: ['tip']
    };
    tipLine = setLineDimension(tipLine, 'category', 'Meals/Tips');
    if (vendorName) {
      tipLine = setLineDimension(tipLine, 'location', vendorName);
    }
    processedLines.push(tipLine);
  }

  // Discount Line: Post as dedicated contra line if present
  const discountCents = data.discountAmountCents || 0;
  if (discountCents > 0) {
    const discountAccount = accounts.find(a =>
      a.name.toLowerCase().includes('discount') ||
      a.name.toLowerCase().includes('coupon') ||
      (a.category && a.category.toLowerCase().includes('discount'))
    ) || fallbackReviewAccount;

    let discountLine: TransactionLine = {
      accountId: discountAccount ? discountAccount.id : '',
      accountName: discountAccount ? discountAccount.name : 'Discounts & Savings',
      amountCents: -discountCents,
      description: 'Discount / Coupon Savings',
      tags: ['discount', 'savings']
    };
    discountLine = setLineDimension(discountLine, 'category', 'Discounts/Savings');
    if (vendorName) {
      discountLine = setLineDimension(discountLine, 'location', vendorName);
    }
    processedLines.push(discountLine);
  }

  // Service Charge Line: Post as dedicated line if present
  const serviceChargeCents = data.serviceChargeAmountCents || 0;
  if (serviceChargeCents > 0) {
    const serviceAccount = accounts.find(a =>
      a.name.toLowerCase().includes('service') ||
      a.name.toLowerCase().includes('fee') ||
      (a.category && a.category.toLowerCase().includes('fee'))
    ) || fallbackReviewAccount;

    let serviceLine: TransactionLine = {
      accountId: serviceAccount ? serviceAccount.id : '',
      accountName: serviceAccount ? serviceAccount.name : 'Service Fees & Charges',
      amountCents: serviceChargeCents,
      description: 'Service Charge / Fee',
      tags: ['service-charge', 'fee']
    };
    serviceLine = setLineDimension(serviceLine, 'category', 'Fees/Service Charges');
    if (vendorName) {
      serviceLine = setLineDimension(serviceLine, 'location', vendorName);
    }
    processedLines.push(serviceLine);
  }

  // Rounding Line: Post as dedicated variance line if non-zero
  const roundingCents = data.roundingAdjustmentCents || 0;
  if (roundingCents !== 0) {
    const roundingAccount = accounts.find(a =>
      a.name.toLowerCase().includes('round') ||
      a.name.toLowerCase().includes('variance')
    ) || fallbackReviewAccount;

    let roundingLine: TransactionLine = {
      accountId: roundingAccount ? roundingAccount.id : '',
      accountName: roundingAccount ? roundingAccount.name : 'Rounding Adjustment',
      amountCents: roundingCents,
      description: 'Cash Rounding Adjustment',
      tags: ['rounding']
    };
    roundingLine = setLineDimension(roundingLine, 'category', 'Adjustments/Rounding');
    if (vendorName) {
      roundingLine = setLineDimension(roundingLine, 'location', vendorName);
    }
    processedLines.push(roundingLine);
  }

  return processedLines;
}

/**
 * Builds a complete, balanced double-entry transaction from a receipt payload.
 * Validates the payload, maps debit lines with full coordinates, and balances with the
 * cash / settlement credit line for the exact amount paid.
 */
export function buildBalancedReceiptTransaction(
  data: ParsedReceiptData,
  accounts: ChartAccount[],
  matchingEngine?: MatchingEngine,
  headerDimensions?: { world?: string; class?: string; project?: string }
): {
  description: string;
  totalAmountCents: number;
  taxAmountCents: number;
  tipAmountCents: number;
  date?: string;
  lines: TransactionLine[];
} {
  const validation = validateReceiptPayload(data);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const debitLines = mapReceiptToCoordinates(data, accounts, matchingEngine, headerDimensions);

  // Settlement credit line (Cash / Credit Card payment)
  const totalCents = data.totalAmountCents;
  const cashAccount = accounts.find(a => resolveAccountRole(a) === 'cash') ||
    accounts.find(a => a.type === 'asset') ||
    accounts[0];

  const creditLine: TransactionLine = {
    accountId: cashAccount ? cashAccount.id : '',
    accountName: cashAccount ? cashAccount.name : 'Operating Cash',
    amountCents: -totalCents,
    description: `Payment to ${data.vendorName || 'Vendor'}`
  };
  if (data.vendorName) {
    creditLine.location = data.vendorName;
    creditLine.dimensions = { location: data.vendorName };
  }

  return {
    description: data.vendorName || 'Receipt Entry',
    totalAmountCents: totalCents,
    taxAmountCents: data.taxAmountCents || 0,
    tipAmountCents: data.tipAmountCents || 0,
    date: data.date,
    lines: [...debitLines, creditLine]
  };
}
