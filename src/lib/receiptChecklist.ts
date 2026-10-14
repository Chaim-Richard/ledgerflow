/**
 * A-133: a review list for expense-claim receipts. Expense claims are bills carrying
 * `metadata.expenseClaim`; a linked file or the legacy `receiptUrl` is only recorded evidence,
 * not proof that a receipt is present or readable. This helper never approves, changes or posts.
 */
import type { Bill } from '../types';
import { claimOf } from './expenseClaims';
import { validCustomReportPeriod } from './reportCustomPeriod';

export interface ReceiptAttachmentLink {
  id: string;
  linkedId?: string;
  linkedCollection?: string;
}

export type ReceiptEvidenceStatus = 'recorded' | 'missing' | 'not-checked';

export interface ReceiptChecklistRow {
  billId: string;
  billNumber: string;
  employeeName: string;
  submittedBy: string;
  date: string;
  state: string;
  currency: string;
  amountCents: number;
  receiptUrlRecorded: boolean;
  attachmentCount: number;
  evidenceStatus: ReceiptEvidenceStatus;
}

export interface ReceiptChecklistSummary {
  rows: ReceiptChecklistRow[];
  missingByEmployee: Array<{ employeeName: string; claims: number }>;
  missingClaims: number;
  notCheckedClaims: number;
}

export interface ReceiptChecklistInput {
  bills: readonly Bill[];
  attachmentLinks: readonly ReceiptAttachmentLink[];
  /** False when attachment metadata has not loaded, failed, or hit its cap. */
  attachmentIndexComplete: boolean;
  from?: string;
  to?: string;
  homeCurrency?: string;
}

function periodIsValid(from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const start = from || to || '';
  const end = to || from || '';
  return validCustomReportPeriod({ startDate: start, endDate: end });
}

/** Expense claims that have no recorded receipt link or bill attachment, grouped by payee/employee. */
export function receiptChecklist(input: ReceiptChecklistInput): ReceiptChecklistSummary {
  const { bills, attachmentLinks, attachmentIndexComplete, from, to } = input;
  if (!periodIsValid(from, to)) return { rows: [], missingByEmployee: [], missingClaims: 0, notCheckedClaims: 0 };

  const attachmentIdsByBill = new Map<string, Set<string>>();
  for (const attachment of attachmentLinks) {
    if (attachment.linkedCollection !== 'bills' || !attachment.linkedId) continue;
    const ids = attachmentIdsByBill.get(attachment.linkedId) || new Set<string>();
    ids.add(attachment.id);
    attachmentIdsByBill.set(attachment.linkedId, ids);
  }

  const rows = bills.flatMap((bill): ReceiptChecklistRow[] => {
    const claim = claimOf(bill as never);
    if (!claim) return [];
    const date = String(bill.date || '').slice(0, 10);
    if (from && (!date || date < from)) return [];
    if (to && (!date || date > to)) return [];

    const receiptUrlRecorded = typeof bill.receiptUrl === 'string' && bill.receiptUrl.trim().length > 0;
    const attachmentCount = attachmentIdsByBill.get(bill.id)?.size || 0;
    const hasEvidence = receiptUrlRecorded || attachmentCount > 0;
    const evidenceStatus: ReceiptEvidenceStatus = hasEvidence ? 'recorded' : attachmentIndexComplete ? 'missing' : 'not-checked';

    return [{
      billId: bill.id,
      billNumber: bill.number || bill.id,
      employeeName: bill.vendorName?.trim() || claim.submittedByName?.trim() || 'Unknown employee',
      submittedBy: claim.submittedByName?.trim() || '',
      date,
      state: claim.state,
      currency: bill.currency || input.homeCurrency || 'USD',
      amountCents: Number.isFinite(bill.amountCents) ? bill.amountCents : 0,
      receiptUrlRecorded,
      attachmentCount,
      evidenceStatus,
    }];
  }).sort((a, b) => a.employeeName.localeCompare(b.employeeName) || b.date.localeCompare(a.date) || a.billId.localeCompare(b.billId));

  const missing = new Map<string, number>();
  let notCheckedClaims = 0;
  for (const row of rows) {
    if (row.evidenceStatus === 'missing') missing.set(row.employeeName, (missing.get(row.employeeName) || 0) + 1);
    if (row.evidenceStatus === 'not-checked') notCheckedClaims++;
  }

  return {
    rows,
    missingByEmployee: [...missing.entries()].map(([employeeName, claims]) => ({ employeeName, claims }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    missingClaims: rows.filter(row => row.evidenceStatus === 'missing').length,
    notCheckedClaims,
  };
}

export const RECEIPT_CHECKLIST_CSV_HEADERS = [
  'Employee', 'Submitted by', 'Claim date', 'Claim', 'Claim state', 'Currency', 'Amount (minor units)',
  'Receipt URL recorded', 'Linked files', 'Receipt evidence status',
];

export function receiptChecklistCsvRows(rows: readonly ReceiptChecklistRow[]): Array<Array<string | number>> {
  return rows.map(row => [
    row.employeeName, row.submittedBy, row.date, row.billNumber, row.state, row.currency, row.amountCents,
    row.receiptUrlRecorded ? 'Yes' : 'No', row.attachmentCount, row.evidenceStatus,
  ]);
}
