/** Validate a Gregorian calendar date without consulting a clock or the browser's time zone. */
export function bankStatementDate(year: number, month: number, day: number): string | null {
  if (![year, month, day].every(Number.isInteger) || year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
