import { Transaction } from '../../types';
import { DoubleEntryValidator } from './DoubleEntryValidator';
import { getDb } from '../../server/db/firestore';
import { TransactionSchema } from '../../schemas';

export interface ValidationContext {
  workspaceId: string;
  user: { uid: string; admin?: boolean };
  wsData: any;
}

export class TransactionValidator {
  
  static validateTransactionState(existingTx: Transaction, context: ValidationContext) {
    // 1. Period Lock
    if (context.wsData?.lockDate && existingTx.date && existingTx.date <= context.wsData.lockDate) {
      throw new Error(`Period Locked: Cannot modify transaction on ${existingTx.date} before lock date ${context.wsData.lockDate}.`);
    }

    // 2. Status Locks
    if ((existingTx.status === 'certified' || existingTx.status === 'void') && !context.user.admin) {
      throw new Error(`Forbidden: Transaction ${existingTx.id} status is locked.`);
    }

    // 3. Ownership
    if (existingTx.workspaceId !== context.workspaceId) {
      throw new Error(`Forbidden: Transaction does not belong to authorized workspace.`);
    }
  }

  static async validateAndPrepare(
    transaction: any,
    context: ValidationContext,
    existingTx?: Transaction,
    t?: any
  ): Promise<Transaction> {
    const db = getDb();
    
    // Ensure ownership & workspace
    transaction.workspaceId = context.workspaceId;
    if (!transaction.uid) {
      transaction.uid = context.user.uid;
    }

    // #88 - Semantic contract: totalAmountCents is ALWAYS absolute positive safe integer
    if (transaction.totalAmountCents !== undefined && transaction.totalAmountCents !== null) {
      const absVal = Math.abs(Math.round(transaction.totalAmountCents));
      if (!Number.isSafeInteger(absVal)) {
        throw new Error(`Validation Failed: totalAmountCents exceeds safe integer bounds.`);
      }
      transaction.totalAmountCents = absVal;
    } else if (Array.isArray(transaction.lines)) {
      const positiveSum = transaction.lines
        .filter((l: any) => (l.amountCents || 0) > 0)
        .reduce((sum: number, l: any) => sum + Math.round(l.amountCents || 0), 0);
      transaction.totalAmountCents = Math.abs(positiveSum);
    }

    // Full Schema Validation
    const parsed = TransactionSchema.safeParse(transaction);
    if (!parsed.success) {
      const errMsgs = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Schema validation failed: ${errMsgs}`);
    }

    const validatedTx = {
      ...parsed.data,
      id: parsed.data.id || transaction.id || db.collection("transactions").doc().id,
      totalAmountCents: transaction.totalAmountCents ?? 0
    } as Transaction;

    // 1. Period Lock
    if (context.wsData?.lockDate && validatedTx.date && validatedTx.date <= context.wsData.lockDate) {
      throw new Error(`Period Locked: Cannot post/modify transaction on ${validatedTx.date} before lock date ${context.wsData.lockDate}.`);
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
    if (validatedTx.lines) {
      const accountIds = Array.from(new Set<string>(validatedTx.lines.map((l: any) => l.accountId).filter(Boolean)));
      if (accountIds.length > 0) {
        const accRefs = accountIds.map(id => db.collection('chartAccounts').doc(id));
        const accSnaps = t ? await t.getAll(...accRefs) : await db.getAll(...accRefs);
        const accMap = new Map<string, any>();
        for (const snap of accSnaps) {
          if (!snap.exists || snap.data()?.workspaceId !== context.workspaceId) {
            throw new Error(`Account ${snap.id} does not exist or does not belong to authorized workspace.`);
          }
          accMap.set(snap.id, snap.data());
        }
        for (const line of validatedTx.lines) {
          if (!line.accountName && accMap.has(line.accountId)) {
            line.accountName = accMap.get(line.accountId)?.name || 'Account';
          }
        }
      }
    }

    // 5. Double Entry
    DoubleEntryValidator.validateJournalEntry(validatedTx);
    
    return validatedTx;
  }
}

