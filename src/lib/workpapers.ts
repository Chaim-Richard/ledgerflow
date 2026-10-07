/**
 * BD-04 workpapers (AI #3, A-6): what one month's close keeps for one account — the balance at
 * month end, a note, files and a "reviewed by … on …" mark, shown on Month-End Close.
 *
 * Read-only on money: the balance is the general ledger's own figure (`computeGeneralLedger` at
 * the month's last day — the running balance the ledger screen shows, in the account's own
 * direction). The note and the review mark are saved on the account document (`workpapers`, one
 * entry per month); the files go through the attachments service with
 * `linkedCollection: 'chartAccounts'` and the month in `linkedLabel`. Nothing is posted and no
 * figure is recalculated here.
 */
import type { AccountWorkpaper, ChartAccount, Transaction } from '../types';
import { computeGeneralLedger } from '../server/reports/computeReports';
import { monthEnd } from './periodLock';

/** A month as the close page names it: YYYY-MM. */
export const WORKPAPER_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Why this month can't have workpapers, or null. */
export function workpaperMonthProblem(month: string): string | null {
  return WORKPAPER_MONTH_RE.test(month) ? null : 'The month needs to be a YYYY-MM month';
}

/** How one month's workpaper is named where its files are listed (the month is in the label). */
export function workpaperLabel(month: string): string {
  return `Workpaper ${month}`;
}

/** One account's workpaper for one month; never undefined. */
export function workpaperOf(account: Pick<ChartAccount, 'workpapers'>, month: string): AccountWorkpaper {
  return (account.workpapers && account.workpapers[month]) || {};
}

/** A workpaper with nothing in it left out (an empty note or review mark is no workpaper). */
function cleanWorkpaper(workpaper: AccountWorkpaper): AccountWorkpaper {
  const next: AccountWorkpaper = {};
  const note = (workpaper.note || '').trim();
  if (note) next.note = note;
  const reviewedBy = (workpaper.reviewedBy || '').trim();
  if (reviewedBy) {
    next.reviewedBy = reviewedBy;
    if (workpaper.reviewedAt) next.reviewedAt = workpaper.reviewedAt;
  }
  return next;
}

/**
 * The account with one month's workpaper set to exactly `workpaper`. Pure: the account passed in
 * is not touched. A workpaper with nothing in it leaves no month entry behind.
 */
export function withWorkpaper(account: ChartAccount, month: string, workpaper: AccountWorkpaper): ChartAccount {
  const cleaned = cleanWorkpaper(workpaper);
  const workpapers = { ...(account.workpapers || {}) };
  if (cleaned.note || cleaned.reviewedBy) workpapers[month] = cleaned;
  else delete workpapers[month];
  return { ...account, workpapers };
}

/** The note of one month's workpaper (kept: the review mark stays). */
export function setWorkpaperNote(account: ChartAccount, month: string, note: string): ChartAccount {
  return withWorkpaper(account, month, { ...workpaperOf(account, month), note });
}

/** The review mark of one month's workpaper ("reviewed by … on …"; kept: the note stays). */
export function markWorkpaperReviewed(account: ChartAccount, month: string, reviewedBy: string, reviewedAt = new Date().toISOString()): ChartAccount {
  return withWorkpaper(account, month, { ...workpaperOf(account, month), reviewedBy, reviewedAt });
}

/** The review mark taken off one month's workpaper. */
export function clearWorkpaperReview(account: ChartAccount, month: string): ChartAccount {
  const current = workpaperOf(account, month);
  const next: AccountWorkpaper = {};
  if (current.note) next.note = current.note;
  return withWorkpaper(account, month, next);
}

export interface WorkpaperRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  /** The balance at the month's last day, in the account's own direction, as in the general ledger. */
  balanceCents: number;
  note: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface WorkpapersResult {
  month: string;
  /** The month's last day, YYYY-MM-DD. */
  endDate: string;
  rows: WorkpaperRow[];
  /** Rows that carry a review mark. */
  reviewedCount: number;
}

/**
 * The workpapers of one month: every account with a balance at its end, plus every account that
 * already keeps a note or a review mark for the month (so a workpaper never disappears under a
 * zero balance). Sorted by account code. Read-only: the balances are the ledger's own figures.
 */
export function buildWorkpapers({ accounts, transactions, month }: { accounts: ChartAccount[]; transactions: Transaction[]; month: string }): WorkpapersResult {
  const endDate = monthEnd(month);
  const ledger = computeGeneralLedger(accounts, transactions, undefined, endDate);
  const byId = new Map(accounts.map(a => [a.id, a]));
  const rows: WorkpaperRow[] = [];
  for (const acc of ledger.accounts) {
    const account = byId.get(acc.accountId);
    if (!account) continue;
    const workpaper = workpaperOf(account, month);
    if (!acc.endingBalanceCents && !workpaper.note && !workpaper.reviewedBy) continue;
    const row: WorkpaperRow = {
      accountId: acc.accountId,
      code: acc.accountCode,
      name: acc.accountName,
      type: acc.type,
      balanceCents: acc.endingBalanceCents,
      note: workpaper.note || '',
    };
    if (workpaper.reviewedBy) row.reviewedBy = workpaper.reviewedBy;
    if (workpaper.reviewedAt) row.reviewedAt = workpaper.reviewedAt;
    rows.push(row);
  }
  rows.sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name));
  return { month, endDate, rows, reviewedCount: rows.filter(r => r.reviewedBy).length };
}
