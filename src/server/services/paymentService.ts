import { calculateAmountDue, settledStatus } from '../../lib/documentMath';
import { writeServerAuditLog } from './auditLogService';
import { resolveAccountRole } from '../../lib/accountUtils';
import type { ChartAccount } from '../../types';
import { assertPostingOpen } from '../../lib/periodLock';
import { formatCurrency } from '../../lib/utils';

export interface CreatePaymentPayload {
  workspaceId: string;
  uid: string;
  paymentDate: string;
  amountCents: number;
  paymentMethod?: string;
  referenceNumber?: string;
  memo?: string;
  customerId?: string;
  vendorId?: string;
  entityName?: string;
  cashAccountId: string;
  offsetAccountId?: string;
  allocations: Array<{
    documentId: string;
    documentType: 'invoice' | 'bill';
    amountCents: number;
  }>;
}

const PAYMENT_METHODS = new Set(['cash', 'check', 'bank_transfer', 'card', 'other']);

export async function createPaymentAtomic(db: any, payload: CreatePaymentPayload) {
  return db.runTransaction((tx: unknown) => createPaymentInTransaction(db, tx, payload));
}

/**
 * Records a payment inside an open database transaction (reads first, writes at the end), so a
 * caller can add its own writes, e.g. marking the bank line it came from as matched.
 */
