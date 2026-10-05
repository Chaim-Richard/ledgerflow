import type { DocumentData, Firestore, Transaction } from '../db/firestore';
import { FieldValue } from '../db/firestore';
import { TransactionValidator } from '../../kernel/validation/TransactionValidator';
import { resolveAccountRole } from '../../lib/accountUtils';
import { assertPostingOpen, workspaceRole } from '../../lib/periodLock';
import { prepaidAccount, spreadPlan, spreadProblem } from '../../lib/prepaidSchedule';
import { formatCurrency } from '../../lib/utils';
import type { ChartAccount } from '../../types';
import { writeServerAuditLog } from './auditLogService';

/**
 * Prepaid expenses spread over months (K-17). Spreading a bill posts, in one database transaction:
 * on the bill's date, DR Prepaid / CR the expense for the amount; at each month end, DR the expense /
 * CR Prepaid for that month's share (src/lib/prepaidSchedule.ts). The bill's own posting is not
 * touched. The bill records the schedule, so it can't be spread twice; undoing it voids every entry
 * of the schedule, and is refused once one of them is in a closed period. Writers only.
 */

export class PrepaidError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'PrepaidError';
  }
}

const WRITERS = ['owner', 'accountant', 'bookkeeper'];
const NOT_POSTED = new Set(['draft', 'void', 'cancelled', 'rejected']);

interface BillInput { workspaceId: string; uid: string; email?: string; billId: string }

async function prepare(db: Firestore, t: Transaction, input: BillInput) {
  const workspace = (await t.get(db.collection('workspaces').doc(input.workspaceId))).data();
  if (!workspace) throw new PrepaidError(404, 'Workspace not found');
  if (!WRITERS.includes(workspaceRole(workspace, input.uid))) throw new PrepaidError(403, 'Only owners, accountants and bookkeepers spread expenses');
  const ref = db.collection('bills').doc(input.billId);
  const bill = (await t.get(ref)).data();
  if (!bill || bill.workspaceId !== input.workspaceId) throw new PrepaidError(404, 'Bill not found');
  return { workspace, ref, bill };
}

function lockCheck(date: string, workspace: DocumentData, uid: string) {
  try {
    assertPostingOpen(date, workspace, uid);
  } catch (err) {
    throw new PrepaidError(409, err instanceof Error ? err.message : String(err));
  }
}

