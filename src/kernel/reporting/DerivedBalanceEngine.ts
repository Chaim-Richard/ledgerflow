import { LedgerEvent } from '../ledger/EventLedger';
import { parseLocalDate } from '../../lib/utils';

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

  private fontNormalizeDate(d: string): string {
    if (!d) return '';
    return d.length > 10 ? d.substring(0, 10) : d;
  }

  static createSnapshot(date: string, events: LedgerEvent[], workspaceId: string = 'default'): void {
    const targetDate = date.length > 10 ? date.substring(0, 10) : date;
    const balances: Record<string, number> = {};

    events.forEach(e => {
      const eDate = e.timestamp.length > 10 ? e.timestamp.substring(0, 10) : e.timestamp;
      if (eDate <= targetDate) {
        balances[e.accountId] = (balances[e.accountId] || 0) + e.amountCents;
      }
    });

    const workspaceSnapshots = this.snapshotsByWorkspace.get(workspaceId) || [];
    workspaceSnapshots.push({ workspaceId, date: targetDate, balancesByAccount: balances });
    workspaceSnapshots.sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
    this.snapshotsByWorkspace.set(workspaceId, workspaceSnapshots);
  }

  static getBalanceAsOf(accountId: string, date: string, allEvents: LedgerEvent[], workspaceId: string = 'default'): number {
    const targetDate = date.length > 10 ? date.substring(0, 10) : date;
    const workspaceSnapshots = this.snapshotsByWorkspace.get(workspaceId) || [];
    
    // Find closest snapshot before or equal to targetDate
    const snapshot = [...workspaceSnapshots].reverse().find(s => s.date <= targetDate);
    
    let baseBalance = 0;
    let eventsToReplay = allEvents;

    if (snapshot) {
      baseBalance = snapshot.balancesByAccount[accountId] || 0;
      eventsToReplay = allEvents.filter(e => {
        const eDate = e.timestamp.length > 10 ? e.timestamp.substring(0, 10) : e.timestamp;
        return eDate > snapshot.date && eDate <= targetDate;
      });
    } else {
      eventsToReplay = allEvents.filter(e => {
        const eDate = e.timestamp.length > 10 ? e.timestamp.substring(0, 10) : e.timestamp;
        return eDate <= targetDate;
      });
    }

    return eventsToReplay
      .filter(e => e.accountId === accountId)
      .reduce((sum, e) => sum + e.amountCents, baseBalance);
  }

  static getAverageBalance(accountId: string, startDate: string, endDate: string, allEvents: LedgerEvent[], workspaceId: string = 'default'): number {
    const sDate = startDate.length > 10 ? startDate.substring(0, 10) : startDate;
    const eDate = endDate.length > 10 ? endDate.substring(0, 10) : endDate;

    const start = parseLocalDate(sDate).getTime();
    const end = parseLocalDate(eDate).getTime();
    if (end <= start) return this.getBalanceAsOf(accountId, sDate, allEvents, workspaceId);

    const days = (end - start) / (1000 * 3600 * 24) || 1;
    
    let totalBalanceSum = 0;
    let currentBalance = this.getBalanceAsOf(accountId, sDate, allEvents, workspaceId);

    const periodEvents = allEvents
      .filter(e => {
        const tDate = e.timestamp.length > 10 ? e.timestamp.substring(0, 10) : e.timestamp;
        return e.accountId === accountId && tDate > sDate && tDate <= eDate;
      })
      .sort((a, b) => parseLocalDate(a.timestamp).getTime() - parseLocalDate(b.timestamp).getTime());

    let lastTime = start;

    for (const event of periodEvents) {
      const eventTime = parseLocalDate(event.timestamp).getTime();
      const timeDiff = Math.max(0, (eventTime - lastTime) / (1000 * 3600 * 24));
      totalBalanceSum += currentBalance * timeDiff;
      currentBalance += event.amountCents;
      lastTime = eventTime;
    }

    const remainingTime = Math.max(0, (end - lastTime) / (1000 * 3600 * 24));
    totalBalanceSum += currentBalance * remainingTime;

    return totalBalanceSum / days;
  }
}