export async function createPaymentInTransaction(db: any, tx: any, payload: CreatePaymentPayload) {
  const {
    workspaceId,
    uid,
    paymentDate,
    amountCents,
    paymentMethod = 'cash',
    referenceNumber = '',
    memo = '',
    customerId,
    vendorId,
    entityName,
    cashAccountId,
    offsetAccountId,
    allocations = []
  } = payload;

  {
    // 1. Fetch workspace for lockDate and default mappings
    const wsRef = db.collection('workspaces').doc(workspaceId);
    const wsSnap = await tx.get(wsRef);
    if (!wsSnap.exists) throw new Error('NOT_FOUND');
    const wsData = wsSnap.data() || {};

    assertPostingOpen(paymentDate, wsData, uid);

    // 2. Validate cash account exists and belongs to workspace
    const cashAccRef = db.collection('chartAccounts').doc(cashAccountId);
    const cashAccSnap = await tx.get(cashAccRef);
    if (!cashAccSnap.exists) {
      throw new Error(`Invalid cash account ID: ${cashAccountId}`);
    }
    const cashAccData = cashAccSnap.data() || {};
    if (cashAccData.workspaceId !== workspaceId) {
      throw new Error(`Invalid cash account ID: ${cashAccountId}`);
    }

    let resolvedOffsetAccountId = offsetAccountId;
    if (resolvedOffsetAccountId) {
      const offsetAccRef = db.collection('chartAccounts').doc(resolvedOffsetAccountId);
      const offsetAccSnap = await tx.get(offsetAccRef);
      if (!offsetAccSnap.exists) {
        throw new Error(`Invalid offset account ID: ${resolvedOffsetAccountId}`);
      }
      const offsetAccData = offsetAccSnap.data() || {};
      if (offsetAccData.workspaceId !== workspaceId) {
        throw new Error(`Invalid offset account ID: ${resolvedOffsetAccountId}`);
      }
    }

    // 3. Read & validate target invoices / bills
    const allocationKeys = allocations.map(a => `${a.documentType}:${a.documentId}`);
    if (new Set(allocationKeys).size !== allocationKeys.length) {
      throw new Error('Each invoice or bill may appear only once in a payment');
    }

    const docUpdates: Array<{ ref: { id?: string; [k: string]: unknown }; updates: Record<string, unknown> }> = [];
    let totalAllocatedCents = 0;
    // A payment is in the currency of the documents it pays (all the same one); the ledger gets
    // it converted at the documents' rate, like the documents themselves (L-105).
    const baseCurrency = String(wsData.currency || 'USD');
    let paymentCurrency: string | null = null;
    let paymentRate = 1;

    for (const alloc of allocations) {
      totalAllocatedCents += alloc.amountCents;
      const collName = alloc.documentType === 'invoice' ? 'invoices' : 'bills';
      const docRef = db.collection(collName).doc(alloc.documentId);
      const docSnap = await tx.get(docRef);

      if (!docSnap.exists) {
        throw new Error(`Document ${alloc.documentId} not found`);
      }

      const docData = docSnap.data() || {};
      if (docData.workspaceId !== workspaceId) {
        throw new Error(`Document ${alloc.documentId} not found`);
      }

      if (docData.status === 'void' || docData.status === 'draft') {
        throw new Error(`Cannot record a payment against a ${docData.status} document`);
      }
      const docCurrency = String(docData.currency || baseCurrency);
      const docRate = typeof docData.exchangeRate === 'number' && docData.exchangeRate > 0 ? docData.exchangeRate : 1;
      if (paymentCurrency !== null && (docCurrency !== paymentCurrency || docRate !== paymentRate)) {
        throw new Error('One payment can only pay documents in the same currency (and exchange rate); record separate payments');
      }
      paymentCurrency = docCurrency;
      paymentRate = docCurrency === baseCurrency ? 1 : docRate;

      const currentPaid = docData.amountPaidCents || 0;
      const remainingBalance = calculateAmountDue(docData);

      if (alloc.amountCents > remainingBalance) {
        throw new Error(`Overpayment not allowed: allocation of ${alloc.amountCents} cents exceeds remaining balance of ${remainingBalance} cents for document ${alloc.documentId}`);
      }

      const newPaid = currentPaid + alloc.amountCents;

      const newStatus = newPaid > 0 ? settledStatus(docData, newPaid) : docData.status;

      docUpdates.push({
        ref: docRef,
        updates: {
          amountPaidCents: newPaid,
          settledByRecordsCents: (docData.settledByRecordsCents || 0) + alloc.amountCents,
          status: newStatus,
          updatedAt: new Date().toISOString()
        }
      });

      if (!resolvedOffsetAccountId) {
        resolvedOffsetAccountId = alloc.documentType === 'invoice'
          ? docData.arAccountId || wsData.defaultAccountMappings?.ar
          : docData.apAccountId || wsData.defaultAccountMappings?.ap;
      }
    }

    // No mapping: the chart's receivables (customer payment) or payables (vendor payment) account
    const receipt = allocations.some(a => a.documentType === 'invoice') || Boolean(customerId);
    if (!resolvedOffsetAccountId) {
      const chart = await tx.get(db.collection('chartAccounts').where('workspaceId', '==', workspaceId));
      const role = receipt ? 'ar' : 'ap';
      resolvedOffsetAccountId = chart.docs.find((d: { id: string; data: () => ChartAccount }) => resolveAccountRole({ ...d.data(), id: d.id }) === role)?.id;
    }

    if (totalAllocatedCents > amountCents) {
      throw new Error(`Total allocated amount (${totalAllocatedCents} cents) exceeds payment amount (${amountCents} cents)`);
    }

    if (!resolvedOffsetAccountId) {
      throw new Error('Offset account ID (A/R or A/P) could not be resolved or is invalid');
    }

    // Validate resolved offset account
    const offsetAccRef = db.collection('chartAccounts').doc(resolvedOffsetAccountId);
    const offsetAccSnap = await tx.get(offsetAccRef);
    if (!offsetAccSnap.exists) {
      throw new Error(`Invalid offset account ID: ${resolvedOffsetAccountId}`);
    }
    const offsetAccData = offsetAccSnap.data() || {};
    if (offsetAccData.workspaceId !== workspaceId) {
      throw new Error(`Invalid offset account ID: ${resolvedOffsetAccountId}`);
    }

    // 4. Build Payment Document
    const paymentRef = db.collection('payments').doc();
    const paymentId = paymentRef.id;
    const paymentNumber = `PMT-${Math.floor(1000 + Math.random() * 9000)}`;
    const isReceiptPayment = allocations.some(a => a.documentType === 'invoice') || Boolean(customerId);
    const paymentData = {
      id: paymentId,
      workspaceId,
      uid,
      number: paymentNumber,
      // The fields screens and reports read (types.ts Payment)
      direction: isReceiptPayment ? 'received' : 'made',
      contactId: customerId || vendorId || null,
      contactName: entityName || '',
      method: PAYMENT_METHODS.has(paymentMethod) ? paymentMethod : 'other',
      reference: referenceNumber,
      depositAccountId: cashAccountId,
      unappliedCents: amountCents - totalAllocatedCents,
      currency: paymentCurrency || baseCurrency,
      exchangeRate: paymentRate,
      status: 'posted',
      date: paymentDate,
      paymentDate,
      amountCents,
      paymentMethod,
      referenceNumber,
      memo,
      customerId: customerId || null,
      vendorId: vendorId || null,
      entityName: entityName || '',
      cashAccountId,
      offsetAccountId: resolvedOffsetAccountId,
      allocations,
      createdAt: new Date().toISOString()
    };

    // 5. Build General Ledger Transaction
    const isReceipt = isReceiptPayment;
    const ledgerTxRef = db.collection('transactions').doc();
    const baseAmountCents = Math.round(amountCents * paymentRate);

    const ledgerTxData = {
      id: ledgerTxRef.id,
      uid,
      workspaceId,
      date: paymentDate,
      description: `Payment ${paymentId} (${paymentMethod}) - ${entityName || memo || 'Payment'}`,
      totalAmountCents: baseAmountCents,
      currency: baseCurrency,
      exchangeRate: 1,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      metadata: {
        paymentId,
        type: 'payment-posting',
        ...(paymentRate !== 1 ? { documentCurrency: paymentCurrency, documentAmountCents: amountCents, documentExchangeRate: paymentRate } : {})
      },
      lines: [
        {
          accountId: cashAccountId,
          amountCents: isReceipt ? baseAmountCents : -baseAmountCents,
          description: `Cash ${isReceipt ? 'Debit' : 'Credit'} for Payment ${paymentId}`
        },
        {
          accountId: resolvedOffsetAccountId,
          amountCents: isReceipt ? -baseAmountCents : baseAmountCents,
          description: `Offset ${isReceipt ? 'Credit' : 'Debit'} for Payment ${paymentId}`
        }
      ]
    };

    // 6. Stage writes
    for (const update of docUpdates) {
      tx.update(update.ref, update.updates);
    }
    tx.set(paymentRef, paymentData);
    tx.set(ledgerTxRef, ledgerTxData);

    await writeServerAuditLog({
      workspaceId,
      uid,
      action: 'PAYMENT_RECORDED',
      entityType: 'payment',
      entityId: paymentId,
      details: {
        description: `Payment ${paymentNumber} of ${formatCurrency(amountCents, paymentCurrency || baseCurrency)} recorded for ${entityName || 'contact'}.`,
        paymentNumber,
        amountCents,
        paymentMethod
      }
    }, { db, tx });

    return { paymentId, transactionId: ledgerTxRef.id, payment: paymentData, ledgerTransaction: ledgerTxData };
  }
}
