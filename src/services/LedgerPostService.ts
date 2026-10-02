import { resolveAccountRole } from '../lib/accountUtils';
import { db, getIdToken } from '../firebase';
import { doc, getDoc } from '../lib/db/firestore';
import { toast } from 'sonner';
import { getLocalDateISO, roundCents } from '../lib/utils';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  ChartAccount, 
  Transaction, 
  TransactionLine,
  Workspace, 
  Invoice, 
  Bill, 
  CreditNote, 
  VendorCredit, 
  Payment,
  InventoryItem
} from '../types';
import { isPostable } from '../lib/txFilters';
import { calculateDocumentTax, cashPostedWithDocumentCents } from '../lib/documentMath';
import { TransactionTemplates } from '../kernel/templates/TransactionTemplates';
import type { LineAccountWeight } from '../kernel/templates/TransactionTemplates';
import { planInvoiceCogs } from './invoiceCogs';
import { isLockedDate } from '../lib/periodLock';

export interface EntityMutation {
  collection: string;
  docId: string;
  action: 'create' | 'update' | 'delete';
  data?: Record<string, unknown>;
}

export interface LedgerPostContext {
  accounts?: ChartAccount[];
  lockDate?: string | null;
  transactions?: Transaction[];
  workspaces?: Workspace[];
  inventory?: InventoryItem[];
  idempotencyKey?: string;
  bypassPost?: boolean;
  uid?: string;
}

export type PostableTransaction = Omit<Partial<Transaction>, 'lines' | 'status' | 'type'> & {
  uid: string;
  workspaceId: string;
  date: string;
  description: string;
  totalAmountCents: number;
  currency?: string;
  status?: Transaction['status'] | string;
  type?: Transaction['type'] | string;
  lines: TransactionLine[];
};

export class LedgerPostService {
  private static getAccounts(context?: LedgerPostContext): ChartAccount[] {
    return context?.accounts || useLedgerStore.getState().accounts || [];
  }
  private static getLockDate(context?: LedgerPostContext): string | null {
    if (context && context.lockDate !== undefined) return context.lockDate;
    return useLedgerStore.getState().lockDate;
  }
  private static getTransactions(context?: LedgerPostContext): Transaction[] {
    return context?.transactions || useLedgerStore.getState().transactions || [];
  }
  private static getWorkspaces(context?: LedgerPostContext): Workspace[] {
    return context?.workspaces || useAuthStore.getState().workspaces || [];
  }

  /**
   * The items an invoice sells, for cost of goods sold: the caller's list, else the loaded
   * inventory, plus any item on the invoice that isn't loaded yet (inventory loads only once a
   * screen needs it: src/lib/ledgerCollections.ts), read from the database.
   */
  private static async loadInventory(invoiceData: Partial<Invoice>, context?: LedgerPostContext): Promise<InventoryItem[]> {
    if (context?.inventory) return context.inventory;
    const loaded = useLedgerStore.getState().inventory || [];
    const known = new Set(loaded.map(i => i.id));
    const missing = [...new Set((invoiceData.items || []).map(l => l.itemId).filter((id): id is string => Boolean(id) && !known.has(id as string)))];
    if (!missing.length) return loaded;
    const fetched = await Promise.all(missing.map(async id => {
      const snap = await getDoc(doc(db, 'inventory', id)).catch(() => null);
      return snap?.exists() ? ({ id: snap.id, ...snap.data() } as InventoryItem) : null;
    }));
    return [...loaded, ...fetched.filter((i): i is InventoryItem => i !== null)];
  }

  /**
   * New postings are recorded in the base currency. The amounts are converted once
   * (document amount × the document's rate) before they get here, so the entry and every line
   * carry rate 1; otherwise lineAmount() would apply the rate a second time. The document's own
   * currency and rate are kept in metadata. Reversals keep the rates of what they reverse.
   */
  private static inBaseCurrency<T extends { currency?: string; exchangeRate?: number; lines: TransactionLine[]; metadata?: Record<string, unknown> }>(
    tx: T, workspaceId: string, context?: LedgerPostContext,
  ): T {
    const baseCurrency = this.getWorkspaces(context).find(w => w.id === workspaceId)?.currency || 'USD';
    return {
      ...tx,
      currency: baseCurrency,
      exchangeRate: 1,
      metadata: { ...(tx.metadata || {}), documentCurrency: tx.currency || baseCurrency, documentExchangeRate: tx.exchangeRate || 1 },
      lines: tx.lines.map(l => ({ ...l, exchangeRate: 1 })),
    };
  }

  /**
   * Period Lock Guard
   */
  public static verifyLockDate(dateStr: string, context?: LedgerPostContext): void {
    if (!dateStr) return;
    const lockDate = this.getLockDate(context);
    const exception = context && context.lockDate !== undefined ? null : useLedgerStore.getState().lockException;
    if (isLockedDate(dateStr, lockDate, exception)) {
      throw new Error(`Period is locked on or before ${lockDate}. Cannot post or modify transaction on ${dateStr}.`);
    }
  }

