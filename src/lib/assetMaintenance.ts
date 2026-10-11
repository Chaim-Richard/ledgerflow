/**
 * The maintenance log of a fixed asset (X-06): each service, repair or inspection with its day, what
 * was done, who did it and what it cost, newest first; and the day the next service is due, reminded
 * like the warranty (src/lib/assetReminders.ts). The log is a record, not a posting: what a service
 * cost is booked on its bill.
 */
import type { AssetMaintenance } from '../types';

export const MAX_MAINTENANCE = 500;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Date.parse normalizes February 30; a maintenance day must round-trip unchanged. */
export function isMaintenanceDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Why this entry can't be added, or null. */
export function maintenanceProblem(entry: { date?: string; description?: string; costCents?: number; nextDue?: string; by?: string }): string | null {
  if (!entry.date || !isMaintenanceDay(entry.date)) return 'Give the day it was done';
  const what = (entry.description || '').trim();
  if (what.length < 2 || what.length > 300) return 'Say what was done (2 to 300 characters)';
  if (entry.costCents !== undefined && (!Number.isSafeInteger(entry.costCents) || entry.costCents < 0)) return 'The cost is an amount of 0 or more';
  if (entry.nextDue && (!isMaintenanceDay(entry.nextDue))) return 'The next service is a day (YYYY-MM-DD)';
  if (entry.by && entry.by.trim().length > 120) return 'Who did it must be 120 characters or fewer';
  if (entry.nextDue && entry.nextDue <= entry.date) return 'The next service comes after this one';
  return null;
}

/** The log with this entry in it, newest first. */
export function withEntry(log: AssetMaintenance[] | undefined, entry: AssetMaintenance): AssetMaintenance[] {
  if ((log || []).length >= MAX_MAINTENANCE) throw new Error(`This log already has ${MAX_MAINTENANCE} entries. Remove an entry before adding another.`);
  return [entry, ...(log || [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/** What the log cost in all, in whole cents. */
export const maintenanceCost = (log: AssetMaintenance[] | undefined) => (log || []).reduce((s, e) => s + (e.costCents || 0), 0);
