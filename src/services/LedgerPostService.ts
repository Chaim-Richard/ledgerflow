import { resolveAccountRole } from '../lib/accountUtils';
import { getIdToken } from '../firebase';
import { getLocalDateISO, roundCents } from '../lib/utils';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { ChartAccount } from '../types';
import { isPostable } from '../lib/txFilters';

export class LedgerPostService {
  private static getAccounts(context?: any): ChartAccount[] {
    return context?.accounts || useLedgerStore.getState().accounts || [];
  }
  private static getLockDate(context?: any): string | null {
    if (context && context.lockDate !== undefined) return context.lockDate;
    return useLedgerStore.getState().lockDate;
  }
  private static getTransactions(context?: any): any[] {
    return context?.transactions || useLedgerStore.getState().transactions || [];
  }
  private static getWorkspaces(context?: any): any[] {
    return context?.workspaces || useAuthStore.getState().workspaces || [];
  }

  /**
   * Period Lock Guard
   */
  public static verifyLockDate(dateStr: string, context?: any) {
    if (!dateStr) return;
    const lockDate = this.getLockDate(context);
    if (lockDate && dateStr <= lockDate) {
      throw new Error(`Period is locked on or before ${lockDate}. Cannot post or modify transaction on ${dateStr}.`);
    }
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
    // 1. Workspace default mappings check
    for (const key of keys) {
      const mappedId = workspaceMappings[key.toLowerCase()];
      if (mappedId) {
        const acc = accounts.find(a => a.id === mappedId);
        if (acc) return { id: acc.id, name: acc.name };
      }
    }

    // 2. Search chart of accounts predicate
    const found = accounts.find(predicate);
    if (found) return { id: found.id, name: found.name };

    // 3. Fail loudly instead of using fake fallback IDs
    throw new Error(`Missing ${errorName} account. Please set up a ${errorName} account in Chart of Accounts or Workspace Settings.`);
  }

