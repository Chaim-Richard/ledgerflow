import { Transaction } from '../../types';
import { DoubleEntryValidator } from './DoubleEntryValidator';
import { getDb } from '../../server/db/firestore';
import { TransactionSchema } from '../../schemas';
import { getAbsoluteTotal } from '../../lib/txFilters';

export interface ValidationContext {
  workspaceId: string;
  user: { uid: string; admin?: boolean };
  wsData: any;
  accountsMap?: Map<string, any>;
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
    
    // Ensure ownership & workspace (N14: Unconditionally enforce ownership)
    transaction.workspaceId = context.workspaceId;
    transaction.uid = context.user.uid;

    // N9: Prevent ghost simulation IDs from persisting as regular ledger transactions
    if (transaction.id && typeof transaction.id === 'string' && transaction.id.startsWith('ghost-') && transaction.type !== 'forecast') {
      throw new Error("Invalid transaction ID: 'ghost-' prefix is reserved for ephemeral client simulations.");
    }

    // #88 & N15 - Semantic contract: totalAmountCents is ALWAYS absolute positive safe integer, using FX-aware line amounts
    if (Array.isArray(transaction.lines) && transaction.lines.length > 0) {
      const calculatedTotal = getAbsoluteTotal(transaction);
      if (!Number.isSafeInteger(calculatedTotal)) {
        throw new Error(`Validation Failed: totalAmountCents exceeds safe integer bounds.`);
      }
      transaction.totalAmountCents = calculatedTotal;
    } else if (transaction.totalAmountCents !== undefined && transaction.totalAmountCents !== null) {
      const absVal = Math.abs(Math.round(transaction.totalAmountCents));
      if (!Number.isSafeInteger(absVal)) {
        throw new Error(`Validation Failed: totalAmountCents exceeds safe integer bounds.`);
      }
      transaction.totalAmountCents = absVal;
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
        let accMap = context.accountsMap;
        if (!accMap) {
          const accRefs = accountIds.map(id => db.collection('chartAccounts').doc(id));
          const accSnaps = t ? await t.getAll(...accRefs) : await db.getAll(...accRefs);
          accMap = new Map<string, any>();
          for (const snap of accSnaps) {
            accMap.set(snap.id, snap.data());
          }
        }
        for (const id of accountIds) {
          const accData = accMap.get(id);
          if (!accData || accData.workspaceId !== context.workspaceId) {
            throw new Error(`Account ${id} does not exist or does not belong to authorized workspace.`);
          }
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

