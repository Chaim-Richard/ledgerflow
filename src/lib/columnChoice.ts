/**
 * Column chooser (N-10) for the report tables in ReportTableScroll: which columns of a table are
 * hidden, remembered per report on this device (browser storage), and the CSS that hides them.
 * The first column (what each row is) always stays, and so does at least one other.
 */
const KEY = (report: string) => `lf_columns:${report}`;

export function readHidden(report: string): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY(report)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n) && n > 0) : [];
  } catch {
    return [];
  }
}

export function saveHidden(report: string, hidden: number[]): void {
  try {
    if (hidden.length) localStorage.setItem(KEY(report), JSON.stringify(hidden));
    else localStorage.removeItem(KEY(report));
  } catch { /* browser storage off: the choice lasts while the screen is open */ }
}

/** Hide or show column `index` (0-based); the first column and the last visible one can't be hidden. */
export function toggleColumn(hidden: number[], index: number, columns: number): number[] {
  if (index <= 0 || index >= columns) return hidden;
  if (hidden.includes(index)) return hidden.filter(i => i !== index);
  if (columns - 1 - hidden.length <= 1) return hidden;
  return [...hidden, index].sort((a, b) => a - b);
}

/** The CSS hiding those columns in the tables under `[data-columns="scope"]`. */
export function hiddenColumnsCss(scope: string, hidden: number[]): string {
  return hidden.map(i => `[data-columns="${scope}"] tr > :nth-child(${i + 1}) { display: none; }`).join('\n');
}
