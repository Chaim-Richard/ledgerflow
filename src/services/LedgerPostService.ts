import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { getLocalDateISO } from '../lib/utils';
import { useLedgerStore } from '../stores/useLedgerStore';

export class LedgerPostService {
  /**
   * Post standard double-entry journal entries for an invoice to keep GL and A/R in sync.
   */
  static async postInvoiceLedger(invoiceId: string, invoiceData: any, workspaceId: string, uid: string) {
    if (!workspaceId || !invoiceId) return;

    // 1. Fetch current accounts to find standard AR, Revenue, Cash accounts
    const accounts = useLedgerStore.getState().accounts;
    
    const arAccount = accounts.find(a => a.type === 'asset' && (a.category === 'Receivables' || a.name.toLowerCase().includes('receivable'))) || {
      id: 'ar_fallback',
      name: 'Accounts Receivable'
    };

    const revenueAccount = accounts.find(a => a.type === 'income') || {
      id: 'revenue_fallback',
      name: 'Sales Revenue'
    };

    const cashAccount = accounts.find(a => a.type === 'asset' && (a.category === 'Cash' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('checking'))) || {
      id: 'cash_fallback',
      name: 'Cash & Cash Equivalents'
    };

    // 2. Clear existing ledger transactions for this invoice to prevent duplication
    const q = query(
      collection(db, 'transactions'),
      where('workspaceId', '==', workspaceId),
      where('metadata.invoiceId', '==', invoiceId)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'transactions', d.id));
    }

    const status = invoiceData.status || 'pending';
    if (status === 'draft' || status === 'rejected') {
      // Drafts/rejected invoices do not post to the general ledger
      return;
    }

    const amount = invoiceData.totalCents || invoiceData.amountCents || 0;
    if (amount <= 0) return;

    const date = invoiceData.date || getLocalDateISO();
    const invoiceNum = invoiceData.number || invoiceId;
    const customer = invoiceData.customerName || 'Customer';

    // Transaction 1: Accrual Posting (DR A/R, CR Revenue)
    const accrualTx = {
      uid,
      workspaceId,
      date,
      description: `Invoice ${invoiceNum} - ${customer}`,
      totalAmountCents: amount,
      currency: invoiceData.currency || 'USD',
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
          description: `Accounts Receivable posting for Invoice ${invoiceNum}`
        },
        {
          accountId: revenueAccount.id,
          accountName: revenueAccount.name,
          amountCents: -amount, // Credit (negative)
          description: `Revenue posting for Invoice ${invoiceNum}`
        }
      ]
    };
    await addDoc(collection(db, 'transactions'), accrualTx);

    // Transaction 2: Payment Posting (DR Cash, CR A/R)
    if (status === 'paid') {
      const paymentTx = {
        uid,
        workspaceId,
        date: getLocalDateISO(),
        description: `Payment Received for Invoice ${invoiceNum} - ${customer}`,
        totalAmountCents: amount,
        currency: invoiceData.currency || 'USD',
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
            amountCents: amount, // Debit (positive)
            description: `Cash collection for Invoice ${invoiceNum}`
          },
          {
            accountId: arAccount.id,
            accountName: arAccount.name,
            amountCents: -amount, // Credit (negative)
            description: `A/R clearance for Invoice ${invoiceNum}`
          }
        ]
      };
      await addDoc(collection(db, 'transactions'), paymentTx);
    }

    // Transaction 3: Reversing Entry if Voided (DR Revenue, CR A/R)
    if (status === 'void') {
      const voidTx = {
        uid,
        workspaceId,
        date: getLocalDateISO(),
        description: `Void Reversing Entry - Invoice ${invoiceNum}`,
        totalAmountCents: amount,
        currency: invoiceData.currency || 'USD',
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
            amountCents: amount, // Debit (positive to reverse revenue)
            description: `Revenue cancellation for voided Invoice ${invoiceNum}`
          },
          {
            accountId: arAccount.id,
            accountName: arAccount.name,
            amountCents: -amount, // Credit (negative to reverse A/R)
            description: `A/R write-off for voided Invoice ${invoiceNum}`
          }
        ]
      };
      await addDoc(collection(db, 'transactions'), voidTx);
    }
  }

  /**
   * Post standard double-entry journal entries for a bill to keep GL and A/P in sync.
   */
  static async postBillLedger(billId: string, billData: any, workspaceId: string, uid: string) {
    if (!workspaceId || !billId) return;

    // 1. Fetch current accounts to find standard AP, Expense, Cash accounts
    const accounts = useLedgerStore.getState().accounts;

    const apAccount = accounts.find(a => a.type === 'liability' && (a.category === 'Payables' || a.name.toLowerCase().includes('payable'))) || {
      id: 'ap_fallback',
      name: 'Accounts Payable'
    };

    const expenseAccount = accounts.find(a => a.type === 'expense') || {
      id: 'expense_fallback',
      name: 'Operating Expense'
    };

    const cashAccount = accounts.find(a => a.type === 'asset' && (a.category === 'Cash' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('checking'))) || {
      id: 'cash_fallback',
      name: 'Cash & Cash Equivalents'
    };

    // 2. Clear existing ledger transactions for this bill to prevent duplication
    const q = query(
      collection(db, 'transactions'),
      where('workspaceId', '==', workspaceId),
      where('metadata.billId', '==', billId)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'transactions', d.id));
    }

    const status = billData.status || 'pending';
    if (status === 'draft' || status === 'rejected') {
      return;
    }

    const amount = billData.amountCents || 0;
    if (amount <= 0) return;

    const date = billData.date || getLocalDateISO();
    const billNum = billData.number || billId;
    const vendor = billData.vendorName || 'Vendor';

    // Transaction 1: Accrual Posting (DR Expense, CR A/P)
    const accrualTx = {
      uid,
      workspaceId,
      date,
      description: `Bill ${billNum} - ${vendor}`,
      totalAmountCents: amount,
      currency: billData.currency || 'USD',
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
          description: `Expense posting for Bill ${billNum}`
        },
        {
          accountId: apAccount.id,
          accountName: apAccount.name,
          amountCents: -amount, // Credit (negative)
          description: `Accounts Payable posting for Bill ${billNum}`
        }
      ]
    };
    await addDoc(collection(db, 'transactions'), accrualTx);

    // Transaction 2: Payment Posting (DR A/P, CR Cash)
    if (status === 'paid') {
      const paymentTx = {
        uid,
        workspaceId,
        date: getLocalDateISO(),
        description: `Payment Sent for Bill ${billNum} - ${vendor}`,
        totalAmountCents: amount,
        currency: billData.currency || 'USD',
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
            amountCents: amount, // Debit (positive)
            description: `Accounts Payable clearance for Bill ${billNum}`
          },
          {
            accountId: cashAccount.id,
            accountName: cashAccount.name,
            amountCents: -amount, // Credit (negative)
            description: `Cash payment for Bill ${billNum}`
          }
        ]
      };
      await addDoc(collection(db, 'transactions'), paymentTx);
    }

    // Transaction 3: Reversing Entry if Voided (DR A/P, CR Expense)
    if (status === 'void' || status === 'cancelled') {
      const voidTx = {
        uid,
        workspaceId,
        date: getLocalDateISO(),
        description: `Void Reversing Entry - Bill ${billNum}`,
        totalAmountCents: amount,
        currency: billData.currency || 'USD',
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
            amountCents: amount, // Debit (positive to reverse A/P)
            description: `A/P reversal for voided Bill ${billNum}`
          },
          {
            accountId: expenseAccount.id,
            accountName: expenseAccount.name,
            amountCents: -amount, // Credit (negative to reverse Expense)
            description: `Expense reversal for voided Bill ${billNum}`
          }
        ]
      };
      await addDoc(collection(db, 'transactions'), voidTx);
    }
  }

  /**
   * Clean up all postings when invoice or bill is deleted.
   */
  static async deletePostings(id: string, keyName: 'invoiceId' | 'billId', workspaceId: string) {
    if (!workspaceId || !id) return;
    const q = query(
      collection(db, 'transactions'),
      where('workspaceId', '==', workspaceId),
      where(`metadata.${keyName}`, '==', id)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'transactions', d.id));
    }
  }
}
