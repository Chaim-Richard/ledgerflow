import { LedgerEvent } from '../ledger/EventLedger';

export interface BalanceSnapshot {
  workspaceId?: string;
  date: string;
  balancesByAccount: Record<string, number>;
}

export class DerivedBalanceEngine {
  private static snapshotsByWorkspace: Map<string, BalanceSnapshot[]> = new Map();

  static clearSnapshots(workspaceId?: string): void {
    if (workspaceId) {
      this.snapshotsByWorkspace.delete(workspaceId);
    } else {
      this.snapshotsByWorkspace.clear();
    }
  }

  static createSnapshot(date: string, events: LedgerEvent[], workspaceId: string = 'default'): void {
    const balances: Record<string, number> = {};
    events.forEach(e => {
      if (e.timestamp <= date) {
        balances[e.accountId] = (balances[e.accountId] || 0) + e.amountCents;
      }
    });

    const workspaceSnapshots = this.snapshotsByWorkspace.get(workspaceId) || [];
    workspaceSnapshots.push({ workspaceId, date, balancesByAccount: balances });
    workspaceSnapshots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    this.snapshotsByWorkspace.set(workspaceId, workspaceSnapshots);
  }

  static getBalanceAsOf(accountId: string, date: string, allEvents: LedgerEvent[], workspaceId: string = 'default'): number {
    const workspaceSnapshots = this.snapshotsByWorkspace.get(workspaceId) || [];
    // Find closest snapshot before or equal to date
    const snapshot = [...workspaceSnapshots].reverse().find(s => s.date <= date);
    
    let baseBalance = 0;
    let eventsToReplay = allEvents;

    if (snapshot) {
      baseBalance = snapshot.balancesByAccount[accountId] || 0;
      eventsToReplay = allEvents.filter(e => e.timestamp > snapshot.date && e.timestamp <= date);
    } else {
      eventsToReplay = allEvents.filter(e => e.timestamp <= date);
    }

    return eventsToReplay
      .filter(e => e.accountId === accountId)
      .reduce((sum, e) => sum + e.amountCents, baseBalance);
  }

  static getAverageBalance(accountId: string, startDate: string, endDate: string, allEvents: LedgerEvent[], workspaceId: string = 'default'): number {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const days = (end - start) / (1000 * 3600 * 24) || 1;
    
    let totalBalanceSum = 0;
    let currentBalance = this.getBalanceAsOf(accountId, startDate, allEvents, workspaceId);

    const periodEvents = allEvents
      .filter(e => e.accountId === accountId && e.timestamp > startDate && e.timestamp <= endDate)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let lastTime = start;

    for (const event of periodEvents) {
      const eventTime = new Date(event.timestamp).getTime();
      const timeDiff = (eventTime - lastTime) / (1000 * 3600 * 24);
      totalBalanceSum += currentBalance * timeDiff;
      currentBalance += event.amountCents;
      lastTime = eventTime;
    }

    const remainingTime = (end - lastTime) / (1000 * 3600 * 24);
    totalBalanceSum += currentBalance * remainingTime;

    return totalBalanceSum / days;
  }
}