  /** Workspace mapping first, then the first chart account matching the predicate. */
  private static findAccount(
    accounts: ChartAccount[],
    workspaceMappings: Record<string, string>,
    keys: string[],
    predicate: (a: ChartAccount) => boolean
  ): { id: string; name: string } | undefined {
    for (const key of keys) {
      const mappedId = workspaceMappings[key.toLowerCase()];
      const acc = mappedId ? accounts.find(a => a.id === mappedId) : undefined;
      if (acc) return { id: acc.id, name: acc.name };
    }
    const found = accounts.find(predicate);
    return found ? { id: found.id, name: found.name } : undefined;
  }

  /**
   * Resolve specific accounts using workspace mappings first, then CHART fallbacks, or throw loudly.
   */
  private static resolveAccount(
    accounts: ChartAccount[],
    workspaceMappings: Record<string, string>,
    keys: string[],
    predicate: (a: ChartAccount) => boolean,
    errorName: string
  ): { id: string; name: string } {
    const found = this.findAccount(accounts, workspaceMappings, keys, predicate);
    if (found) return found;

    // 3. Fail loudly instead of using fake fallback IDs
    throw new Error(`Missing ${errorName} account. Please set up a ${errorName} account in Chart of Accounts or Workspace Settings.`);
  }

  /**
   * The account chosen on each document line (by id, or by name for lines typed by hand), so
   * revenue / cost goes where the user put it (L-115). A line without a usable account uses the
   * document's default account. Returns undefined when there are no lines.
   */
  private static lineAccounts(
    lines: Array<{ accountId?: string; amountCents?: number }> | undefined,
    accounts: ChartAccount[],
    fallback: { id: string; name: string },
    usable: (a: ChartAccount) => boolean
  ): LineAccountWeight[] | undefined {
    if (!Array.isArray(lines) || lines.length === 0) return undefined;
    return lines.map(line => {
      const key = String(line.accountId || '').trim();
      const account = key ? accounts.find(a => a.id === key) || accounts.find(a => (a.name || '').toLowerCase() === key.toLowerCase()) : undefined;
      return {
        account: account && usable(account) ? { id: account.id, name: account.name } : fallback,
        weightCents: Number(line.amountCents) || 0,
      };
    });
  }

  /**
   * Post standard double-entry journal entries for an invoice.
   * Reverses prior postings instead of deleting them.
   */
  static async postInvoiceLedger(
    invoiceId: string, 
    invoiceData: Partial<Invoice>, 
    workspaceId: string, 
    uid: string, 
    entityMutation?: EntityMutation, 
    context?: LedgerPostContext
  ): Promise<{ cogsPendingReason?: string }> {
    if (!workspaceId || !invoiceId) return {};

    const invoiceDate = invoiceData.date || getLocalDateISO();
    this.verifyLockDate(invoiceDate, context);

    const accounts = this.getAccounts(context);
    const workspaces = this.getWorkspaces(context);
    const currentWs = workspaces.find(w => w.id === workspaceId);
    const mappings = currentWs?.defaultAccountMappings || {};

    const arAccount = this.resolveAccount(
      accounts,
      mappings,
      ['ar', 'accounts receivable', 'receivables', 'receivable'],
      a => a.type === 'asset' && (a.category === 'Receivables' || a.name.toLowerCase().includes('receivable') || a.code === '1100'),
      'Accounts Receivable (A/R)'
    );

    const revenueAccount = this.resolveAccount(
      accounts,
      mappings,
      ['revenue', 'sales', 'income'],
      a => a.type === 'income' || a.category === 'Revenue' || a.category === 'Sales',
      'Sales Revenue'
    );

    const cashAccount = this.resolveAccount(
      accounts,
      mappings,
      ['cash', 'bank', 'checking'],
      a => resolveAccountRole(a) === 'cash',
      'Cash & Cash Equivalents'
    );

    // Find prior active non-reversal postings for this invoice to generate reversing entries
    // Improved logic: exclude any transaction that has ALREADY been reversed
    const allTxs = this.getTransactions(context).filter(t => t.metadata?.invoiceId === invoiceId);
    const reversedIds = new Set(allTxs.filter(t => t.metadata?.isReversal).map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId));
    
    const existingTxs = allTxs.filter(t => 
      isPostable(t) && 
      !t.metadata?.isReversal &&
      !reversedIds.has(t.id)
    );

    const txsToPost: PostableTransaction[] = [];
    const today = getLocalDateISO();

    // 1. Reversing entries for existing postings
    for (const prevTx of existingTxs) {
      txsToPost.push({
        uid,
        workspaceId,
        date: today,
        description: `Reversal of prior invoice posting (Invoice ${invoiceData.number || invoiceId})`,
        totalAmountCents: prevTx.totalAmountCents,
        currency: prevTx.currency || 'USD',
        exchangeRate: prevTx.exchangeRate || 1,
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        metadata: {
          invoiceId,
          type: 'invoice-reversal',
          reversesTxId: prevTx.id,
          isReversal: true
        },
        lines: TransactionTemplates.buildReversalLines(prevTx.lines || [], prevTx.description)
      });
    }

