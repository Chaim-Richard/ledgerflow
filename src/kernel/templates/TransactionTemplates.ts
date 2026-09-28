import { TransactionLine } from '../../types';

export interface AccountRef {
  id: string;
  name: string;
}

/** A document line's account and its amount as entered (used only as a weight). */
export interface LineAccountWeight {
  account: AccountRef;
  weightCents: number;
}

/**
 * Splits an amount over weights so the parts add up exactly (largest remainder). Used to post
 * revenue / expense to the accounts chosen on the document's lines (L-115).
 */
export function allocateCents(totalCents: number, weights: number[]): number[] {
  const positive = weights.map(w => Math.max(0, w));
  const sum = positive.reduce((s, w) => s + w, 0);
  if (sum <= 0 || weights.length === 0) return weights.map((_, i) => (i === 0 ? totalCents : 0));
  const exact = positive.map(w => (totalCents * w) / sum);
  const parts = exact.map(x => Math.floor(x));
  let remainder = totalCents - parts.reduce((s, p) => s + p, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) parts[order[k].i] += 1;
  return parts;
}

/** One posting line per account (lines on the same account are added together). */
function splitByAccount(totalCents: number, fallback: AccountRef, lineAccounts: LineAccountWeight[] | undefined): Array<{ account: AccountRef; amountCents: number }> {
  if (!lineAccounts || lineAccounts.length === 0) return [{ account: fallback, amountCents: totalCents }];
  const parts = allocateCents(totalCents, lineAccounts.map(l => l.weightCents));
  const byAccount = new Map<string, { account: AccountRef; amountCents: number }>();
  lineAccounts.forEach((l, i) => {
    const entry = byAccount.get(l.account.id) || { account: l.account, amountCents: 0 };
    entry.amountCents += parts[i];
    byAccount.set(l.account.id, entry);
  });
  return [...byAccount.values()].filter(e => e.amountCents !== 0);
}

export interface InvoiceTemplateParams {
  invoiceNumber: string;
  customerName: string;
  totalCents: number;
  taxCents?: number;
  discountCents?: number;
  retainageCents?: number;
  exchangeRate?: number;
  arAccount: AccountRef;
  revenueAccount: AccountRef;
  /** The income account of each invoice line; revenue is posted to them in proportion. */
  lineAccounts?: LineAccountWeight[];
  taxAccount?: AccountRef | null;
  discountAccount?: AccountRef | null;
  retainageAccount?: AccountRef | null;
}

export interface BillTemplateParams {
  billNumber: string;
  vendorName: string;
  totalCents: number;
  taxCents?: number;
  discountCents?: number;
  retainageCents?: number;
  exchangeRate?: number;
  apAccount: AccountRef;
  expenseAccount: AccountRef;
  /** The expense account of each bill line; the cost is posted to them in proportion. */
  lineAccounts?: LineAccountWeight[];
  taxAccount?: AccountRef | null;
  discountAccount?: AccountRef | null;
  retainageAccount?: AccountRef | null;
}

export interface PaymentTemplateParams {
  documentNumber: string;
  entityName: string;
  amountCents: number;
  exchangeRate?: number;
  cashAccount: AccountRef;
  offsetAccount: AccountRef;
  isReceipt: boolean; // true = customer payment (DR Cash, CR A/R), false = vendor payment (DR A/P, CR Cash)
}

export class TransactionTemplates {
  /**
   * Generates balanced double-entry lines for an Invoice.
   * Debits: A/R (net of retainage), Retainage Receivable, Sales Discounts.
   * Credits: Sales Revenue, Sales Tax Payable.
   */
  public static buildInvoiceLines(params: InvoiceTemplateParams): TransactionLine[] {
    const rate = params.exchangeRate || 1;
    const taxCents = params.taxCents || 0;
    const discountCents = params.discountCents || 0;
    const retainageCents = params.retainageCents || 0;
    const netArCents = params.totalCents - retainageCents;
    const grossRevenueCents = params.totalCents + discountCents - taxCents;

    const lines: TransactionLine[] = [
      {
        accountId: params.arAccount.id,
        accountName: params.arAccount.name,
        amountCents: netArCents, // Debit A/R
        description: `Accounts Receivable posting for Invoice ${params.invoiceNumber}`,
        exchangeRate: rate
      }
    ];

    if (retainageCents > 0 && params.retainageAccount) {
      lines.push({
        accountId: params.retainageAccount.id,
        accountName: params.retainageAccount.name,
        amountCents: retainageCents, // Debit Retainage Receivable
        description: `Retainage withheld on Invoice ${params.invoiceNumber}`,
        exchangeRate: rate
      });
    }

    if (discountCents > 0 && params.discountAccount) {
      lines.push({
        accountId: params.discountAccount.id,
        accountName: params.discountAccount.name,
        amountCents: discountCents, // Debit Sales Discounts
        description: `Sales discount applied on Invoice ${params.invoiceNumber}`,
        exchangeRate: rate
      });
    }

    for (const part of splitByAccount(grossRevenueCents, params.revenueAccount, params.lineAccounts)) {
      lines.push({
        accountId: part.account.id,
        accountName: part.account.name,
        amountCents: -part.amountCents, // Credit Sales Revenue
        description: `Sales Revenue for Invoice ${params.invoiceNumber} (${params.customerName})`,
        exchangeRate: rate
      });
    }

    if (taxCents > 0 && params.taxAccount) {
      lines.push({
        accountId: params.taxAccount.id,
        accountName: params.taxAccount.name,
        amountCents: -taxCents, // Credit Tax Payable
        description: `Sales tax collected on Invoice ${params.invoiceNumber}`,
        exchangeRate: rate
      });
    }

    return lines;
  }

