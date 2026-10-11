/**
 * Paid time off (U-04), in hours. An employee earns their yearly allowance spread over their pay
 * runs: each posted run that paid them adds the allowance ÷ the runs in a year for their pay
 * frequency (52 weekly, 26 every two weeks, 12 monthly). The balance is the hours they started with
 * plus what they earned, less the time off they took. Its value is the balance at their hourly rate
 * (salary ÷ 2,080 working hours): what the business owes if they took it all. Contractors earn none.
 * Pure: the Payroll screen shows it and saves the allowance and the time taken on the employee.
 */
import type { Employee } from '../types';

export const PERIODS_PER_YEAR: Record<Employee['payFrequency'], number> = { Weekly: 52, 'Bi-Weekly': 26, Monthly: 12 };
export const WORK_HOURS_PER_YEAR = 2080;
export const MAX_HOURS_PER_YEAR = 400;

export interface TimeOff { date: string; hours: number; note?: string }

export interface PtoBalance {
  /** hours earned by the posted runs that paid this employee */
  earnedHours: number;
  takenHours: number;
  /** opening + earned − taken */
  balanceHours: number;
  /** the balance at the hourly rate, in cents */
  valueCents: number;
  runs: number;
}

type RunLike = { date: string; status: string; employees?: Array<{ employeeId: string }> };

const hours = (n: number) => Math.round(n * 100) / 100;

function isValidYMD(d: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const [y, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return Boolean(days) && day >= 1 && day <= days;
}

export function ptoBalance(employee: Employee, runs: RunLike[], asOf = '9999-12-31'): PtoBalance {
  if (employee.workerType === 'contractor') return { earnedHours: 0, takenHours: 0, balanceHours: 0, valueCents: 0, runs: 0 };
  const perRun = (employee.ptoHoursPerYear || 0) / (PERIODS_PER_YEAR[employee.payFrequency] || 12);
  const paid = runs.filter(r => r.status === 'processed' && r.date <= asOf && (r.employees || []).some(e => e.employeeId === employee.id)).length;
  const earnedHours = hours(perRun * paid);
  const takenHours = hours((employee.ptoTaken || []).filter(t => t.date <= asOf).reduce((s, t) => s + t.hours, 0));
  const balanceHours = hours((employee.ptoOpeningHours || 0) + earnedHours - takenHours);
  const valueCents = Math.round(balanceHours * (employee.salaryCents || 0) / WORK_HOURS_PER_YEAR);
  return { earnedHours, takenHours, balanceHours, valueCents, runs: paid };
}

/** Why a yearly allowance or opening balance cannot be saved, or null. */
export function allowanceProblem(value: number, what = 'The yearly allowance'): string | null {
  if (!Number.isFinite(value) || value < 0) return `${what} must be zero or more hours`;
  if (value > MAX_HOURS_PER_YEAR) return `${what} is at most ${MAX_HOURS_PER_YEAR} hours`;
  if (hours(value) !== value) return `${what} has at most two decimals`;
  return null;
}

/** Why time off cannot be recorded, or null: a real date, 0.25–24 hours a day, not more than is available. */
export function timeOffProblem(entry: TimeOff, balanceHours: number): string | null {
  if (!isValidYMD(entry.date)) return 'Choose the day taken';
  if (!Number.isFinite(entry.hours) || entry.hours <= 0) return 'Enter the hours taken';
  if (entry.hours > 24 * 31) return 'Record at most a month at a time';
  if (hours(entry.hours) !== entry.hours) return 'Hours have at most two decimals';
  if (entry.hours > balanceHours) return `Only ${balanceHours} hour${balanceHours === 1 ? '' : 's'} of time off are available`;
  return null;
}