    const status = invoiceData.status || 'pending';
    if (status === 'draft' || status === 'rejected' || status === 'void' || status === 'cancelled') {
      // If setting to draft, rejected, voided, or cancelled, reversing prior postings (if any) is sufficient
      if (txsToPost.length > 0) {
        await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
      }
      return {};
    }

    const rawAmount = invoiceData.amountCents || 0;
    const rate = invoiceData.exchangeRate || 1;
    const amount = roundCents(rawAmount * rate);
    if (amount <= 0) { if (entityMutation) { await this.postTxsServerApi([], workspaceId, entityMutation); } return {}; }

    const invoiceNum = invoiceData.number || invoiceId;
    const customer = invoiceData.customerName || 'Customer';

    const taxAmount = roundCents(calculateDocumentTax(invoiceData) * rate);
    const discountAmount = roundCents((invoiceData.discountCents || 0) * rate);
    const retainageAmount = roundCents((invoiceData.retainageCents || 0) * rate);

    const taxAccount = taxAmount > 0 ? this.resolveAccount(
      accounts,
      mappings,
      ['tax payable', 'sales tax', 'tax liability', 'tax'],
      a => a.type === 'liability' && (a.name.toLowerCase().includes('tax') || a.category === 'Taxes'),
      'Sales Tax Payable'
    ) : null;

    const discountAccount = discountAmount > 0 ? this.resolveAccount(
      accounts,
      mappings,
      ['discount', 'sales discount'],
      a => a.type === 'expense' || (a.type === 'income' && a.name.toLowerCase().includes('discount')),
      'Sales Discounts'
    ) : null;
    
    const retainageAccount = retainageAmount > 0 ? this.resolveAccount(
      accounts,
      mappings,
      ['retainage', 'retention'],
      a => a.type === 'asset' && a.category === 'Receivables' && (a.name.toLowerCase().includes('retainage') || a.name.toLowerCase().includes('retention')),
      'Retainage Receivable'
    ) : null;
    
    const accrualLines = TransactionTemplates.buildInvoiceLines({
      invoiceNumber: String(invoiceNum),
      customerName: customer,
      totalCents: amount,
      taxCents: taxAmount,
      discountCents: discountAmount,
      retainageCents: retainageAmount,
      exchangeRate: rate,
      arAccount,
      revenueAccount,
      lineAccounts: this.lineAccounts(invoiceData.items, accounts, revenueAccount, a => a.type === 'income'),
      taxAccount,
      discountAccount,
      retainageAccount
    });

