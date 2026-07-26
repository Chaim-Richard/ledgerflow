import { getIdToken } from '../firebase';
import { getLocalDateISO, financialRound } from '../lib/utils';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { ChartAccount } from '../types';

export class LedgerPostService {
  /**
   * Period Lock Guard
   */
  public static verifyLockDate(dateStr: string) {
    if (!dateStr) return;
    const lockDate = useLedgerStore.getState().lockDate;
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
  static async postInvoiceLedger(invoiceId: string, invoiceData: any, workspaceId: string, uid: string, entityMutation?: any) {
    if (!workspaceId || !invoiceId) return;

    const invoiceDate = invoiceData.date || getLocalDateISO();
    this.verifyLockDate(invoiceDate);

    const accounts = useLedgerStore.getState().accounts;
    const workspaces = useAuthStore.getState().workspaces;
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
      a => a.type === 'asset' && (a.category === 'Cash' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('checking') || a.code === '1000'),
      'Cash & Cash Equivalents'
    );

    // Find prior active non-reversal postings for this invoice to generate reversing entries
    const existingTxs = useLedgerStore.getState().transactions.filter(t => 
      t.metadata?.invoiceId === invoiceId && 
      t.status !== 'void' && 
      !t.metadata?.isReversal
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
    if (status === 'draft' || status === 'rejected') {
      // If setting to draft or rejected, reversing prior postings (if any) is sufficient
      if (true) {
        await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
      }
      return;
    }

    const rawAmount = invoiceData.totalCents || invoiceData.amountCents || 0;
    const amount = financialRound(rawAmount);
    if (amount <= 0) { if (entityMutation) { await this.postTxsServerApi([], workspaceId, entityMutation); } return; }

    const rate = invoiceData.exchangeRate || 1;
    const invoiceNum = invoiceData.number || invoiceId;
    const customer = invoiceData.customerName || 'Customer';

    // 2. Transaction 1: Accrual Posting (DR A/R, CR Revenue)
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
        type: 'invoice-accrual'
      },
      lines: [
        {
          accountId: arAccount.id,
          accountName: arAccount.name,
          amountCents: amount, // Debit (positive)
          description: `Accounts Receivable posting for Invoice ${invoiceNum}`,
          exchangeRate: rate
        },
        {
          accountId: revenueAccount.id,
          accountName: revenueAccount.name,
          amountCents: -amount, // Credit (negative)
          description: `Revenue posting for Invoice ${invoiceNum}`,
          exchangeRate: rate
        }
      ]
    };
    txsToPost.push(accrualTx);

    // 3. Transaction 2: Payment Posting (DR Cash, CR A/R)
    if (status === 'paid' || status === 'partially_paid') {
      const paidAmtCents = financialRound(invoiceData.amountPaidCents || invoiceData.paidAmountCents || (status === 'paid' ? amount : 0));
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

    // 4. Transaction 3: Reversing Entry if Voided (DR Revenue, CR A/R)
    if (status === 'void') {
      const voidDate = invoiceData.voidDate || invoiceData.voidedAt || today;
      const voidTx = {
        uid,
        workspaceId,
        date: voidDate,
        description: `Void Reversing Entry - Invoice ${invoiceNum}`,
        totalAmountCents: amount,
        currency: invoiceData.currency || 'USD',
        exchangeRate: rate,
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        metadata: {
          invoiceId,
          type: 'invoice-void'
        },
        lines: [
          {
            accountId: revenueAccount.id,
            accountName: revenueAccount.name,
            amountCents: amount, // Debit (reverses revenue)
            description: `Revenue cancellation for voided Invoice ${invoiceNum}`,
            exchangeRate: rate
          },
          {
            accountId: arAccount.id,
            accountName: arAccount.name,
            amountCents: -amount, // Credit (reverses A/R)
            description: `A/R write-off for voided Invoice ${invoiceNum}`,
            exchangeRate: rate
          }
        ]
      };
      txsToPost.push(voidTx);
    }

    // Atomic post via Server API
    await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
  }

  /**
   * Post standard double-entry journal entries for a bill.
   * Reverses prior postings instead of deleting them.
   */
  static async postBillLedger(billId: string, billData: any, workspaceId: string, uid: string, entityMutation?: any) {
    if (!workspaceId || !billId) return;

    const billDate = billData.date || getLocalDateISO();
    this.verifyLockDate(billDate);

    const accounts = useLedgerStore.getState().accounts;
    const workspaces = useAuthStore.getState().workspaces;
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
      a => a.type === 'asset' && (a.category === 'Cash' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('checking') || a.code === '1000'),
      'Cash & Cash Equivalents'
    );

