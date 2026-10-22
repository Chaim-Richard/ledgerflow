import React, { useEffect, useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDataNeedsStore } from '../../stores/useDataNeedsStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { loadAttachmentLinkIndex, type AttachmentLinkIndexRow } from '../../services/attachmentActions';
import { formatCurrency } from '../../lib/utils';
import { downloadCsv } from '../../lib/csvExport';
import {
  expenseByEmployee, expenseByEmployeeCsvRows, EXPENSE_BY_EMPLOYEE_CSV_HEADERS,
} from '../../lib/expenseByEmployee';
import type { ReceiptChecklistRow } from '../../lib/receiptChecklist';
import ReportTableScroll from './ReportTableScroll';

const stateText: Record<string, string> = { submitted: 'Waiting', approved: 'Approved', rejected: 'Rejected' };
const evidenceText = (row: ReceiptChecklistRow) =>
  row.evidenceStatus === 'recorded'
    ? row.attachmentCount ? `${row.attachmentCount} linked file(s); content not checked` : 'Receipt URL recorded; link not verified'
    : row.evidenceStatus === 'missing' ? 'No receipt URL or linked file — review' : 'Not checked';

/**
 * A-191: expense by employee with receipt status. The receipt checklist's claims (A-133) grouped by
 * the employee each claim bill is owed to, with where each claim stands and whether receipt
 * evidence is recorded. Amounts stay in each bill's own currency. Read-only.
 */
