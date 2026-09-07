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

function normalizeDatePrefix(d: string): string {
  if (!d) return '';
  return d.length >= 10 ? d.slice(0, 10) : d;
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
    return this.events.map(e => ({
      ...e,
      metadata: e.metadata ? { ...e.metadata } : undefined
    }));
  }

  static getEventsByDateRange(startDate: string, endDate: string): LedgerEvent[] {
    const start = normalizeDatePrefix(startDate);
    const end = normalizeDatePrefix(endDate);
    return this.events
      .filter(e => {
        const d = normalizeDatePrefix(e.timestamp);
        return d >= start && d <= end;
      })
      .map(e => ({
        ...e,
        metadata: e.metadata ? { ...e.metadata } : undefined
      }));
  }

  static getEventsByType(eventType: LedgerEvent['eventType']): LedgerEvent[] {
    return this.events
      .filter(e => e.eventType === eventType)
      .map(e => ({
        ...e,
        metadata: e.metadata ? { ...e.metadata } : undefined
      }));
  }

  static getAccountBalance(accountId: string, asOfDate?: string): number {
    const cutoff = asOfDate ? normalizeDatePrefix(asOfDate) : null;
    return this.events
      .filter(e => e.accountId === accountId && (!cutoff || normalizeDatePrefix(e.timestamp) <= cutoff))
      .reduce((sum, e) => sum + e.amountCents, 0);
  }

  static clear(): void {
    // Only for testing/resetting
    this.events = [];
  }
}
