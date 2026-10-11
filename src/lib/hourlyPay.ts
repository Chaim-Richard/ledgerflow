/**
 * Timesheet-driven pay (U-11): an hourly employee is paid for their approved time. Each pay run pays
 * the approved time (Time, V-05) of the workspace member linked to the employee, dated on or before
 * the pay date and not paid by an earlier run, at the employee's hourly rate. The payroll engine is
 * unchanged: the period's pay is handed to it as the yearly salary it would be at that pay
 * frequency, which it divides back to exactly the same amount, so taxes and deductions work as for
 * everyone else. The run keeps which time it paid; undoing or sending it back frees that time.
 */
import type { Employee } from '../types';
import { getPeriodsPerYear } from './payroll-engine';

export const isHourly = (e: Pick<Employee, 'payType'>) => e.payType === 'hourly';

/** This period's pay for the minutes worked, whole cents (minutes × rate ÷ 60, rounded once). */
export const hourlyGrossCents = (e: Pick<Employee, 'hourlyRateCents'>, minutes: number) => Math.round(minutes * (Number(e.hourlyRateCents) || 0) / 60);

/** The employee as the payroll engine sees them for this period: the period's pay as a yearly salary. */
export function asPaidFor(e: Employee, minutes: number): Employee {
  return { ...e, salaryCents: hourlyGrossCents(e, minutes) * getPeriodsPerYear(e.payFrequency) };
}

export interface PayableTime { id: string; person: string; date: string; minutes: number; status: string; paidRunId?: string }

/** By employee: the approved time not paid yet, up to the pay date (its minutes and which entries). */
export function hoursToPay(employees: Employee[], entries: PayableTime[], payDate: string): Map<string, { minutes: number; entryIds: string[] }> {
  const out = new Map<string, { minutes: number; entryIds: string[] }>();
  for (const e of employees) {
    if (!isHourly(e) || !e.timeUid) continue;
    const mine = entries.filter(t => t.person === e.timeUid && (t.status === 'approved' || t.status === 'invoiced') && !t.paidRunId && t.date <= payDate);
    out.set(e.id, { minutes: mine.reduce((s, t) => s + t.minutes, 0), entryIds: mine.map(t => t.id) });
  }
  return out;
}

/** What an hourly employee needs; null when it is fine (or they are paid a salary). */
export function hourlyProblem(e: Pick<Employee, 'payType' | 'hourlyRateCents' | 'timeUid'>): string | null {
  if (!isHourly(e)) return null;
  if (!Number.isSafeInteger(e.hourlyRateCents) || (e.hourlyRateCents as number) <= 0) return 'An hourly employee needs their hourly rate';
  if (!e.timeUid) return 'Choose whose time pays them (the person in this workspace who logs it)';
  return null;
}
