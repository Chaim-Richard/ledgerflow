/**
 * The maintenance log of a fixed asset (X-06): each service, repair or inspection with its day, what
 * was done, who did it and what it cost, newest first; and the day the next service is due, reminded
 * like the warranty (src/lib/assetReminders.ts). The log is a record, not a posting: what a service
 * cost is booked on its bill.
 */
import type { AssetMaintenance } from '../types';

export const MAX_MAINTENANCE = 500;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Why this entry can't be added, or null. */
export function maintenanceProblem(entry: { date?: string; description?: string; costCents?: number; nextDue?: string }): string | null {
  if (!entry.date || !DAY.test(entry.date) || Number.isNaN(Date.parse(entry.date))) return 'Give the day it was done';
  const what = (entry.description || '').trim();
  if (what.length < 2 || what.length > 300) return 'Say what was done (2 to 300 characters)';
  if (entry.costCents !== undefined && (!Number.isSafeInteger(entry.costCents) || entry.costCents < 0)) return 'The cost is an amount of 0 or more';
  if (entry.nextDue && (!DAY.test(entry.nextDue) || Number.isNaN(Date.parse(entry.nextDue)))) return 'The next service is a day (YYYY-MM-DD)';
  if (entry.nextDue && entry.nextDue <= entry.date) return 'The next service comes after this one';
  return null;
}

/** The log with this entry in it, newest first. */
export function withEntry(log: AssetMaintenance[] | undefined, entry: AssetMaintenance): AssetMaintenance[] {
  return [entry, ...(log || [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, MAX_MAINTENANCE);
}

/** What the log cost in all, in whole cents. */
export const maintenanceCost = (log: AssetMaintenance[] | undefined) => (log || []).reduce((s, e) => s + (e.costCents || 0), 0);
