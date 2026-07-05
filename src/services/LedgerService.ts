import { EventLedger, LedgerEvent } from '../kernel/ledger/EventLedger';
import { Transaction } from '../types';
import { DoubleEntryValidator } from '../kernel/validation/DoubleEntryValidator';
import { AuditTrailEngine } from '../kernel/reporting/AuditTrailEngine';

export class LedgerService {
  /**
   * Appends a transaction as an immutable event.
   */
  static postTransaction(tx: Transaction, actorId: string): Transaction {
    // 1. Validate double entry
    DoubleEntryValidator.validateJournalEntry(tx);

    // 2. Mark as confirmed
    const finalTx = { ...tx, status: 'approved' as const };

    // 3. Append to Event Ledger
    tx.lines.forEach(line => {
      const event: LedgerEvent = {
        id: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        accountId: line.accountId,
        amountCents: line.amountCents,
        eventType: 'ACTUAL',
        transactionId: tx.id,
        description: line.description || tx.description
      };
      EventLedger.append(event);
    });

    // 4. Audit trail
    AuditTrailEngine.log({
      actorId,
      timestamp: new Date().toISOString(),
      objectId: tx.id,
      action: 'CREATE',
      newValue: finalTx
    });

    return finalTx;
  }
}
