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
  categorySuggestion?: string;
  lines?: ReceiptLineItem[];
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
 * Validates a parsed receipt payload for mathematical consistency and absence of summary rows.
 * Rejects payloads containing SUBTOTAL/TAX/TOTAL rows in `lines`, or whose itemized sums
 * deviate from totalAmountCents by more than 1 cent.
 */
export function validateReceiptPayload(data: ParsedReceiptData): { valid: boolean; error?: string } {
  if (!data) {
    return { valid: false, error: 'Receipt data is null or empty.' };
  }

  const lines = data.lines || [];

  // 1. Detect and reject summary rows in line items
  for (const line of lines) {
    if (isReceiptAggregateRow(line.description)) {
      return {
        valid: false,
        error: `Receipt rejected: Line items contain summary row "${line.description}". Lines must only contain itemized purchasable products.`
      };
    }
  }

  // 2. Enforce scalar math: sum(lines.amountCents) + tax + tip === totalAmountCents
  if (lines.length > 0) {
    const itemsSum = lines.reduce((acc, l) => acc + (l.amountCents || 0), 0);
    const taxCents = data.taxAmountCents || 0;
    const tipCents = data.tipAmountCents || 0;
    const totalCents = data.totalAmountCents || 0;
    const expectedSum = itemsSum + taxCents + tipCents;

    if (Math.abs(expectedSum - totalCents) > 1) {
      return {
        valid: false,
        error: `Receipt reconciliation mismatch: items sum ($${(itemsSum / 100).toFixed(2)}) + tax/tip ($${((taxCents + tipCents) / 100).toFixed(2)}) = $${(expectedSum / 100).toFixed(2)}, which does not match total ($${(totalCents / 100).toFixed(2)}).`
      };
    }
  }

  return { valid: true };
}

/**
 * Resolves an account from the chart of accounts using deep hierarchical matching.
 * Guarantees that accountName and accountId are completely synchronized, never leaving
 * accountName set to an unmapped string while accountId points elsewhere.
 */
export function resolveDeepAccount(
  categoryCandidate: string,
  accounts: ChartAccount[],
  fallbackReviewAccount?: ChartAccount
): { accountId: string; accountName: string } {
  const fallback = fallbackReviewAccount || accounts.find(a =>
    a.name === 'Manual Review' ||
    a.name === 'Uncategorized Expense' ||
    a.name === 'Suspense' ||
    a.name === 'Review Required'
  ) || accounts.find(a => resolveAccountRole(a) === 'expense' || a.type === 'expense') || accounts[0];

  if (!categoryCandidate) {
    return {
      accountId: fallback ? fallback.id : '',
      accountName: fallback ? fallback.name : 'Manual Review'
    };
  }

  // Exact full name match first
  let matched = accounts.find(a => a.name.toLowerCase() === categoryCandidate.toLowerCase());

  // Check from most specific leaf segment up to root
  if (!matched) {
    const { segments } = decomposeHierarchicalLabel(categoryCandidate);
    const reversedSegments = [...segments].reverse();
    for (const segment of reversedSegments) {
      matched = accounts.find(a =>
        a.name.toLowerCase() === segment.toLowerCase() ||
        matchDeepLabel(a.name, segment, true) ||
        (a.category && matchDeepLabel(a.category, segment, true))
      );
      if (matched) break;
    }
  }

  // If still not matched, try matching full path with matchDeepLabel
  if (!matched) {
    matched = accounts.find(a =>
      matchDeepLabel(a.name, categoryCandidate, true) ||
      (a.category && matchDeepLabel(a.category, categoryCandidate, true))
    );
  }

  const finalAccount = matched || fallback;
  return {
    accountId: finalAccount ? finalAccount.id : '',
    accountName: finalAccount ? finalAccount.name : 'Manual Review'
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
    const categoryPath = (rawLine.category && (rawLine.category.includes('/') || rawLine.category.includes('>') || rawLine.category.includes(':')))
      ? rawLine.category
      : (engineMatch?.dimensions?.category || rawLine.category || categoryCandidate || accountName);

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
    const defaultAmount = (data.totalAmountCents || 0) - (data.taxAmountCents || 0) - (data.tipAmountCents || 0);
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
