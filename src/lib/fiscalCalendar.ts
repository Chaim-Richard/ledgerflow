import { getLocalDateISO } from './utils';

/**
 * Formats a Date object in UTC to YYYY-MM-DD string
 */
function toUtcYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface FiscalYearBounds {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  fiscalYear: number;
}

export interface FiscalQuarterInfo {
  quarter: 1 | 2 | 3 | 4;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;      // e.g. "FY2026 Q1"
  fiscalYear: number;
}

/**
 * Calculates the start and end calendar dates for the fiscal year containing the given target date.
 * @param targetDate ISO string (YYYY-MM-DD) or Date instance
 * @param fiscalYearStartMonth 1 (Jan) to 12 (Dec). Defaults to 1 (calendar year).
 * @param fiscalYearStartDay 1 to 31. Defaults to 1.
 */
export function getFiscalYearBounds(
  targetDate: string | Date = new Date(),
  fiscalYearStartMonth = 1,
  fiscalYearStartDay = 1
): FiscalYearBounds {
  const dateStr = typeof targetDate === 'string' ? targetDate : getLocalDateISO(targetDate);
  const parts = dateStr.split('T')[0].split('-');
  const calYear = parseInt(parts[0], 10);
  const calMonth = parseInt(parts[1], 10);
  const calDay = parseInt(parts[2], 10);

  // Normalize month: 1..12
  const startMonth = Math.min(Math.max(fiscalYearStartMonth || 1, 1), 12);
  const startDay = Math.min(Math.max(fiscalYearStartDay || 1, 1), 28); // Safe day bounds

  let fyStartYear: number;
  let fyEndYear: number;

  if (calMonth > startMonth || (calMonth === startMonth && calDay >= startDay)) {
    fyStartYear = calYear;
    fyEndYear = startMonth === 1 && startDay === 1 ? calYear : calYear + 1;
  } else {
    fyStartYear = calYear - 1;
    fyEndYear = calYear;
  }

  const startMonthStr = String(startMonth).padStart(2, '0');
  const startDayStr = String(startDay).padStart(2, '0');
  const startDate = `${fyStartYear}-${startMonthStr}-${startDayStr}`;

  // End date is 1 day before the next fiscal year start
  const endTargetDate = new Date(Date.UTC(fyStartYear + 1, startMonth - 1, startDay));
  endTargetDate.setUTCDate(endTargetDate.getUTCDate() - 1);
  const endDate = toUtcYMD(endTargetDate);

  return {
    startDate,
    endDate,
    fiscalYear: fyEndYear
  };
}

/**
 * Calculates which fiscal quarter (Q1-Q4) a date falls into along with start and end dates.
 */
export function getFiscalQuarter(
  targetDate: string | Date = new Date(),
  fiscalYearStartMonth = 1,
  fiscalYearStartDay = 1
): FiscalQuarterInfo {
  const dateStr = typeof targetDate === 'string' ? targetDate : getLocalDateISO(targetDate);
  const bounds = getFiscalYearBounds(dateStr, fiscalYearStartMonth, fiscalYearStartDay);
  
  const fyStart = new Date(bounds.startDate + 'T00:00:00Z');
  const target = new Date(dateStr + 'T00:00:00Z');

  // Month offset from FY start
  const monthDiff = (target.getUTCFullYear() - fyStart.getUTCFullYear()) * 12 + (target.getUTCMonth() - fyStart.getUTCMonth());
  const quarterIndex = Math.min(Math.max(Math.floor(monthDiff / 3), 0), 3) as 0 | 1 | 2 | 3;
  const quarterNumber = (quarterIndex + 1) as 1 | 2 | 3 | 4;

  const qStartDateObj = new Date(fyStart);
  qStartDateObj.setUTCMonth(qStartDateObj.getUTCMonth() + quarterIndex * 3);
  const qStartDate = toUtcYMD(qStartDateObj);

  const qEndDateObj = new Date(fyStart);
  qEndDateObj.setUTCMonth(qEndDateObj.getUTCMonth() + (quarterIndex + 1) * 3);
  qEndDateObj.setUTCDate(qEndDateObj.getUTCDate() - 1);
  const qEndDate = toUtcYMD(qEndDateObj);

  return {
    quarter: quarterNumber,
    startDate: qStartDate,
    endDate: qEndDate,
    label: `FY${bounds.fiscalYear} Q${quarterNumber}`,
    fiscalYear: bounds.fiscalYear
  };
}

/**
 * Returns a human-friendly fiscal period label.
 */
export function getFiscalPeriodLabel(
  targetDate: string | Date = new Date(),
  fiscalYearStartMonth = 1,
  fiscalYearStartDay = 1
): string {
  const q = getFiscalQuarter(targetDate, fiscalYearStartMonth, fiscalYearStartDay);
  return q.label;
}

/**
 * Computes the prior period date range of equivalent length preceding the given date range.
 */
export function getPrevPeriod(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - diffDays);

  return {
    startDate: toUtcYMD(prevStart),
    endDate: toUtcYMD(prevEnd)
  };
}