  /**
   * Generates balanced double-entry lines for a Bill.
   * Debits: Expense/COGS, Input Tax Asset.
   * Credits: A/P (net of retainage), Retainage Payable, Purchase Discounts.
   */
  public static buildBillLines(params: BillTemplateParams): TransactionLine[] {
    const rate = params.exchangeRate || 1;
    const taxCents = params.taxCents || 0;
    const discountCents = params.discountCents || 0;
    const retainageCents = params.retainageCents || 0;
    const netApCents = params.totalCents - retainageCents;
    const grossExpenseCents = params.totalCents + discountCents - taxCents;

    const lines: TransactionLine[] = splitByAccount(grossExpenseCents, params.expenseAccount, params.lineAccounts).map(part => ({
      accountId: part.account.id,
      accountName: part.account.name,
      amountCents: part.amountCents, // Debit Expense/COGS
      description: `Expense posting for Bill ${params.billNumber} (${params.vendorName})`,
      exchangeRate: rate
    }));

    if (taxCents > 0 && params.taxAccount) {
      lines.push({
        accountId: params.taxAccount.id,
        accountName: params.taxAccount.name,
        amountCents: taxCents, // Debit Tax Asset / Recoverable Tax
        description: `Input tax recoverable on Bill ${params.billNumber}`,
        exchangeRate: rate
      });
    }

    lines.push({
      accountId: params.apAccount.id,
      accountName: params.apAccount.name,
      amountCents: -netApCents, // Credit A/P
      description: `Accounts Payable posting for Bill ${params.billNumber}`,
      exchangeRate: rate
    });

    if (retainageCents > 0 && params.retainageAccount) {
      lines.push({
        accountId: params.retainageAccount.id,
        accountName: params.retainageAccount.name,
        amountCents: -retainageCents, // Credit Retainage Payable
        description: `Retainage withheld on Bill ${params.billNumber}`,
        exchangeRate: rate
      });
    }

    if (discountCents > 0 && params.discountAccount) {
      lines.push({
        accountId: params.discountAccount.id,
        accountName: params.discountAccount.name,
        amountCents: -discountCents, // Credit Purchase Discounts
        description: `Purchase discount earned on Bill ${params.billNumber}`,
        exchangeRate: rate
      });
    }

    return lines;
  }

  /**
   * Generates exact reversal lines for a prior transaction.
   */
  public static buildReversalLines(originalLines: TransactionLine[], txDescription: string): TransactionLine[] {
    return (originalLines || []).map((l) => ({
      ...l,
      amountCents: -l.amountCents,
      description: `Reversal: ${l.description || txDescription}`
    }));
  }

  /**
   * Generates balanced double-entry lines for a Payment (Receipt or Outflow).
   */
  public static buildPaymentLines(params: PaymentTemplateParams): TransactionLine[] {
    const rate = params.exchangeRate || 1;
    const amount = params.amountCents;

    if (params.isReceipt) {
      // DR Cash, CR offset (e.g. A/R)
      return [
        {
          accountId: params.cashAccount.id,
          accountName: params.cashAccount.name,
          amountCents: amount, // Debit
          description: `Cash collection for Invoice ${params.documentNumber}`,
          exchangeRate: rate
        },
        {
          accountId: params.offsetAccount.id,
          accountName: params.offsetAccount.name,
          amountCents: -amount, // Credit
          description: `A/R clearance for Invoice ${params.documentNumber}`,
          exchangeRate: rate
        }
      ];
    } else {
      // DR offset (e.g. A/P), CR Cash
      return [
        {
          accountId: params.offsetAccount.id,
          accountName: params.offsetAccount.name,
          amountCents: amount, // Debit
          description: `Accounts Payable clearance for Bill ${params.documentNumber}`,
          exchangeRate: rate
        },
        {
          accountId: params.cashAccount.id,
          accountName: params.cashAccount.name,
          amountCents: -amount, // Credit
          description: `Cash payment for Bill ${params.documentNumber}`,
          exchangeRate: rate
        }
      ];
    }
  }
}
