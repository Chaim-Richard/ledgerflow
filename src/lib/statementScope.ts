/**
 * AUD-01: one scope for a customer's or vendor's statement, used by the screen (StatementView), the server JSON
 * (/reports/statement) and the PDF and emailed statements (statementService). Same period, same documents, same
 * opening balance:
 *   - the period: the dates given, else 1 January of this year to today, both in the workspace's time zone; a date
 *     that is not a real YYYY-MM-DD, or a start after the end, is refused (never quietly widened to all history);
 *   - the documents: the contact's own issued invoices or bills, posted payments and credits, picked by
 *     computeStatement whichever way they were read, in one fixed order (same-day rows too, so every running
 *     balance agrees);
 *   - the opening balance: everything before the start, always shown as the first row.
 */
export interface StatementScope { startDate: string; endDate: string }

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (s: string) => DAY.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** The statement's period from what was asked (query strings, the screen's fields) and today's date in the workspace. */
export function resolveStatementScope(input: { startDate?: unknown; endDate?: unknown }, today: string): { scope: StatementScope } | { error: string } {
  const pick = (value: unknown, fallback: string): string | null => {
    if (value === undefined || value === null || value === '') return fallback;
    return typeof value === 'string' && realDay(value) ? value : null;
  };
  const startDate = pick(input.startDate, `${today.slice(0, 4)}-01-01`);
  const endDate = pick(input.endDate, today);
  if (!startDate || !endDate) return { error: 'Statement dates are YYYY-MM-DD' };
  if (startDate > endDate) return { error: 'The statement period starts after it ends' };
  return { scope: { startDate, endDate } };
}

/** A statement's printed rows: the opening balance first, then each entry with the balance after it. */
export function statementRows(stmt: { startDate: string; openingBalanceCents: number; entries: Array<{ date: string; type: string; reference: string; amountCents: number; runningBalanceCents: number }> }) {
  return [
    { date: stmt.startDate, type: 'Opening balance', reference: '', amountCents: stmt.openingBalanceCents, runningBalanceCents: stmt.openingBalanceCents },
    ...stmt.entries.map(e => ({ date: e.date, type: e.type, reference: e.reference, amountCents: e.amountCents, runningBalanceCents: e.runningBalanceCents })),
  ];
}
