import { resolveAccountRole } from '../../lib/accountUtils';
import { roundCents } from '../../lib/cents';
import { Payment } from '../../types';
import { isPostable } from '../../lib/txFilters';
import { TransactionTemplates } from '../../kernel/templates/TransactionTemplates';
import { getAccounts, getTransactions, getWorkspaces, inBaseCurrency, verifyLockDate, resolveAccount, postTxsServerApi, reversalDate, postingToday, documentMinorRate } from './postingCore';
import type { EntityMutation, LedgerPostContext, PostableTransaction } from './postingCore';

/**
 * Post double-entry journal entries for a payment document.
 */
export async function postPaymentLedger(
  paymentId: string, 
  paymentData: Partial<Payment>, 
  workspaceId: string, 
  uid: string, 
  entityMutation?: EntityMutation, 
  context?: LedgerPostContext
) {
  if (!workspaceId || !paymentId) return;
  // EG-2: a void is the server's job (it reverses the entries AND makes the documents due again).
  // The old client branch only posted reversals and left the documents marked as paid.
  if (paymentData.status === 'void') {
    throw new Error(`Voiding a payment is done on the server: POST /api/v1/payments/${paymentId}/void with { workspaceId, date?, reason? }.`);
  }

  const paymentDate = paymentData.date || postingToday(context);
  verifyLockDate(paymentDate, context);

  const accounts = getAccounts(context);
  const workspaces = getWorkspaces(context);
  const currentWs = workspaces.find(w => w.id === workspaceId);
  const mappings = currentWs?.defaultAccountMappings || {};

  const arAccount = resolveAccount(
    accounts,
    mappings,
    ['ar', 'accounts receivable', 'receivables', 'receivable'],
    a => a.type === 'asset' && (a.category === 'Receivables' || a.name.toLowerCase().includes('receivable') || a.code === '1100'),
    'Accounts Receivable (A/R)'
  );

  const apAccount = resolveAccount(
    accounts,
    mappings,
    ['ap', 'accounts payable', 'payables', 'payable'],
    a => a.type === 'liability' && (a.category === 'Payables' || resolveAccountRole(a) === 'ap' || a.code === '2000'),
    'Accounts Payable (A/P)'
  );

  const depositAcc = accounts.find(a => a.id === paymentData.depositAccountId);
  const cashAccount = depositAcc ? { id: depositAcc.id, name: depositAcc.name } : resolveAccount(
    accounts,
    mappings,
    ['cash', 'bank', 'checking'],
    a => resolveAccountRole(a) === 'cash',
    'Bank/Cash Account'
  );

  // Reversals of prior payment postings
  const allTxs = getTransactions(context).filter(t => t.metadata?.paymentId === paymentId);
  const reversedIds = new Set(allTxs.filter(t => t.metadata?.isReversal).map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId));
  
  const existingTxs = allTxs.filter(t => 
    isPostable(t) && 
    !t.metadata?.isReversal &&
    !reversedIds.has(t.id)
  );

  const txsToPost: PostableTransaction[] = [];
  const today = postingToday(context);

  for (const prevTx of existingTxs) {
    txsToPost.push({
      uid,
      workspaceId,
      date: reversalDate(prevTx.date, today, context),
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

  const rawAmount = paymentData.amountCents || 0;
  // BM-04: minor units of the document's currency → minor units of the books' (¥ has none, KWD three)
  const rate = documentMinorRate(paymentData, workspaceId, context);
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
    exchangeRate: paymentData.exchangeRate || 1,
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
      exchangeRate: paymentData.exchangeRate || 1,
      cashAccount,
      offsetAccount,
      isReceipt
    })
  };
  txsToPost.push(inBaseCurrency(paymentTx, workspaceId, context, (paymentData as { metadata?: { rateUsed?: unknown } }).metadata?.rateUsed as never));

  await postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
}
