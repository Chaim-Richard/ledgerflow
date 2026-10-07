import { resolveAccountRole } from '../../lib/accountUtils';
import { getLocalDateISO, roundCents } from '../../lib/utils';
import { Payment } from '../../types';
import { isPostable } from '../../lib/txFilters';
import { TransactionTemplates } from '../../kernel/templates/TransactionTemplates';
import { getAccounts, getTransactions, getWorkspaces, inBaseCurrency, verifyLockDate, resolveAccount, postTxsServerApi, reversalDate } from './postingKit';
import type { EntityMutation, LedgerPostContext, PostableTransaction } from './postingKit';

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

  const paymentDate = paymentData.date || getLocalDateISO();
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
    a => a.type === 'liability' && (a.category === 'Payables' || a.name.toLowerCase().includes('payable') || a.code === '2000'),
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
  const today = getLocalDateISO();

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

  if (paymentData.status === 'void') {
    if (txsToPost.length > 0) {
      await postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
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
  txsToPost.push(inBaseCurrency(paymentTx, workspaceId, context));

  await postTxsServerApi(txsToPost, workspaceId, entityMutation, context);
}
