import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../db/firestore';
import { RecurringTransaction } from '../../types';
import { findDueRecurring } from '../../lib/recurringEngine';
import { executeIdempotent, deriveScopedOperationKey } from '../utils/idempotency';
import crypto from 'crypto';

export interface ProcessRecurringResult {
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  totalDue: number;
  details: Array<{
    operationId: string;
    status: 'success' | 'skipped' | 'failed';
    error?: string;
    txId?: string;
  }>;
}

export async function processAllRecurring(): Promise<ProcessRecurringResult> {
  const db = getDb();
  console.log('[RecurringService] Starting background recurring processing...');

  const result: ProcessRecurringResult = {
    processedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    totalDue: 0,
    details: []
  };

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
      return result;
    }

    // 2. Find which ones are due
    const { generatedTransactions } = findDueRecurring(recurringList);
    result.totalDue = generatedTransactions.length;

    if (generatedTransactions.length === 0) {
      console.log('[RecurringService] No recurring transactions due today.');
      return result;
    }

    console.log(`[RecurringService] Found ${generatedTransactions.length} transactions to generate.`);

    // 3. Process each generated transaction within a single atomic Firestore transaction per operation
    for (const item of generatedTransactions) {
      const { transaction, templateId, updatedNextOccurrence } = item;
      const txDate = transaction.date || 'unknown_date';
      const rawOpId = `${templateId}:${txDate}`;
      const wsId = transaction.workspaceId || 'system';
      const scopedKey = deriveScopedOperationKey(wsId, 'RECURRING_TX_GENERATION', rawOpId);

      try {
        const opResult = await executeIdempotent(scopedKey, {
          actor: 'system:recurring_engine',
          workspaceId: wsId,
          operationType: 'RECURRING_TX_GENERATION'
        }, async (t) => {
          const txId = crypto.randomUUID();
          const recurringRef = db.collection('recurring').doc(templateId);
          const txRef = db.collection('transactions').doc(txId);

          // Step A: All reads first
          const recDoc = await t.get(recurringRef);
          if (!recDoc.exists || !recDoc.data()?.isActive) {
            throw new Error(`Template ${templateId} is no longer active.`);
          }

          const existingTx = await t.get(db.collection('transactions')
            .where('workspaceId', '==', wsId)
            .where('recurrenceOccurrenceKey', '==', `${templateId}:${txDate}`)
            .limit(1));

          if (!existingTx.empty) {
            const err = new Error(`Occurrence ${templateId}:${txDate} already generated.`);
            (err as any).status = 409;
            throw err;
          }

          // Step B: Ledger mutation writes
          t.set(txRef, {
            ...transaction,
            id: txId,
            createdAt: new Date().toISOString(),
            updatedAt: FieldValue.serverTimestamp()
          });

          // Step C: Update next occurrence state
          t.update(recurringRef, {
            nextOccurrence: updatedNextOccurrence,
            updatedAt: FieldValue.serverTimestamp()
          });

          return { txId, templateId, date: txDate };
        });

        console.log(`[RecurringService] Successfully processed ${scopedKey}`);
        result.processedCount++;
        result.details.push({
          operationId: scopedKey,
          status: 'success',
          txId: opResult?.txId
        });
      } catch (err: any) {
        if (err.message?.includes('already succeeded') || err.status === 409) {
          console.log(`[RecurringService] Skipping ${scopedKey} - already processed.`);
          result.skippedCount++;
          result.details.push({
            operationId: scopedKey,
            status: 'skipped'
          });
        } else {
          console.error(`[RecurringService] Failed to process ${scopedKey}:`, err);
          result.failedCount++;
          result.details.push({
            operationId: scopedKey,
            status: 'failed',
            error: err.message
          });
        }
      }
    }

    console.log(`[RecurringService] Completed. Processed: ${result.processedCount}, Skipped: ${result.skippedCount}, Failed: ${result.failedCount}`);
    return result;
  } catch (error: any) {
    console.error('[RecurringService] Error processing recurring transactions:', error);
    throw error;
  }
}