    const accrualTx = {
      uid,
      workspaceId,
      date: invoiceDate,
      description: `Invoice ${invoiceNum} - ${customer}`,
      totalAmountCents: amount,
      currency: invoiceData.currency || 'USD',
      exchangeRate: rate,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        invoiceId,
        customerId: invoiceData.customerId,
        type: 'invoice-accrual'
      },
      lines: accrualLines
    };
    txsToPost.push(this.inBaseCurrency(accrualTx, workspaceId, context));

    // 2.5 Cost of goods sold for lines that sell inventory items (the server moves the stock).
    const cogs = planInvoiceCogs({
      invoiceId, invoice: invoiceData, date: invoiceDate, uid, workspaceId,
      baseCurrency: currentWs?.currency || 'USD',
      inventoryAccount: this.findAccount(accounts, mappings, ['inventory', 'stock', 'inventory asset'], a => resolveAccountRole(a) === 'inventory'),
      cogsAccount: this.findAccount(accounts, mappings, ['cogs', 'cost of goods sold', 'direct costs'], a => resolveAccountRole(a) === 'cogs'),
      items: await this.loadInventory(invoiceData, context),
    });
    txsToPost.push(...cogs.entries);
    const wasPending = Boolean(invoiceData.metadata?.cogsPending);
    if (entityMutation && entityMutation.action !== 'delete' && (cogs.pendingReason || wasPending)) {
      entityMutation.data = { ...entityMutation.data, metadata: { ...(invoiceData.metadata || {}), cogsPending: Boolean(cogs.pendingReason) } };
    }

    // 3. Transaction 2: Payment Posting (DR Cash, CR A/R)
    if (status === 'paid' || status === 'partially_paid') {
      // Only what was marked paid on the document itself; payment records and credits post their own entries
      const paidAmtCents = roundCents(cashPostedWithDocumentCents({ ...invoiceData, status }) * rate);
      if (paidAmtCents > 0) {
        const paymentDate = invoiceData.paymentDate || invoiceData.paidAt || today;
        const paymentTx = {
          uid,
          workspaceId,
          date: paymentDate,
          description: `Payment Received for Invoice ${invoiceNum} - ${customer}`,
          totalAmountCents: paidAmtCents,
          currency: invoiceData.currency || 'USD',
          exchangeRate: rate,
          status: 'completed',
          type: 'actual',
          createdAt: new Date().toISOString(),
          metadata: {
            invoiceId,
            customerId: invoiceData.customerId,
            type: 'invoice-payment'
          },
          lines: TransactionTemplates.buildPaymentLines({
            documentNumber: String(invoiceNum),
            entityName: customer,
            amountCents: paidAmtCents,
            exchangeRate: rate,
            cashAccount,
            offsetAccount: arAccount,
            isReceipt: true
          })
        };
        txsToPost.push(this.inBaseCurrency(paymentTx, workspaceId, context));
      }
    }

    // Atomic post via Server API
    await this.postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
    return { cogsPendingReason: cogs.pendingReason };
  }

  /**
   * Post standard double-entry journal entries for a bill.
   * Reverses prior postings instead of deleting them.
   */
  static async postBillLedger(
    billId: string, 
    billData: Partial<Bill>, 
    workspaceId: string, 
    uid: string, 
    entityMutation?: EntityMutation, 
    context?: LedgerPostContext
  ) {
    if (!workspaceId || !billId) return;

    const billDate = billData.date || getLocalDateISO();
    this.verifyLockDate(billDate, context);

    const accounts = this.getAccounts(context);
    const workspaces = this.getWorkspaces(context);
    const currentWs = workspaces.find(w => w.id === workspaceId);
    const mappings = currentWs?.defaultAccountMappings || {};

    const apAccount = this.resolveAccount(
      accounts,
      mappings,
      ['ap', 'accounts payable', 'payables', 'payable'],
      a => a.type === 'liability' && (a.category === 'Payables' || a.name.toLowerCase().includes('payable') || a.code === '2000'),
      'Accounts Payable (A/P)'
    );

    const expenseAccount = this.resolveAccount(
      accounts,
      mappings,
      ['expense', 'operating expense'],
      a => a.type === 'expense' || a.category === 'Expense',
      'Operating Expense'
    );

    const cashAccount = this.resolveAccount(
      accounts,
      mappings,
      ['cash', 'bank', 'checking'],
      a => resolveAccountRole(a) === 'cash',
      'Cash & Cash Equivalents'
    );

    // Find prior active non-reversal postings for this bill
    // Improved logic: exclude any transaction that has ALREADY been reversed
    const allTxs = this.getTransactions(context).filter(t => t.metadata?.billId === billId);
    const reversedIds = new Set(allTxs.filter(t => t.metadata?.isReversal).map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId));
    
    const existingTxs = allTxs.filter(t => 
      isPostable(t) && 
      !t.metadata?.isReversal &&
      !reversedIds.has(t.id)
    );

    const txsToPost: PostableTransaction[] = [];
    const today = getLocalDateISO();

    // 1. Reversing entries for existing postings
    for (const prevTx of existingTxs) {
      txsToPost.push({
        uid,
        workspaceId,
        date: today,
        description: `Reversal of prior bill posting (Bill ${billData.number || billId})`,
        totalAmountCents: prevTx.totalAmountCents,
        currency: prevTx.currency || 'USD',
        exchangeRate: prevTx.exchangeRate || 1,
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        metadata: {
          billId,
          type: 'bill-reversal',
          reversesTxId: prevTx.id,
          isReversal: true
        },
        lines: TransactionTemplates.buildReversalLines(prevTx.lines || [], prevTx.description)
      });
    }

    const status = billData.status || 'pending';
    if (status === 'draft' || status === 'rejected' || status === 'void' || status === 'cancelled') {
      if (txsToPost.length > 0) {
        await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
      }
      return;
    }

    const rawAmount = billData.amountCents || 0;
    const rate = billData.exchangeRate || 1;
    const amount = roundCents(rawAmount * rate);
    if (amount <= 0) { if (entityMutation) { await this.postTxsServerApi([], workspaceId, entityMutation); } return; }

    const billNum = billData.number || billId;
    const vendor = billData.vendorName || 'Vendor';

    const taxAccount = this.resolveAccount(
      accounts,
      mappings,
      ['tax paid', 'input tax', 'tax asset', 'tax', 'tax expense'],
      a => (a.type === 'asset' || a.type === 'expense' || a.type === 'liability') && a.name.toLowerCase().includes('tax'),
      'Tax Paid'
    );

    // 2. Transaction 1: Accrual Posting
    const taxAmount = roundCents(calculateDocumentTax(billData) * rate);

    const accrualLines = TransactionTemplates.buildBillLines({
      billNumber: String(billNum),
      vendorName: vendor,
      totalCents: amount,
      taxCents: taxAmount,
      exchangeRate: rate,
      apAccount,
      expenseAccount,
      taxAccount,
      lineAccounts: this.lineAccounts(billData.splits, accounts, expenseAccount, a => !['cash', 'ar', 'ap'].includes(resolveAccountRole(a)))
    });

    // Reverse charge (T-03): the vendor charged no tax; the business owes it and reclaims it,
    // so the same amount goes to input tax (reclaimable) and to tax payable (due)
    const selfAssessed = roundCents((billData.selfAssessedTaxCents || 0) * rate);
    if (selfAssessed > 0) {
      const outputTaxAccount = this.findAccount(
        accounts,
        mappings,
        ['tax payable', 'sales tax', 'tax liability'],
        a => a.type === 'liability' && (a.name.toLowerCase().includes('tax') || a.category === 'Taxes')
      ) || taxAccount;
      accrualLines.push(
        { accountId: taxAccount.id, accountName: taxAccount.name, amountCents: selfAssessed, description: `Reverse-charge tax reclaimable on Bill ${billNum}`, exchangeRate: rate },
        { accountId: outputTaxAccount.id, accountName: outputTaxAccount.name, amountCents: -selfAssessed, description: `Reverse-charge tax due on Bill ${billNum}`, exchangeRate: rate }
      );
    }

    const accrualTx = {
      uid,
      workspaceId,
      date: billDate,
      description: `Bill ${billNum} - ${vendor}`,
      totalAmountCents: amount,
      currency: billData.currency || 'USD',
      exchangeRate: rate,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        billId,
        vendorId: billData.vendorId,
        type: 'bill-accrual'
      },
      lines: accrualLines
    };
    txsToPost.push(this.inBaseCurrency(accrualTx, workspaceId, context));

    // 3. Transaction 2: Payment Posting (DR A/P, CR Cash)
    if (status === 'paid' || status === 'partially_paid') {
      // Only what was marked paid on the document itself; payment records and credits post their own entries
      const paidAmtCents = roundCents(cashPostedWithDocumentCents({ ...billData, status }) * rate);
      if (paidAmtCents > 0) {
        const paymentDate = billData.paymentDate || billData.paidAt || today;
        const paymentTx = {
          uid,
          workspaceId,
          date: paymentDate,
          description: `Payment Sent for Bill ${billNum} - ${vendor}`,
          totalAmountCents: paidAmtCents,
          currency: billData.currency || 'USD',
          exchangeRate: rate,
          status: 'completed',
          type: 'actual',
          createdAt: new Date().toISOString(),
          metadata: {
            billId,
            vendorId: billData.vendorId,
            type: 'bill-payment'
          },
          lines: TransactionTemplates.buildPaymentLines({
            documentNumber: String(billNum),
            entityName: vendor,
            amountCents: paidAmtCents,
            exchangeRate: rate,
            cashAccount,
            offsetAccount: apAccount,
            isReceipt: false
          })
        };
        txsToPost.push(this.inBaseCurrency(paymentTx, workspaceId, context));
      }
    }

    // Atomic post via Server API
    await this.postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
  }

  /**
   * Post double-entry journal entries for a Customer Credit Note.
   */
  static async postCreditNoteLedger(
    creditNoteId: string, 
    creditNoteData: Partial<CreditNote>, 
    workspaceId: string, 
    uid: string, 
    entityMutation?: EntityMutation, 
    context?: LedgerPostContext
  ) {
    if (!workspaceId || !creditNoteId) return;

    const cnDate = creditNoteData.date || getLocalDateISO();
    this.verifyLockDate(cnDate, context);

    const accounts = this.getAccounts(context);
    const workspaces = this.getWorkspaces(context);
    const currentWs = workspaces.find(w => w.id === workspaceId);
    const mappings = currentWs?.defaultAccountMappings || {};

    const arAccount = this.resolveAccount(
      accounts,
      mappings,
      ['ar', 'accounts receivable', 'receivables', 'receivable'],
      a => a.type === 'asset' && (a.category === 'Receivables' || a.name.toLowerCase().includes('receivable') || a.code === '1100'),
      'Accounts Receivable (A/R)'
    );

    const salesReturnAccount = this.resolveAccount(
      accounts,
      mappings,
      ['revenue', 'sales', 'income', 'sales returns'],
      a => a.type === 'income' || a.category === 'Revenue',
      'Sales Returns / Revenue'
    );

    // Reversals of prior CN postings
    const allTxs = this.getTransactions(context).filter(t => t.metadata?.creditNoteId === creditNoteId);
    const reversedIds = new Set(allTxs.filter(t => t.metadata?.isReversal).map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId));
    
    const existingTxs = allTxs.filter(t => 
      isPostable(t) && 
      !t.metadata?.isReversal &&
      !reversedIds.has(t.id)
    );

    const txsToPost: PostableTransaction[] = [];
    const today = getLocalDateISO();

    for (const prevTx of existingTxs) {
      txsToPost.push({
        uid,
        workspaceId,
        date: today,
        description: `Reversal of prior credit note posting (CN ${creditNoteId})`,
        totalAmountCents: prevTx.totalAmountCents,
        currency: prevTx.currency || 'USD',
        exchangeRate: prevTx.exchangeRate || 1,
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        metadata: {
          creditNoteId,
          type: 'credit-note-reversal',
          reversesTxId: prevTx.id,
          isReversal: true
        },
        lines: TransactionTemplates.buildReversalLines(prevTx.lines || [], prevTx.description)
      });
    }

    if (creditNoteData.status === 'void') {
      // A credit already applied to invoices/bills or refunded can't be voided (that would undo money that moved)
      if (typeof creditNoteData.remainingCents === 'number' && creditNoteData.remainingCents < (creditNoteData.amountCents || 0)) {
        throw new Error('This credit has been applied or refunded and can no longer be voided.');
      }
      if (txsToPost.length > 0 || entityMutation) {
        await this.postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
      }
      return;
    }

    const rawAmount = creditNoteData.amountCents || 0;
    const rate = creditNoteData.exchangeRate || 1;
    const amount = roundCents(rawAmount * rate);
    if (amount <= 0) return;
    // The credited invoice's share of tax comes off tax payable too (L-118)
    const cnTax = creditNoteData.taxVersion === 2 ? Math.min(amount, roundCents((creditNoteData.taxAmountCents || 0) * rate)) : 0;
    const cnTaxAccount = cnTax > 0 ? this.resolveAccount(
      accounts,
      mappings,
      ['tax payable', 'sales tax', 'tax liability', 'tax'],
      a => a.type === 'liability' && (a.name.toLowerCase().includes('tax') || a.category === 'Taxes'),
      'Sales Tax Payable'
    ) : null;

    const cnTx = {
      uid,
      workspaceId,
      date: cnDate,
      description: `Credit Note ${creditNoteData.number || creditNoteId}: ${creditNoteData.customerName || 'Customer'}`,
      totalAmountCents: amount,
      currency: creditNoteData.currency || 'USD',
      exchangeRate: rate,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        creditNoteId,
        customerId: creditNoteData.customerId,
        type: 'credit-note-issuance'
      },
      lines: [
        { accountId: salesReturnAccount.id, accountName: salesReturnAccount.name, amountCents: amount - cnTax, debitCents: amount - cnTax, creditCents: 0, description: 'Sales Return / Discount' },
        ...(cnTax > 0 && cnTaxAccount ? [{ accountId: cnTaxAccount.id, accountName: cnTaxAccount.name, amountCents: cnTax, debitCents: cnTax, creditCents: 0, description: 'Sales tax reversed by the credit' }] : []),
        { accountId: arAccount.id, accountName: arAccount.name, amountCents: -amount, debitCents: 0, creditCents: amount, description: 'Accounts Receivable Credit' }
      ]
    };
    txsToPost.push(this.inBaseCurrency(cnTx, workspaceId, context));

    await this.postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
  }

  /**
   * Post double-entry journal entries for a Vendor Credit.
   */
  static async postVendorCreditLedger(
    vendorCreditId: string, 
    vendorCreditData: Partial<VendorCredit>, 
    workspaceId: string, 
    uid: string, 
    entityMutation?: EntityMutation, 
    context?: LedgerPostContext
  ) {
    if (!workspaceId || !vendorCreditId) return;

    const vcDate = vendorCreditData.date || getLocalDateISO();
    this.verifyLockDate(vcDate, context);

    const accounts = this.getAccounts(context);
    const workspaces = this.getWorkspaces(context);
    const currentWs = workspaces.find(w => w.id === workspaceId);
    const mappings = currentWs?.defaultAccountMappings || {};

    const apAccount = this.resolveAccount(
      accounts,
      mappings,
      ['ap', 'accounts payable', 'payables', 'payable'],
      a => a.type === 'liability' && (a.category === 'Payables' || a.name.toLowerCase().includes('payable') || a.code === '2000'),
      'Accounts Payable (A/P)'
    );

    const expenseAccount = this.resolveAccount(
      accounts,
      mappings,
      ['expense', 'purchase rebates', 'cogs'],
      a => a.type === 'expense' || a.category === 'Expense' || a.category === 'COGS',
      'Purchase Rebates / Expense'
    );

    // Reversals of prior VC postings
    const allTxs = this.getTransactions(context).filter(t => t.metadata?.vendorCreditId === vendorCreditId);
    const reversedIds = new Set(allTxs.filter(t => t.metadata?.isReversal).map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId));
    
    const existingTxs = allTxs.filter(t => 
      isPostable(t) && 
      !t.metadata?.isReversal &&
      !reversedIds.has(t.id)
    );

    const txsToPost: PostableTransaction[] = [];
    const today = getLocalDateISO();

    for (const prevTx of existingTxs) {
      txsToPost.push({
        uid,
        workspaceId,
        date: today,
        description: `Reversal of prior vendor credit posting (VC ${vendorCreditId})`,
        totalAmountCents: prevTx.totalAmountCents,
        currency: prevTx.currency || 'USD',
        exchangeRate: prevTx.exchangeRate || 1,
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        metadata: {
          vendorCreditId,
          type: 'vendor-credit-reversal',
          reversesTxId: prevTx.id,
          isReversal: true
        },
        lines: TransactionTemplates.buildReversalLines(prevTx.lines || [], prevTx.description)
      });
    }

    if (vendorCreditData.status === 'void') {
      // A credit already applied to invoices/bills or refunded can't be voided (that would undo money that moved)
      if (typeof vendorCreditData.remainingCents === 'number' && vendorCreditData.remainingCents < (vendorCreditData.amountCents || 0)) {
        throw new Error('This credit has been applied or refunded and can no longer be voided.');
      }
      if (txsToPost.length > 0 || entityMutation) {
        await this.postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
      }
      return;
    }

    const rawAmount = vendorCreditData.amountCents || 0;
    const rate = vendorCreditData.exchangeRate || 1;
    const amount = roundCents(rawAmount * rate);
    if (amount <= 0) return;
    // The credited bill's share of input tax is no longer reclaimable (L-118)
    const vcTax = vendorCreditData.taxVersion === 2 ? Math.min(amount, roundCents((vendorCreditData.taxAmountCents || 0) * rate)) : 0;
    const vcTaxAccount = vcTax > 0 ? this.resolveAccount(
      accounts,
      mappings,
      ['tax paid', 'input tax', 'tax asset', 'tax', 'tax expense'],
      a => (a.type === 'asset' || a.type === 'expense' || a.type === 'liability') && a.name.toLowerCase().includes('tax'),
      'Tax Paid'
    ) : null;

    const vcTx = {
      uid,
      workspaceId,
      date: vcDate,
      description: `Vendor Credit ${vendorCreditData.number || vendorCreditId}: ${vendorCreditData.vendorName || 'Vendor'}`,
      totalAmountCents: amount,
      currency: vendorCreditData.currency || 'USD',
      exchangeRate: rate,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        vendorCreditId,
        vendorId: vendorCreditData.vendorId,
        type: 'vendor-credit-issuance'
      },
      lines: [
        { accountId: apAccount.id, accountName: apAccount.name, amountCents: amount, debitCents: amount, creditCents: 0, description: 'Accounts Payable Reduction' },
        { accountId: expenseAccount.id, accountName: expenseAccount.name, amountCents: -(amount - vcTax), debitCents: 0, creditCents: amount - vcTax, description: 'Purchase Rebate / Expense Discount' },
        ...(vcTax > 0 && vcTaxAccount ? [{ accountId: vcTaxAccount.id, accountName: vcTaxAccount.name, amountCents: -vcTax, debitCents: 0, creditCents: vcTax, description: 'Input tax reversed by the credit' }] : [])
      ]
    };
    txsToPost.push(this.inBaseCurrency(vcTx, workspaceId, context));

    await this.postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
  }

  /**
   * Post double-entry journal entries for a payment document.
   */
  static async postPaymentLedger(
    paymentId: string, 
    paymentData: Partial<Payment>, 
    workspaceId: string, 
    uid: string, 
    entityMutation?: EntityMutation, 
    context?: LedgerPostContext
  ) {
    if (!workspaceId || !paymentId) return;

    const paymentDate = paymentData.date || getLocalDateISO();
    this.verifyLockDate(paymentDate, context);

    const accounts = this.getAccounts(context);
    const workspaces = this.getWorkspaces(context);
    const currentWs = workspaces.find(w => w.id === workspaceId);
    const mappings = currentWs?.defaultAccountMappings || {};

    const arAccount = this.resolveAccount(
      accounts,
      mappings,
      ['ar', 'accounts receivable', 'receivables', 'receivable'],
      a => a.type === 'asset' && (a.category === 'Receivables' || a.name.toLowerCase().includes('receivable') || a.code === '1100'),
      'Accounts Receivable (A/R)'
    );

    const apAccount = this.resolveAccount(
      accounts,
      mappings,
      ['ap', 'accounts payable', 'payables', 'payable'],
      a => a.type === 'liability' && (a.category === 'Payables' || a.name.toLowerCase().includes('payable') || a.code === '2000'),
      'Accounts Payable (A/P)'
    );

    const depositAcc = accounts.find(a => a.id === paymentData.depositAccountId);
    const cashAccount = depositAcc ? { id: depositAcc.id, name: depositAcc.name } : this.resolveAccount(
      accounts,
      mappings,
      ['cash', 'bank', 'checking'],
      a => resolveAccountRole(a) === 'cash',
      'Bank/Cash Account'
    );

    // Reversals of prior payment postings
    const allTxs = this.getTransactions(context).filter(t => t.metadata?.paymentId === paymentId);
    const reversedIds = new Set(allTxs.filter(t => t.metadata?.isReversal).map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId));
    
    const existingTxs = allTxs.filter(t => 
      isPostable(t) && 
      !t.metadata?.isReversal &&
      !reversedIds.has(t.id)
    );

    const txsToPost: PostableTransaction[] = [];
    const today = getLocalDateISO();

    for (const prevTx of existingTxs) {
      txsToPost.push({
        uid,
        workspaceId,
        date: today,
        description: `Reversal of prior payment posting (Payment ${paymentId})`,
        totalAmountCents: prevTx.totalAmountCents,
        currency: prevTx.currency || 'USD',
        exchangeRate: prevTx.exchangeRate || 1,
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        metadata: {
          paymentId,
          type: 'payment-reversal',
          reversesTxId: prevTx.id,
          isReversal: true
        },
        lines: TransactionTemplates.buildReversalLines(prevTx.lines || [], prevTx.description)
      });
    }

    if (paymentData.status === 'void') {
      if (txsToPost.length > 0) {
        await this.postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
      }
      return;
    }

    const rawAmount = paymentData.amountCents || 0;
    const rate = paymentData.exchangeRate || 1;
    const amount = roundCents(rawAmount * rate);
    if (amount <= 0) return;

    const isReceipt = paymentData.direction === 'received';
    const offsetAccount = isReceipt ? arAccount : apAccount;

    const paymentTx = {
      uid,
      workspaceId,
      date: paymentDate,
      description: `${isReceipt ? 'Payment Received from' : 'Payment Made to'} ${paymentData.contactName || 'Contact'} (${paymentData.method || 'Direct'})`,
      totalAmountCents: amount,
      currency: paymentData.currency || 'USD',
      exchangeRate: rate,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        paymentId,
        contactId: paymentData.contactId,
        direction: paymentData.direction,
        type: 'standalone-payment'
      },
      lines: TransactionTemplates.buildPaymentLines({
        documentNumber: paymentData.reference || paymentId,
        entityName: paymentData.contactName || 'Contact',
        amountCents: amount,
        exchangeRate: rate,
        cashAccount,
        offsetAccount,
        isReceipt
      })
    };
    txsToPost.push(this.inBaseCurrency(paymentTx, workspaceId, context));

    await this.postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
  }

  /**
   * Reverse all postings when an invoice or bill is deleted.
   */
  static async deletePostings(
    id: string, 
    keyName: 'invoiceId' | 'billId' | 'creditNoteId' | 'vendorCreditId', 
    workspaceId: string, 
    entityMutation?: EntityMutation, 
    context?: LedgerPostContext
  ) {
    if (!workspaceId || !id) return;

    const allTxs = this.getTransactions(context).filter(t => t.metadata?.[keyName] === id);
    const reversedIds = new Set(allTxs.filter(t => t.metadata?.isReversal).map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId));
    
    const existingTxs = allTxs.filter(t => 
      isPostable(t) && 
      !t.metadata?.isReversal &&
      !reversedIds.has(t.id)
    );

    if (existingTxs.length === 0) { if (entityMutation) { await this.postTxsServerApi([], workspaceId, entityMutation, context); } return; }

    const today = getLocalDateISO();
    const uid = context?.uid || useAuthStore.getState().user?.uid || 'system';

    const reversals = existingTxs.map(prevTx => {
      this.verifyLockDate(prevTx.date, context);
      return {
        uid,
        workspaceId,
        date: today,
        description: `Reversal: ${prevTx.description}`,
        totalAmountCents: prevTx.totalAmountCents,
        currency: prevTx.currency || 'USD',
        exchangeRate: prevTx.exchangeRate || 1,
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        metadata: {
          [keyName]: id,
          type: `${keyName}-deletion-reversal`,
          reversesTxId: prevTx.id,
          isReversal: true
        },
        lines: TransactionTemplates.buildReversalLines(prevTx.lines || [], prevTx.description)
      };
    });

    await this.postTxsServerApi(reversals, workspaceId, entityMutation, context);
  }

  /**
   * Send transactions array to Server API endpoint (/api/v1/transactions/bulk) atomically.
   */
  private static async postTxsServerApi(
    txs: PostableTransaction[], 
    workspaceId: string, 
    entityMutation?: EntityMutation, 
    context?: LedgerPostContext
  ) {
    if ((!txs || txs.length === 0) && !entityMutation) return;

    // Server-side bypass: if context has a bypassPost flag or if we are executing server-side,
    // we can return or process directly. But in default environments:
    // Ids are chosen here so the entries added to the local store below carry the same ids as the
    // server copies; a quick second edit can then link its reversals to them.
    txs = (txs || []).map(tx => (tx.id ? tx : { ...tx, id: crypto.randomUUID() }));
    const token = await getIdToken().catch(() => null);
    const idempotencyKey = context?.idempotencyKey || (txs.length > 0 ? txs[0].id : null) || crypto.randomUUID();
    const response = await fetch('/api/v1/transactions/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ transactions: txs, workspaceId, entityMutation })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Server rejected transaction posting');
    }
    if (Array.isArray(data.warnings)) data.warnings.forEach((w: unknown) => toast.warning(String(w)));

    // Immediately update client Zustand store state if available
    try {
      const store = useLedgerStore.getState();
      if (store && store.setTransactions) {
        const currentTxs = store.transactions || [];
        store.setTransactions([...(txs as unknown as Transaction[]), ...currentTxs]);
      }
    } catch (e) {
      // Fallback if useLedgerStore or DOM APIs are unavailable (e.g. Server-Side Execution)
    }
  }
}
