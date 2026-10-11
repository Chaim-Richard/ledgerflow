import { getLocalDateISO } from '../../lib/utils';
import { useAuthStore } from '../../stores/useAuthStore';
import { isPostable } from '../../lib/txFilters';
import { TransactionTemplates } from '../../kernel/templates/TransactionTemplates';
import { getTransactions, verifyLockDate, postTxsServerApi, reversalDate } from './postingKit';
import type { EntityMutation, LedgerPostContext } from './postingKit';

/**
 * Reverse all postings when an invoice or bill is deleted.
 */
export async function deletePostings(
  id: string, 
  keyName: 'invoiceId' | 'billId' | 'creditNoteId' | 'vendorCreditId', 
  workspaceId: string, 
  entityMutation?: EntityMutation, 
  context?: LedgerPostContext
) {
  if (!workspaceId || !id) return;

  const allTxs = getTransactions(context).filter(t => t.metadata?.[keyName] === id);
  const reversedIds = new Set(allTxs.filter(t => t.metadata?.isReversal).map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId));
  
  const existingTxs = allTxs.filter(t => 
    isPostable(t) && 
    !t.metadata?.isReversal &&
    !reversedIds.has(t.id)
  );

  if (existingTxs.length === 0) { if (entityMutation) { await postTxsServerApi([], workspaceId, entityMutation, context); } return; }

  const today = getLocalDateISO();
  const uid = context?.uid || useAuthStore.getState().user?.uid || 'system';

  const reversals = existingTxs.map(prevTx => {
    verifyLockDate(prevTx.date, context);
    return {
      uid,
      workspaceId,
      date: reversalDate(prevTx.date, today, context),
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

  await postTxsServerApi(reversals, workspaceId, entityMutation, context);
}
