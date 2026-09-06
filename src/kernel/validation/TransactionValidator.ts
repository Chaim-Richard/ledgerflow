import { Transaction } from '../../types';
import { DoubleEntryValidator } from './DoubleEntryValidator';
import { getDb } from '../../server/db/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export interface ValidationContext {
  workspaceId: string;
  user: { uid: string; admin: boolean };
  wsData: any;
}

export class TransactionValidator {
  
  static async validateAndPrepare(
    transaction: Transaction,
    context: ValidationContext,
    existingTx?: Transaction,
    t?: any
  ): Promise<Transaction> {
    const db = getDb();
    
    // 1. Period Lock
    if (context.wsData?.lockDate && transaction.date && transaction.date <= context.wsData.lockDate) {
      throw new Error(`Period Locked: Cannot post/modify transaction on ${transaction.date} before lock date ${context.wsData.lockDate}.`);
    }

    // 2. Status Locks
    if (existingTx && (existingTx.status === 'certified' || existingTx.status === 'void') && !context.user.admin) {
      throw new Error(`Forbidden: Transaction ${existingTx.id} status is locked.`);
    }

    // 3. Ownership / Immutability
    if (existingTx && existingTx.workspaceId !== context.workspaceId) {
      throw new Error(`Forbidden: Transaction does not belong to authorized workspace.`);
    }

    // 4. Account Verification
    if (transaction.lines) {
      const accountIds = Array.from(new Set<string>(transaction.lines.map((l: any) => l.accountId).filter(Boolean)));
      if (accountIds.length > 0) {
        const accRefs = accountIds.map(id => db.collection('chartAccounts').doc(id));
        const accSnaps = t ? await t.getAll(...accRefs) : await db.getAll(...accRefs);
        for (const snap of accSnaps) {
          if (!snap.exists || snap.data()?.workspaceId !== context.workspaceId) {
            throw new Error(`Account ${snap.id} does not exist or does not belong to authorized workspace.`);
          }
        }
      }
    }

    // 5. Double Entry
    DoubleEntryValidator.validateJournalEntry(transaction);
    
    return transaction;
  }
}
