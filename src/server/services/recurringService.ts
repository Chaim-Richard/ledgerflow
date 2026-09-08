import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { RecurringTransaction, Transaction } from '../../types';
import { findDueRecurring } from '../../lib/recurringEngine';
import { executeIdempotent } from '../utils/idempotency';
import crypto from 'crypto';

export async function processAllRecurring() {
  const db = getFirestore();
  console.log('[RecurringService] Starting background process...');

  try {
    // 1. Fetch all active recurring transactions
    const recurringSnap = await db.collection('recurring')
      .where('isActive', '==', true)
      .get();

    const recurringList = recurringSnap.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as RecurringTransaction[];

    if (recurringList.length === 0) {
      console.log('[RecurringService] No active recurring transactions found.');
      return;
    }

    // 2. Find which ones are due
    const { generatedTransactions } = findDueRecurring(recurringList);

    if (generatedTransactions.length === 0) {
      console.log('[RecurringService] No recurring transactions due today.');
      return;
    }

    console.log(`[RecurringService] Found ${generatedTransactions.length} transactions to generate.`);

    // 3. Process each generated transaction with idempotency
    for (const item of generatedTransactions) {
      const { transaction, templateId, updatedNextOccurrence } = item;
      const txDate = transaction.date || 'unknown_date';
      const operationId = `recurring:${templateId}:${txDate}`;

      try {
        await executeIdempotent(operationId, {
          actor: 'system:recurring_engine',
          workspaceId: transaction.workspaceId || 'unknown',
          operationType: 'RECURRING_TX_GENERATION'
        }, async () => {
          const txId = crypto.randomUUID();
          
          await db.runTransaction(async (t) => {
            const recurringRef = db.collection('recurring').doc(templateId);
            const txRef = db.collection('transactions').doc(txId);

            // Verify template still exists and is active
            const recDoc = await t.get(recurringRef);
            if (!recDoc.exists || !recDoc.data()?.isActive) {
              throw new Error(`Template ${templateId} is no longer active.`);
            }

            // Create the transaction
            t.set(txRef, {
              ...transaction,
              id: txId,
              createdAt: new Date().toISOString(),
              updatedAt: FieldValue.serverTimestamp()
            });

            // Update the template's next occurrence
            t.update(recurringRef, {
              nextOccurrence: updatedNextOccurrence,
              updatedAt: FieldValue.serverTimestamp()
            });
          });

          return { txId, templateId, date: txDate };
        });

        console.log(`[RecurringService] Successfully processed ${operationId}`);
      } catch (err: any) {
        if (err.message?.includes('already succeeded')) {
          console.log(`[RecurringService] Skipping ${operationId} - already processed.`);
        } else {
          console.error(`[RecurringService] Failed to process ${operationId}:`, err);
        }
      }
    }

    console.log('[RecurringService] Background process completed.');
  } catch (error) {
    console.error('[RecurringService] Error processing recurring transactions:', error);
  }
}
