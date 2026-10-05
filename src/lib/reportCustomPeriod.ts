export interface CustomReportPeriod { startDate: string; endDate: string }
export function validCustomReportPeriod(period: CustomReportPeriod): boolean {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2999 && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  try { return valid(period.startDate) && valid(period.endDate) && period.startDate <= period.endDate; } catch { return false; }
}
