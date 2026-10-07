import type { Firestore } from '../db/firestore';
import { FieldValue } from '../db/firestore';
import { TransactionValidator } from '../../kernel/validation/TransactionValidator';
import { lockMessage, postingLock, workspaceRole } from '../../lib/periodLock';
import { payRunLines, payRunTotals, type PayRunAccounts } from '../../lib/payRunPosting';
import { isCashAccount } from '../../lib/txFilters';
import { formatCurrency, formatTzDate } from '../../lib/utils';
import { addDaysYMD } from '../../lib/fiscalCalendar';
import type { ChartAccount, Employee } from '../../types';
import { writeServerAuditLog } from './auditLogService';

/**
 * Pay runs (U-02), for owners and accountants: the server works out every active employee's pay for
 * one period (src/lib/payRunPosting.ts), posts one balanced entry on the pay date and keeps the run
 * with its per-employee amounts, in one database transaction with an audit line. A second run on the
 * same date is refused unless asked for; undo voids the entry while the date is open. Before, the
 * Payroll screen only changed what was on the screen: nothing was saved.
 */
export class PayRunError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const ROLES = ['owner', 'accountant'];
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

interface Actor { workspaceId: string; uid: string; email?: string }
export interface PostPayRunInput extends Actor {
  date: string;
  bankAccountId: string;
  wagesAccountId: string;
  taxExpenseAccountId: string;
  liabilitiesAccountId: string;
  /** a second run on the same date (for example a bonus run) */
  again?: boolean;
}

export async function postPayRun(db: Firestore, input: PostPayRunInput) {
  if (!DAY.test(input.date)) throw new PayRunError(400, 'Choose the pay date');
  return db.runTransaction(async t => {
    const workspace = (await t.get(db.collection('workspaces').doc(input.workspaceId))).data();
    if (!workspace) throw new PayRunError(404, 'Workspace not found');
    if (!ROLES.includes(workspaceRole(workspace, input.uid))) throw new PayRunError(403, 'Only owners and accountants run payroll');
    const accounts = (await t.get(db.collection('chartAccounts').where('workspaceId', '==', input.workspaceId))).docs.map(d => ({ ...d.data(), id: d.id }) as ChartAccount);
    const byId = new Map(accounts.filter(a => !a.isArchived).map(a => [a.id, a]));
    const pick = (id: string, what: string, ok: (a: ChartAccount) => boolean) => {
      const account = byId.get(id);
      if (!account || !ok(account)) throw new PayRunError(400, `Choose ${what}`);
      return { id: account.id, name: account.name };
    };
    const type = (a: ChartAccount) => String(a.type).toLowerCase();
    const chosen: PayRunAccounts = {
      bank: pick(input.bankAccountId, 'the bank account the pay goes out of', a => type(a) === 'asset' && isCashAccount(a)),
      wages: pick(input.wagesAccountId, 'the wages expense account', a => ['expense', 'cost_of_goods'].includes(type(a))),
      taxExpense: pick(input.taxExpenseAccountId, 'the payroll tax expense account', a => ['expense', 'cost_of_goods'].includes(type(a))),
      liabilities: pick(input.liabilitiesAccountId, 'the payroll liabilities account', a => type(a) === 'liability'),
    };
    const employees = (await t.get(db.collection('employees').where('workspaceId', '==', input.workspaceId))).docs.map(d => ({ ...d.data(), id: d.id }) as Employee);
    const totals = payRunTotals(employees, Number(input.date.slice(0, 4)));
    if (totals.employees.length === 0) throw new PayRunError(400, 'There is nobody on the payroll');
    const sameDay = (await t.get(db.collection('payRuns').where('workspaceId', '==', input.workspaceId).where('date', '==', input.date))).docs
      .filter(d => d.data().status === 'processed');
    if (sameDay.length && !input.again) throw new PayRunError(409, `A pay run on ${input.date} is already posted; post another only if it is meant (for example a bonus run)`);
    const today = formatTzDate(new Date(), typeof workspace.timezone === 'string' ? workspace.timezone : 'UTC');
    if (input.date > addDaysYMD(today, 31)) throw new PayRunError(400, 'The pay date is more than a month away');

    const lines = payRunLines(totals, chosen);
    const currency = String(workspace.currency || 'USD');
    const description = `Payroll ${input.date}: ${totals.employees.length} employee${totals.employees.length === 1 ? '' : 's'}`;
    const runRef = db.collection('payRuns').doc();
    let ledgerTx;
    try {
      ledgerTx = await TransactionValidator.validateAndPrepare({
        id: db.collection('transactions').doc().id,
        workspaceId: input.workspaceId, uid: input.uid, date: input.date, description,
        totalAmountCents: totals.costCents, currency, exchangeRate: 1, status: 'completed', type: 'journal',
        metadata: { type: 'pay-run', payRunId: runRef.id },
        lines: lines.map(l => ({ accountId: l.accountId, accountName: l.accountName, amountCents: l.amountCents, description: l.description })),
      }, { workspaceId: input.workspaceId, user: { uid: input.uid }, wsData: workspace }, undefined, t);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/Period Locked/i.test(message)) throw new PayRunError(409, message);
      throw err;
    }
    const now = new Date().toISOString();
    t.create(db.collection('transactions').doc(ledgerTx.id), { ...ledgerTx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    t.set(runRef, {
      workspaceId: input.workspaceId, uid: input.uid, date: input.date, status: 'processed', createdAt: now,
      totalAmountCents: totals.costCents, employeeCount: totals.employees.length, transactionId: ledgerTx.id,
      grossCents: totals.grossCents, netCents: totals.netCents, withheldCents: totals.withheldCents,
      employerTaxCents: totals.employerTaxCents, deductionsCents: totals.deductionsCents, employees: totals.employees,
    });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'PAY_RUN_POSTED', entityType: 'payRuns', entityId: runRef.id,
      details: { description: `${description}; gross ${formatCurrency(totals.grossCents, currency)}, net ${formatCurrency(totals.netCents, currency)}, cost ${formatCurrency(totals.costCents, currency)}`, transactionId: ledgerTx.id },
    }, { db, tx: t });
    return { payRunId: runRef.id, transactionId: ledgerTx.id, ...totals };
  });
}

