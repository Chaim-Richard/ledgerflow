import { resolveAccountRole } from '../../lib/accountUtils';
import { getLocalDateISO, roundCents } from '../../lib/utils';
import { Bill } from '../../types';
import { isPostable } from '../../lib/txFilters';
import { calculateDocumentTax, cashPostedWithDocumentCents } from '../../lib/documentMath';
import { TransactionTemplates } from '../../kernel/templates/TransactionTemplates';
import { getAccounts, getTransactions, getWorkspaces, inBaseCurrency, verifyLockDate, findAccount, resolveAccount, lineAccounts, postTxsServerApi } from './postingKit';
import type { EntityMutation, LedgerPostContext, PostableTransaction } from './postingKit';

/**
 * Post standard double-entry journal entries for a bill.
 * Reverses prior postings instead of deleting them.
 */
export async function postBillLedger(
  billId: string, 
  billData: Partial<Bill>, 
  workspaceId: string, 
  uid: string, 
  entityMutation?: EntityMutation, 
  context?: LedgerPostContext
) {
  if (!workspaceId || !billId) return;

  const billDate = billData.date || getLocalDateISO();
  verifyLockDate(billDate, context);

  const accounts = getAccounts(context);
  const workspaces = getWorkspaces(context);
  const currentWs = workspaces.find(w => w.id === workspaceId);
  const mappings = currentWs?.defaultAccountMappings || {};

  const apAccount = resolveAccount(
    accounts,
    mappings,
    ['ap', 'accounts payable', 'payables', 'payable'],
    a => a.type === 'liability' && (a.category === 'Payables' || a.name.toLowerCase().includes('payable') || a.code === '2000'),
    'Accounts Payable (A/P)'
  );

  const expenseAccount = resolveAccount(
    accounts,
    mappings,
    ['expense', 'operating expense'],
    a => a.type === 'expense' || a.category === 'Expense',
    'Operating Expense'
  );

  const cashAccount = resolveAccount(
    accounts,
    mappings,
    ['cash', 'bank', 'checking'],
    a => resolveAccountRole(a) === 'cash',
    'Cash & Cash Equivalents'
  );

  // Find prior active non-reversal postings for this bill
  // Improved logic: exclude any transaction that has ALREADY been reversed
  const allTxs = getTransactions(context).filter(t => t.metadata?.billId === billId);
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
      await postTxsServerApi(txsToPost, workspaceId, entityMutation);
    }
    return;
  }

  const rawAmount = billData.amountCents || 0;
  const rate = billData.exchangeRate || 1;
  const amount = roundCents(rawAmount * rate);
  if (amount <= 0) { if (entityMutation) { await postTxsServerApi([], workspaceId, entityMutation); } return; }

  const billNum = billData.number || billId;
  const vendor = billData.vendorName || 'Vendor';

  // 2. Transaction 1: Accrual Posting
  const taxAmount = roundCents(calculateDocumentTax(billData) * rate);
  const selfAssessed = roundCents((billData.selfAssessedTaxCents || 0) * rate);

  // only a bill with tax needs a tax account (a workspace without one could record no bill at all; L-183)
  const taxAccount = taxAmount > 0 || selfAssessed > 0 ? resolveAccount(
    accounts,
    mappings,
    ['tax paid', 'input tax', 'tax asset', 'tax', 'tax expense'],
    a => (a.type === 'asset' || a.type === 'expense' || a.type === 'liability') && a.name.toLowerCase().includes('tax'),
    'Tax Paid'
  ) : null;

  const accrualLines = TransactionTemplates.buildBillLines({
    billNumber: String(billNum),
    vendorName: vendor,
    totalCents: amount,
    taxCents: taxAmount,
    exchangeRate: rate,
    apAccount,
    expenseAccount,
    taxAccount,
    lineAccounts: lineAccounts(billData.splits, accounts, expenseAccount, a => !['cash', 'ar', 'ap'].includes(resolveAccountRole(a)))
  });

  // Reverse charge (T-03): the vendor charged no tax; the business owes it and reclaims it,
  // so the same amount goes to input tax (reclaimable) and to tax payable (due)
  if (selfAssessed > 0 && taxAccount) {
    const outputTaxAccount = findAccount(
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
  txsToPost.push(inBaseCurrency(accrualTx, workspaceId, context));

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
      txsToPost.push(inBaseCurrency(paymentTx, workspaceId, context));
    }
  }

  // Atomic post via Server API
  await postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
}
