/**
 * Needs attention (DA-02): one queue, the daily starting point. Each row says how many, why it is
 * there, who can resolve it, and opens the exact place. A row is there only while its cause is: it
 * is worked out each time from the books (bank lines, approvals, Data Health findings, the close),
 * so it can't be dismissed away and comes back if the cause does. Nothing here changes anything.
 */
import type { PinnedPage } from './pinnedPages';
import type { CheckFinding } from './dataChecks';
import { approvalStatus } from './invoiceApproval';
import { monthCloseState, type PeriodLockSettings } from './periodLock';

export interface AttentionRow {
  id: string;
  count: number;
  /** "3 bank lines to review" */
  text: string;
  why: string;
  /** who can resolve it */
  who: string;
  page: PinnedPage;
}

const BOOKKEEPING = 'owners, accountants and bookkeepers';
const APPROVERS = 'owners and accountants';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function needsAttention(input: {
  today: string;
  workspace: (PeriodLockSettings & { invoiceApproval?: unknown }) | null | undefined;
  bankLines?: Array<{ status?: string }>;
  invoices?: Array<Parameters<typeof approvalStatus>[0] & { status?: string }>;
  findings?: CheckFinding[];
  /** the day of the month from which last month should be closed (default the 10th) */
  closeByDay?: number;
  /** questions about entries (BD-07) */
  questions?: Array<{ status?: string }>;
  /** pay runs (U-10) and purchase orders (K-23), for the ones waiting for approval */
  payRuns?: Array<{ status?: string }>;
  purchaseOrders?: Array<{ status?: string }>;
  /** bank connections (Plaid), for the ones whose login expired */
  banks?: Array<{ status?: string; institutionName?: string }>;
}): AttentionRow[] {
  const rows: AttentionRow[] = [];
  const add = (row: AttentionRow) => { if (row.count > 0) rows.push(row); };
  const findings = input.findings || [];
  const count = (checkId: string) => findings.filter(f => f.checkId === checkId).length;

  const pending = (input.bankLines || []).filter(l => l.status === 'pending').length;
  add({ id: 'bank-lines', count: pending, text: plural(pending, 'bank line to review', 'bank lines to review'), why: 'They came from the bank and are not matched to an entry yet.', who: BOOKKEEPING, page: { tab: 'reconciliation' } });

  const settings = input.workspace?.invoiceApproval;
  const expired = (input.banks || []).filter(b => b.status === 'login_required');
  add({ id: 'bank-login', count: expired.length, text: expired.length === 1 ? `${expired[0].institutionName || 'A bank'} needs you to log in again` : `${expired.length} bank connections need you to log in again`, why: 'The bank stopped sending lines until someone logs in to it again; nothing new arrives meanwhile.', who: BOOKKEEPING, page: { tab: 'banking' } });

  const awaiting = (input.invoices || []).filter(inv => approvalStatus(inv, settings) === 'awaiting').length;
  add({ id: 'approvals', count: awaiting, text: plural(awaiting, 'invoice waiting for approval', 'invoices waiting for approval'), why: 'They are over the approval limit and can’t be sent until someone signs them off.', who: APPROVERS, page: { tab: 'sales' } });

  const runs = (input.payRuns || []).filter(r => r.status === 'awaiting_approval').length;
  add({ id: 'pay-runs', count: runs, text: plural(runs, 'pay run waiting for approval', 'pay runs waiting for approval'), why: 'Nobody is paid and nothing is posted until an owner approves it or sends it back.', who: 'owners', page: { tab: 'payroll' } });

  const orders = (input.purchaseOrders || []).filter(o => o.status === 'pending_approval').length;
  add({ id: 'purchase-orders', count: orders, text: plural(orders, 'purchase order waiting for approval', 'purchase orders waiting for approval'), why: 'A bookkeeper asked to order; nothing is received or billed against it until it is approved or declined.', who: APPROVERS, page: { tab: 'purchase-orders' } });

  // serious findings other than the ones with a row of their own
  const own = new Set(['missing-label', 'duplicate-bill']);
  const serious = findings.filter(f => f.severity === 'high' && !own.has(f.checkId)).length;
  add({ id: 'serious', count: serious, text: plural(serious, 'serious problem in the books', 'serious problems in the books'), why: 'Data Health found something that makes a report wrong (an entry that doesn’t balance, an account that is missing…).', who: BOOKKEEPING, page: { tab: 'data-health' } });

  const labels = count('missing-label');
  add({ id: 'missing-label', count: labels, text: plural(labels, 'entry missing a required label', 'entries missing a required label'), why: 'The workspace requires a label on these accounts, and these entries have none.', who: BOOKKEEPING, page: { tab: 'data-health' } });

  const duplicates = count('duplicate-bill');
  add({ id: 'duplicate-bill', count: duplicates, text: plural(duplicates, 'possible duplicate bill', 'possible duplicate bills'), why: 'The same bill number from the same vendor is entered more than once; paying both would pay twice.', who: BOOKKEEPING, page: { tab: 'data-health' } });

  const asked = (input.questions || []).filter(q => q.status === 'open').length;
  add({ id: 'questions', count: asked, text: plural(asked, 'question about an entry waiting for an answer', 'questions about entries waiting for an answer'), why: 'Someone asked what an entry was; it stays unclear in the books until it is answered.', who: 'the owner', page: { tab: 'client-queries' } });
  const answered = (input.questions || []).filter(q => q.status === 'answered').length;
  add({ id: 'answers', count: answered, text: plural(answered, 'answer to read', 'answers to read'), why: 'The owner answered a question; read it, fix the entry if needed, and close the question.', who: BOOKKEEPING, page: { tab: 'client-queries' } });

  // last month should be closed from the workspace's reminder day (Settings → Alerts), else the 10th, on
  const [y, m, d] = input.today.split('-').map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  if (d >= (input.closeByDay || 10) && monthCloseState(lastMonth, input.workspace) === 'open') {
    const name = `${MONTHS[Number(lastMonth.slice(5)) - 1]} ${lastMonth.slice(0, 4)}`;
    add({ id: 'close', count: 1, text: `${name} is not closed`, why: 'Until it is closed, entries can still be dated in it and its reports can change.', who: APPROVERS, page: { tab: 'month-end-close' } });
  }
  return rows;
}