export default function ExpenseByEmployeeReportView({ startDate = '', endDate = '' }: { startDate?: string; endDate?: string }) {
  const bills = useLedgerStore(state => state.bills);
  const truncated = useLedgerStore(state => state.truncatedCollections);
  const failed = useDataNeedsStore(state => state.failed);
  const workspaceId = useAuthStore(state => state.currentWorkspaceId);
  const isGuest = useAuthStore(state => state.isGuest && !state.user);
  const workspace = useAuthStore(state => state.getCurrentWorkspace());
  const { loading: billsLoading } = useLedgerCollections('bills');
  const [attachmentSnapshot, setAttachmentSnapshot] = useState<{
    workspaceId: string; rows: AttachmentLinkIndexRow[]; loading: boolean; error: Error | null; truncated: boolean; available: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (!workspaceId || isGuest) return () => { active = false; };
    loadAttachmentLinkIndex(workspaceId, ['bills'])
      .then(index => { if (active) setAttachmentSnapshot({ workspaceId, rows: index.rows, loading: false, error: null, truncated: index.truncated, available: true }); })
      .catch(error => { if (active) setAttachmentSnapshot({ workspaceId, rows: [], loading: false, error: error instanceof Error ? error : new Error(String(error)), truncated: false, available: true }); });
    return () => { active = false; };
  }, [workspaceId, isGuest]);

  const currentAttachmentSnapshot = !isGuest && attachmentSnapshot?.workspaceId === (workspaceId || '') ? attachmentSnapshot : null;
  const attachmentLoading = !isGuest && Boolean(workspaceId) && (!currentAttachmentSnapshot || currentAttachmentSnapshot.loading);
  const attachmentIndexComplete = currentAttachmentSnapshot?.available === true && !currentAttachmentSnapshot.loading
    && !currentAttachmentSnapshot.error && !currentAttachmentSnapshot.truncated;
  const scopedBills = useMemo(() => bills.filter(bill => !workspaceId || bill.workspaceId === workspaceId), [bills, workspaceId]);
  const report = useMemo(() => expenseByEmployee({
    bills: scopedBills,
    attachmentLinks: currentAttachmentSnapshot?.rows || [],
    attachmentIndexComplete,
    from: startDate || undefined,
    to: endDate || undefined,
    homeCurrency: workspace?.currency || 'USD',
  }), [scopedBills, currentAttachmentSnapshot?.rows, attachmentIndexComplete, startDate, endDate, workspace?.currency]);

  const loading = billsLoading || attachmentLoading;
  const partial = Boolean(truncated.bills || failed.bills || currentAttachmentSnapshot?.truncated || currentAttachmentSnapshot?.error);

  return <section aria-label="Expense by employee" className="p-4 space-y-4 min-w-0">
    <h2>Expense by employee</h2>
    <p className="text-sm text-[var(--muted)]">
      Expense claims grouped by the employee each claim is owed to: how much was claimed in each currency,
      where the claims stand, and whether receipt evidence is recorded — the Expense Receipt Checklist&apos;s
      own reading (a recorded receipt address or a linked file; the file itself is not inspected and may
      not be a receipt). Amounts stay in each claim bill&apos;s own currency and are never added across
      currencies. Employees with the most missing receipts come first.
    </p>

    {loading && <p role="status">Loading expense claims and linked-file metadata…</p>}
    {partial && <p role="alert">Claim or attachment history is capped or failed to load. Results may be incomplete; a receipt is marked missing only when the linked-file metadata is complete.</p>}

    <div data-print-hide>
      <button type="button" className="min-h-11 px-4 rounded border border-[var(--line)]" disabled={!report.rows.length}
        onClick={() => downloadCsv('expense-by-employee', [...EXPENSE_BY_EMPLOYEE_CSV_HEADERS], expenseByEmployeeCsvRows(report.rows))}>Export CSV</button>
    </div>

    <ReportTableScroll>
      <table className="w-full text-sm">
        <caption>Expense claims by employee{startDate || endDate ? `, ${startDate || 'any date'} to ${endDate || 'any date'}` : ' in the loaded history'}</caption>
        <thead>
          <tr>
            {['Employee', 'Claims', 'Claimed', 'Waiting', 'Approved', 'Rejected', 'Receipts recorded', 'Receipts missing', 'Not checked'].map((head, i) =>
              <th key={head} scope="col" className={`${i < 2 ? 'text-left' : 'text-right'} py-1 px-2`}>{head}</th>)}
          </tr>
        </thead>
        <tbody>
          {report.rows.map(row => (
            <tr key={row.employee} className="border-b border-[var(--line)]/50">
              <th scope="row" className="text-left font-normal py-1 px-2"><bdi>{row.employee}</bdi></th>
              <td className="py-1 px-2 tabular-nums">{row.claims}</td>
              <td className="py-1 px-2 text-right tabular-nums">{row.totals.map(t =>
                <span key={t.currency} className="inline-block ml-2"><bdi>{formatCurrency(t.cents, t.currency)}</bdi></span>)}</td>
              <td className="py-1 px-2 text-right tabular-nums">{row.waiting}</td>
              <td className="py-1 px-2 text-right tabular-nums">{row.approved}</td>
              <td className="py-1 px-2 text-right tabular-nums">{row.rejected}</td>
              <td className="py-1 px-2 text-right tabular-nums">{row.receiptsRecorded}</td>
              <td className="py-1 px-2 text-right tabular-nums">{row.receiptsMissing}</td>
              <td className="py-1 px-2 text-right tabular-nums">{row.receiptsNotChecked}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!report.rows.length && !loading && <p className="text-sm text-[var(--muted)]">No expense claim is recorded in this period.</p>}
    </ReportTableScroll>

    {report.claims.length > 0 && <div className="space-y-2">
      <h3 className="font-semibold">The claims behind these rows</h3>
      <ReportTableScroll>
        <table className="w-full text-sm">
          <caption>Every expense claim in the period with its receipt record</caption>
          <thead>
            <tr>{['Employee', 'Date', 'Claim', 'State', 'Amount', 'Receipt record'].map(head =>
              <th key={head} scope="col" className={`${head === 'Amount' ? 'text-right' : 'text-left'} py-1 px-2`}>{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.claims.map(row => (
              <tr key={row.billId} className="border-b border-[var(--line)]/50">
                <th scope="row" className="text-left font-normal py-1 px-2"><bdi>{row.employeeName}</bdi></th>
                <td className="py-1 px-2">{row.date || '—'}</td>
                <td className="py-1 px-2"><bdi>{row.billNumber}</bdi></td>
                <td className="py-1 px-2">{stateText[row.state] || row.state}</td>
                <td className="py-1 px-2 text-right tabular-nums">{formatCurrency(row.amountCents, row.currency)}</td>
                <td className="py-1 px-2">{evidenceText(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportTableScroll>
    </div>}

    <p className="text-xs text-[var(--muted)]">
      A claim is a bill carrying an expense-claim record; approving it stays on the Expense Claims screen.
      Missing evidence is a review cue, not a decision about the claim.
    </p>
  </section>;
}
