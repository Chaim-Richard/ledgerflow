export interface LedgerEvent {
  id: string;
  timestamp: string;
  accountId: string;
  amountCents: number; // Positive = Debit, Negative = Credit
  eventType: 'ACTUAL' | 'CORRECTION' | 'REVERSAL' | 'DEPRECIATION' | 'FX_ADJUSTMENT' | 'CONSOLIDATION';
  parentEventId?: string;
  transactionId?: string; // Link to the business transaction
  description?: string;
  metadata?: Record<string, any>;
}

export class EventLedger {
  // Append-only log of events
  private static events: LedgerEvent[] = [];

  static append(event: LedgerEvent): void {
    // Basic validation before append
    if (isNaN(event.amountCents)) {
      throw new Error("Invalid amount");
    }
    // Deep clone to ensure immutability in memory
    this.events.push(JSON.parse(JSON.stringify(event)));
  }

  static getEvents(): LedgerEvent[] {
    return this.events;
  }

  static getEventsByDateRange(startDate: string, endDate: string): LedgerEvent[] {
    return this.events.filter(e => e.timestamp >= startDate && e.timestamp <= endDate);
  }

  static getEventsByType(eventType: LedgerEvent['eventType']): LedgerEvent[] {
    return this.events.filter(e => e.eventType === eventType);
  }

  static getAccountBalance(accountId: string, asOfDate?: string): number {
    return this.events
      .filter(e => e.accountId === accountId && (!asOfDate || e.timestamp <= asOfDate))
      .reduce((sum, e) => sum + e.amountCents, 0);
  }

  static clear(): void {
    // Only for testing/resetting
    this.events = [];
  }
}
