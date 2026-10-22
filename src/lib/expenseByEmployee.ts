/**
 * A-191: expense by employee, with receipt status. Read-only: an expense claim is a bill carrying
 * claim metadata (src/lib/expenseClaims.ts), owed to the person named on the bill. This report
 * groups the receipt checklist's own rows (A-133, src/lib/receiptChecklist.ts — the same
 * recorded / missing / not-checked evidence reading, never a second opinion about what counts as
 * a receipt) by that employee: how many claims, how much in each currency, where they stand
 * (waiting / approved / rejected), and how many still have no receipt evidence recorded.
 *
 * Amounts stay in each claim bill's own currency and are totalled per currency, never converted
 * and never added across currencies. A linked file is recorded evidence on the checklist's terms;
 * nothing here approves, rejects or posts a claim.
 */
import { receiptChecklist, type ReceiptChecklistInput, type ReceiptChecklistRow } from './receiptChecklist';

export interface EmployeeExpenseRow {
  employee: string;
  claims: number;
  /** claim totals per bill currency, minor units, largest first */
  totals: Array<{ currency: string; cents: number }>;
  waiting: number;
  approved: number;
  rejected: number;
  receiptsRecorded: number;
  receiptsMissing: number;
  receiptsNotChecked: number;
  claimsWithFiles: number;
}

export interface ExpenseByEmployeeReport {
  rows: EmployeeExpenseRow[];
  /** every claim behind the rows, in the checklist's own order, for the drill-down list */
  claims: ReceiptChecklistRow[];
}

export function expenseByEmployee(input: ReceiptChecklistInput): ExpenseByEmployeeReport {
  const { rows: claims } = receiptChecklist(input);
  const byEmployee = new Map<string, EmployeeExpenseRow & { byCurrency: Map<string, number> }>();
  for (const claim of claims) {
    const key = claim.employeeName;
    const row = byEmployee.get(key) || {
      employee: key, claims: 0, totals: [], byCurrency: new Map<string, number>(),
      waiting: 0, approved: 0, rejected: 0,
      receiptsRecorded: 0, receiptsMissing: 0, receiptsNotChecked: 0, claimsWithFiles: 0,
    };
    row.claims += 1;
    row.byCurrency.set(claim.currency, (row.byCurrency.get(claim.currency) || 0) + claim.amountCents);
    if (claim.state === 'submitted') row.waiting += 1;
    else if (claim.state === 'approved') row.approved += 1;
    else if (claim.state === 'rejected') row.rejected += 1;
    if (claim.evidenceStatus === 'recorded') row.receiptsRecorded += 1;
    else if (claim.evidenceStatus === 'missing') row.receiptsMissing += 1;
    else row.receiptsNotChecked += 1;
    if (claim.attachmentCount > 0) row.claimsWithFiles += 1;
    byEmployee.set(key, row);
  }
  const rows = [...byEmployee.values()].map(({ byCurrency, ...row }) => ({
    ...row,
    totals: [...byCurrency.entries()]
      .map(([currency, cents]) => ({ currency, cents }))
      .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents) || a.currency.localeCompare(b.currency)),
  }));
  // the employee with the most missing receipts first: this is a review list
  rows.sort((a, b) => b.receiptsMissing - a.receiptsMissing || b.claims - a.claims || a.employee.localeCompare(b.employee));
  return { rows, claims };
}

export const EXPENSE_BY_EMPLOYEE_CSV_HEADERS = [
  'Employee', 'Claims', 'Currency', 'Claimed (minor units)', 'Waiting', 'Approved', 'Rejected',
  'Receipts recorded', 'Receipts missing', 'Receipts not checked', 'Claims with linked files',
] as const;

/** One row per employee and currency, so no two currencies are ever added together. */
export function expenseByEmployeeCsvRows(rows: readonly EmployeeExpenseRow[]): Array<Array<string | number>> {
  return rows.flatMap(row => row.totals.map(total => [
    row.employee, row.claims, total.currency, total.cents, row.waiting, row.approved, row.rejected,
    row.receiptsRecorded, row.receiptsMissing, row.receiptsNotChecked, row.claimsWithFiles,
  ]));
}