  /**
   * Post standard double-entry journal entries for an invoice.
   * Reverses prior postings instead of deleting them.
   */
  static async postInvoiceLedger(invoiceId: string, invoiceData: any, workspaceId: string, uid: string, entityMutation?: any, context?: any) {
    if (!workspaceId || !invoiceId) return;

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

    const txsToPost: any[] = [];
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
        lines: (prevTx.lines || []).map((l: any) => ({
          ...l,
          amountCents: -l.amountCents,
          description: `Reversal: ${l.description || prevTx.description}`,
          exchangeRate: l.exchangeRate || prevTx.exchangeRate || 1
        }))
      });
    }

    const status = invoiceData.status || 'pending';
    if (status === 'draft' || status === 'rejected' || status === 'void' || status === 'cancelled') {
      // If setting to draft, rejected, voided, or cancelled, reversing prior postings (if any) is sufficient
      if (txsToPost.length > 0) {
        await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
      }
      return;
    }

    const rawAmount = invoiceData.totalCents || invoiceData.amountCents || 0;
    const rate = invoiceData.exchangeRate || 1;
    const amount = roundCents(rawAmount * rate);
    if (amount <= 0) { if (entityMutation) { await this.postTxsServerApi([], workspaceId, entityMutation); } return; }

    const invoiceNum = invoiceData.number || invoiceId;
    const customer = invoiceData.customerName || 'Customer';

    const taxAmount = roundCents((invoiceData.taxAmountCents || invoiceData.salesTaxCents || (invoiceData.taxRate ? (rawAmount / (1 + invoiceData.taxRate)) * invoiceData.taxRate : 0)) * rate);
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
    
    const revenueAmount = amount + discountAmount - taxAmount;
    const arAmount = amount - retainageAmount;

    const accrualLines: any[] = [
      {
        accountId: arAccount.id,
        accountName: arAccount.name,
        amountCents: arAmount, // Debit (net of retainage withheld)
        description: `Accounts Receivable posting for Invoice ${invoiceNum}`,
        exchangeRate: rate
      }
    ];

    if (retainageAmount > 0 && retainageAccount) {
      accrualLines.push({
        accountId: retainageAccount.id,
        accountName: retainageAccount.name,
        amountCents: retainageAmount, // Debit
        description: `Retainage withheld for Invoice ${invoiceNum}`,
        exchangeRate: rate
      });
    }
    if (discountAmount > 0 && discountAccount) {
      accrualLines.push({
        accountId: discountAccount.id,
        accountName: discountAccount.name,
        amountCents: discountAmount, // Debit
        description: `Discount applied to Invoice ${invoiceNum}`,
        exchangeRate: rate
      });
    }
    if (taxAmount > 0 && taxAccount) {
      accrualLines.push({
        accountId: taxAccount.id,
        accountName: taxAccount.name,
        amountCents: -taxAmount, // Credit
        description: `Sales Tax collected for Invoice ${invoiceNum}`,
        exchangeRate: rate
      });
    }

    accrualLines.push({
      accountId: revenueAccount.id,
      accountName: revenueAccount.name,
      amountCents: -revenueAmount, // Credit
      description: `Revenue posting for Invoice ${invoiceNum}`,
      exchangeRate: rate
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
    txsToPost.push(accrualTx);

    // 3. Transaction 2: Payment Posting (DR Cash, CR A/R)
    if (status === 'paid' || status === 'partially_paid') {
      const paidAmtCents = roundCents((invoiceData.amountPaidCents || invoiceData.paidAmountCents || (status === 'paid' ? rawAmount : 0)) * rate);
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
          lines: [
            {
              accountId: cashAccount.id,
              accountName: cashAccount.name,
              amountCents: paidAmtCents, // Debit
              description: `Cash collection for Invoice ${invoiceNum}`,
              exchangeRate: rate
            },
            {
              accountId: arAccount.id,
              accountName: arAccount.name,
              amountCents: -paidAmtCents, // Credit
              description: `A/R clearance for Invoice ${invoiceNum}`,
              exchangeRate: rate
            }
          ]
        };
        txsToPost.push(paymentTx);
      }
    }

    // Atomic post via Server API
    await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
  }

  /**
   * Post standard double-entry journal entries for a bill.
   * Reverses prior postings instead of deleting them.
   */
  static async postBillLedger(billId: string, billData: any, workspaceId: string, uid: string, entityMutation?: any, context?: any) {
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

    const txsToPost: any[] = [];
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
        lines: (prevTx.lines || []).map((l: any) => ({
          ...l,
          amountCents: -l.amountCents,
          description: `Reversal: ${l.description || prevTx.description}`,
          exchangeRate: l.exchangeRate || prevTx.exchangeRate || 1
        }))
      });
    }

    const status = billData.status || 'pending';
    if (status === 'draft' || status === 'rejected' || status === 'void' || status === 'cancelled') {
      if (txsToPost.length > 0) {
        await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
      }
      return;
    }

    const rawAmount = billData.amountCents || billData.totalCents || 0;
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
    const taxAmount = roundCents((billData.taxAmountCents || (billData.taxRate ? (rawAmount / (1 + billData.taxRate)) * billData.taxRate : 0)) * rate);
    const expenseAmount = amount - taxAmount;

    const accrualLines: any[] = [];
    
    if (expenseAmount !== 0) {
      accrualLines.push({
        accountId: expenseAccount.id,
        accountName: expenseAccount.name,
        amountCents: expenseAmount, // Debit
        description: `Expense posting for Bill ${billNum}`,
        exchangeRate: rate
      });
    }
    if (taxAmount > 0) {
      accrualLines.push({
        accountId: taxAccount.id,
        accountName: taxAccount.name,
        amountCents: taxAmount, // Debit
        description: `Tax on Bill ${billNum}`,
        exchangeRate: rate
      });
    }
    accrualLines.push({
      accountId: apAccount.id,
      accountName: apAccount.name,
      amountCents: -amount, // Credit
      description: `Accounts Payable posting for Bill ${billNum}`,
      exchangeRate: rate
    });

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
    txsToPost.push(accrualTx);

    // 3. Transaction 2: Payment Posting (DR A/P, CR Cash)
    if (status === 'paid' || status === 'partially_paid') {
      const paidAmtCents = roundCents((billData.amountPaidCents || billData.paidAmountCents || (status === 'paid' ? rawAmount : 0)) * rate);
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
          lines: [
            {
              accountId: apAccount.id,
              accountName: apAccount.name,
              amountCents: paidAmtCents, // Debit
              description: `Accounts Payable clearance for Bill ${billNum}`,
              exchangeRate: rate
            },
            {
              accountId: cashAccount.id,
              accountName: cashAccount.name,
              amountCents: -paidAmtCents, // Credit
              description: `Cash payment for Bill ${billNum}`,
              exchangeRate: rate
            }
          ]
        };
        txsToPost.push(paymentTx);
      }
    }

    // Atomic post via Server API
    await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
  }

  /**
   * Reverse all postings when an invoice or bill is deleted.
   */
  static async deletePostings(id: string, keyName: 'invoiceId' | 'billId', workspaceId: string, entityMutation?: any, context?: any) {
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
        lines: (prevTx.lines || []).map((l: any) => ({
          ...l,
          amountCents: -l.amountCents,
          description: `Reversal: ${l.description || prevTx.description}`,
          exchangeRate: l.exchangeRate || prevTx.exchangeRate || 1
        }))
      };
    });

    await this.postTxsServerApi(reversals, workspaceId, entityMutation, context);
  }

  /**
   * Send transactions array to Server API endpoint (/api/v1/transactions/bulk) atomically.
   */
  private static async postTxsServerApi(txs: any[], workspaceId: string, entityMutation?: any, context?: any) {
    if ((!txs || txs.length === 0) && !entityMutation) return;

    // Server-side bypass: if context has a bypassPost flag or if we are executing server-side,
    // we can return or process directly. But in default environments:
    const token = await getIdToken().catch(() => null);
    const response = await fetch('/api/v1/transactions/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ transactions: txs, workspaceId, entityMutation })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Server rejected transaction posting');
    }

    // Immediately update client Zustand store state if available
    try {
      const store = useLedgerStore.getState();
      if (store && store.setTransactions) {
        const currentTxs = store.transactions || [];
        store.setTransactions([...txs, ...currentTxs]);
      }
    } catch (e) {
      // Fallback if useLedgerStore or DOM APIs are unavailable (e.g. Server-Side Execution)
    }
  }
}