/** Undo a pay run: its entry is voided and the run marked undone, while the date is open. */
export async function undoPayRun(db: Firestore, input: Actor & { payRunId: string }) {
  return db.runTransaction(async t => {
    const workspace = (await t.get(db.collection('workspaces').doc(input.workspaceId))).data();
    if (!workspace) throw new PayRunError(404, 'Workspace not found');
    if (!ROLES.includes(workspaceRole(workspace, input.uid))) throw new PayRunError(403, 'Only owners and accountants run payroll');
    const runRef = db.collection('payRuns').doc(input.payRunId);
    const run = (await t.get(runRef)).data();
    if (!run || run.workspaceId !== input.workspaceId) throw new PayRunError(404, 'That pay run is not in this workspace');
    if (run.status !== 'processed' || !run.transactionId) throw new PayRunError(409, 'This pay run is not posted');
    const lock = postingLock(String(run.date), workspace as never, input.uid);
    if (lock) throw new PayRunError(409, lockMessage(String(run.date), lock));
    const now = new Date().toISOString();
    t.update(db.collection('transactions').doc(String(run.transactionId)), { status: 'void', voidedReason: 'Pay run undone', voidedAt: now, updatedAt: now });
    t.update(runRef, { status: 'undone', undoneAt: now });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'PAY_RUN_UNDONE', entityType: 'payRuns', entityId: input.payRunId,
      details: { description: `Undid the pay run of ${String(run.date)}; its entry is void`, transactionId: run.transactionId },
    }, { db, tx: t });
    return { payRunId: input.payRunId };
  });
}