export async function spreadBillExpense(db: Firestore, input: BillInput & {
  expenseAccountId: string;
  prepaidAccountId?: string;
  amountCents: number;
  months: number;
  startMonth?: string;
}) {
  return db.runTransaction(async (t) => {
    const { workspace, ref, bill } = await prepare(db, t, input);
    if (NOT_POSTED.has(String(bill.status))) throw new PrepaidError(409, `The bill is ${bill.status}; only a posted bill can be spread`);
    if (bill.prepaidSchedule?.id) throw new PrepaidError(409, 'This bill is already spread over months');
    const date = String(bill.date || bill.issueDate || '').slice(0, 10);
    const rate = typeof bill.exchangeRate === 'number' && bill.exchangeRate > 0 ? bill.exchangeRate : 1;
    const billBaseCents = Math.round((Number(bill.amountCents) || 0) * rate);
    const spread = { date, amountCents: input.amountCents, months: input.months, startMonth: input.startMonth || date.slice(0, 7) };
    const problem = spreadProblem(spread, billBaseCents);
    if (problem) throw new PrepaidError(400, problem);

    const accounts = (await t.get(db.collection('chartAccounts').where('workspaceId', '==', input.workspaceId))).docs.map(d => ({ ...d.data(), id: d.id }) as ChartAccount);
    const expense = accounts.find(a => a.id === input.expenseAccountId);
    if (!expense || resolveAccountRole(expense) !== 'expense') throw new PrepaidError(400, 'Choose the expense account to spread');
    const prepaid = input.prepaidAccountId
      ? accounts.find(a => a.id === input.prepaidAccountId && resolveAccountRole(a) === 'asset')
      : prepaidAccount(accounts, workspace.defaultAccountMappings);
    if (!prepaid) throw new PrepaidError(400, 'Choose the Prepaid Expenses account (or add an asset account named "Prepaid Expenses")');

    const plan = spreadPlan(spread);
    for (const d of [date, ...plan.map(p => p.date)]) lockCheck(d, workspace, input.uid);

    const scheduleId = db.collection('transactions').doc().id;
    const label = `bill ${bill.number || input.billId}${bill.vendorName ? ` (${bill.vendorName})` : ''}`;
    const base = { workspaceId: input.workspaceId, uid: input.uid, currency: workspace.currency || 'USD', exchangeRate: 1, status: 'completed', type: 'actual' };
    const context = { workspaceId: input.workspaceId, user: { uid: input.uid }, wsData: workspace };
    const move = (amountCents: number, description: string, toPrepaid: boolean) => [
      { accountId: (toPrepaid ? prepaid : expense).id, accountName: (toPrepaid ? prepaid : expense).name, amountCents, description },
      { accountId: (toPrepaid ? expense : prepaid).id, accountName: (toPrepaid ? expense : prepaid).name, amountCents: -amountCents, description },
    ];
    const entries: DocumentData[] = [];
    try {
      const description = `Prepaid: ${label}, spread over ${input.months} months`;
      entries.push(await TransactionValidator.validateAndPrepare({
        ...base, id: db.collection('transactions').doc().id, date, description, totalAmountCents: input.amountCents,
        // not `billId`: re-posting the bill reverses every entry carrying that, and these are not the bill's own
        metadata: { type: 'prepaid-spread', spreadOfBillId: input.billId, prepaidScheduleId: scheduleId },
        lines: move(input.amountCents, description, true),
      }, context, undefined, t));
      for (const p of plan) {
        const share = `Prepaid ${label}: month ${p.installment} of ${input.months}`;
        entries.push(await TransactionValidator.validateAndPrepare({
          ...base, id: db.collection('transactions').doc().id, date: p.date, description: share, totalAmountCents: p.amountCents,
          // scheduled: dated ahead on purpose (the data check doesn't flag it)
          metadata: { type: 'prepaid-recognition', spreadOfBillId: input.billId, prepaidScheduleId: scheduleId, installment: p.installment, installments: input.months, scheduled: true },
          lines: move(p.amountCents, share, false),
        }, context, undefined, t));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/Period Locked/i.test(message)) throw new PrepaidError(409, message);
      throw err;
    }

    for (const e of entries) t.create(db.collection('transactions').doc(String(e.id)), { ...e, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    const schedule = {
      id: scheduleId, amountCents: input.amountCents, months: input.months, startMonth: spread.startMonth,
      expenseAccountId: expense.id, prepaidAccountId: prepaid.id, transactionIds: entries.map(e => String(e.id)), createdAt: new Date().toISOString(),
    };
    t.update(ref, { prepaidSchedule: schedule, updatedAt: new Date().toISOString() });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'BILL_EXPENSE_SPREAD', entityType: 'bill', entityId: input.billId,
      details: { description: `Spread ${formatCurrency(input.amountCents, workspace.currency || 'USD')} of ${label} over ${input.months} months from ${spread.startMonth}`, scheduleId },
    }, { db, tx: t });
    return { billId: input.billId, schedule, entries: plan };
  });
}

export async function undoBillSpread(db: Firestore, input: BillInput) {
  return db.runTransaction(async (t) => {
    const { workspace, ref, bill } = await prepare(db, t, input);
    const schedule = bill.prepaidSchedule;
    if (!schedule?.id) throw new PrepaidError(409, 'This bill is not spread over months');
    const refs = (schedule.transactionIds as string[] || []).map(id => db.collection('transactions').doc(id));
    const entries = refs.length ? await t.getAll(...refs) : [];
    for (const snap of entries) {
      const e = snap.data();
      if (!e || e.workspaceId !== input.workspaceId || e.metadata?.prepaidScheduleId !== schedule.id || e.status === 'void') continue;
      lockCheck(String(e.date || ''), workspace, input.uid);
    }
    const now = new Date().toISOString();
    for (const snap of entries) {
      const e = snap.data();
      if (!e || e.workspaceId !== input.workspaceId || e.metadata?.prepaidScheduleId !== schedule.id || e.status === 'void') continue;
      t.update(snap.ref, { status: 'void', voidedReason: 'Prepaid spread undone', updatedAt: now });
    }
    t.update(ref, { prepaidSchedule: FieldValue.delete(), updatedAt: now });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'BILL_EXPENSE_SPREAD_UNDONE', entityType: 'bill', entityId: input.billId,
      details: { description: `Undid the spread of bill ${bill.number || input.billId}`, scheduleId: schedule.id },
    }, { db, tx: t });
    return { billId: input.billId, voided: entries.length };
  });
}