    // Find prior active non-reversal postings for this bill
    const existingTxs = useLedgerStore.getState().transactions.filter(t => 
      t.metadata?.billId === billId && 
      t.status !== 'void' && 
      !t.metadata?.isReversal
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
    if (status === 'draft' || status === 'rejected') {
      if (true) {
        await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
      }
      return;
    }

    const rawAmount = billData.amountCents || billData.totalCents || 0;
    const amount = financialRound(rawAmount);
    if (amount <= 0) { if (entityMutation) { await this.postTxsServerApi([], workspaceId, entityMutation); } return; }

    const rate = billData.exchangeRate || 1;
    const billNum = billData.number || billId;
    const vendor = billData.vendorName || 'Vendor';

    // 2. Transaction 1: Accrual Posting (DR Expense, CR A/P)
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
        type: 'bill-accrual'
      },
      lines: [
        {
          accountId: expenseAccount.id,
          accountName: expenseAccount.name,
          amountCents: amount, // Debit (positive)
          description: `Expense posting for Bill ${billNum}`,
          exchangeRate: rate
        },
        {
          accountId: apAccount.id,
          accountName: apAccount.name,
          amountCents: -amount, // Credit (negative)
          description: `Accounts Payable posting for Bill ${billNum}`,
          exchangeRate: rate
        }
      ]
    };
    txsToPost.push(accrualTx);

    // 3. Transaction 2: Payment Posting (DR A/P, CR Cash)
    if (status === 'paid' || status === 'partially_paid') {
      const paidAmtCents = financialRound(billData.amountPaidCents || billData.paidAmountCents || (status === 'paid' ? amount : 0));
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

    // 4. Transaction 3: Reversing Entry if Voided (DR A/P, CR Expense)
    if (status === 'void' || status === 'cancelled') {
      const voidDate = billData.voidDate || billData.voidedAt || today;
      const voidTx = {
        uid,
        workspaceId,
        date: voidDate,
        description: `Void Reversing Entry - Bill ${billNum}`,
        totalAmountCents: amount,
        currency: billData.currency || 'USD',
        exchangeRate: rate,
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        metadata: {
          billId,
          type: 'bill-void'
        },
        lines: [
          {
            accountId: apAccount.id,
            accountName: apAccount.name,
            amountCents: amount, // Debit (reverses A/P)
            description: `A/P reversal for voided Bill ${billNum}`,
            exchangeRate: rate
          },
          {
            accountId: expenseAccount.id,
            accountName: expenseAccount.name,
            amountCents: -amount, // Credit (reverses Expense)
            description: `Expense reversal for voided Bill ${billNum}`,
            exchangeRate: rate
          }
        ]
      };
      txsToPost.push(voidTx);
    }

    // Atomic post via Server API
    await this.postTxsServerApi(txsToPost, workspaceId, entityMutation);
  }

  /**
   * Reverse all postings when an invoice or bill is deleted.
   */
  static async deletePostings(id: string, keyName: 'invoiceId' | 'billId', workspaceId: string, entityMutation?: any) {
    if (!workspaceId || !id) return;

    const existingTxs = useLedgerStore.getState().transactions.filter(t => 
      t.metadata?.[keyName] === id && 
      t.status !== 'void' && 
      !t.metadata?.isReversal
    );

    if (existingTxs.length === 0) { if (entityMutation) { await this.postTxsServerApi([], workspaceId, entityMutation); } return; }

    const today = getLocalDateISO();
    const uid = useAuthStore.getState().user?.uid || 'system';

    const reversals = existingTxs.map(prevTx => {
      this.verifyLockDate(prevTx.date);
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

    await this.postTxsServerApi(reversals, workspaceId, entityMutation);
  }

  /**
   * Send transactions array to Server API endpoint (/api/v1/transactions/bulk) atomically.
   */
  private static async postTxsServerApi(txs: any[], workspaceId: string, entityMutation?: any) {
    if ((!txs || txs.length === 0) && !entityMutation) return;

    const token = await getIdToken();
    const response = await fetch('/api/v1/transactions/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ transactions: txs, workspaceId, entityMutation })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Server rejected transaction posting');
    }

    // Immediately update client Zustand store state
    const currentTxs = useLedgerStore.getState().transactions;
    useLedgerStore.getState().setTransactions([...txs, ...currentTxs]);
  }
}
