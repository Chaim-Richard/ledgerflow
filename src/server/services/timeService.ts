import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { RATES_KIND, ratesProblem, TIME_KIND, timeProblem, type TimeEntry, type TimeInput, type TimeRates, type TimeStatus } from '../../lib/timeEntries';
import { writeServerAuditLog } from './auditLogService';
import { notify } from './notificationService';

/**
 * Time tracking (V-01, V-03..V-06, src/lib/timeEntries.ts). Everyone in the workspace logs their own
 * time; owners and accountants see everyone's, log for others, keep the rates and approve or send
 * back what was submitted. An entry can be changed by its person while not submitted, and by an
 * approver until it is invoiced. Owners, accountants and bookkeepers mark approved time invoiced.
 */
export class TimeError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const APPROVERS = ['owner', 'accountant'];
const BILLERS = ['owner', 'accountant', 'bookkeeper'];
interface Actor { workspaceId: string; uid: string; email?: string }

async function roleOf(db: Firestore, input: Actor) {
  const ws = (await db.collection('workspaces').doc(input.workspaceId).get()).data();
  if (!ws) throw new TimeError(404, 'Workspace not found');
  const member = ws.uid === input.uid || (Array.isArray(ws.members) && ws.members.includes(input.uid));
  if (!member) throw new TimeError(403, 'Only people in this workspace log time here');
  const people = [...new Set([...(Array.isArray(ws.members) ? ws.members.map(String) : []), String(ws.uid)])];
  return { role: workspaceRole(ws as never, input.uid), people };
}

const ratesRef = (db: Firestore, workspaceId: string) => db.collection('documents').doc(`${workspaceId}_timeRates`);

export async function listTime(db: Firestore, input: Actor) {
  const { role } = await roleOf(db, input);
  const all = APPROVERS.includes(role);
  const { rows } = await db.pool.query<{ id: string; data: Omit<TimeEntry, 'id'> }>(
    `select id, data from public.documents where workspace_id = $1 and data->>'kind' = $2 ${all ? '' : `and data->>'person' = $3`} order by data->>'date' desc limit 5000`,
    all ? [input.workspaceId, TIME_KIND] : [input.workspaceId, TIME_KIND, input.uid]);
  const rates = all ? ((await ratesRef(db, input.workspaceId).get()).data()?.rates as TimeRates | undefined) || {} : undefined;
  return { entries: rows.map(r => ({ ...r.data, id: r.id })), ...(rates ? { rates } : {}), canApprove: all };
}

const fieldsOf = (input: TimeInput) => ({
  date: String(input.date), minutes: Number(input.minutes), description: String(input.description).trim(), billable: input.billable === true,
  ...(input.customerId ? { customerId: String(input.customerId) } : {}),
  ...(input.projectId ? { projectId: String(input.projectId) } : {}),
  ...(input.rateCents !== undefined ? { rateCents: Number(input.rateCents) } : {}),
});

export async function logTime(db: Firestore, input: Actor & { entry: TimeInput & { person?: unknown } }) {
  const problem = timeProblem(input.entry);
  if (problem) throw new TimeError(400, problem);
  const { role, people } = await roleOf(db, input);
  const person = typeof input.entry.person === 'string' && input.entry.person ? input.entry.person : input.uid;
  if (person !== input.uid && !APPROVERS.includes(role)) throw new TimeError(403, 'Only owners and accountants log time for someone else');
  if (!people.includes(person)) throw new TimeError(400, 'That person is not in this workspace');
  const ref = db.collection('documents').doc();
  const entry: Omit<TimeEntry, 'id'> = { kind: TIME_KIND, workspaceId: input.workspaceId, person, ...fieldsOf(input.entry), status: 'open', createdAt: new Date().toISOString() };
  await ref.set(entry);
  return { ...entry, id: ref.id };
}

async function entryFor(db: Firestore, input: Actor & { entryId: string }) {
  const { role } = await roleOf(db, input);
  const ref = db.collection('documents').doc(input.entryId);
  const entry = (await ref.get()).data() as Omit<TimeEntry, 'id'> | undefined;
  if (!entry || entry.kind !== TIME_KIND || entry.workspaceId !== input.workspaceId) throw new TimeError(404, 'That time entry is not in this workspace');
  return { ref, entry, approver: APPROVERS.includes(role), own: entry.person === input.uid, role };
}

const mayEdit = (e: { entry: Omit<TimeEntry, 'id'>; approver: boolean; own: boolean }) => e.entry.status !== 'invoiced' && !e.entry.paidRunId && (e.approver || (e.own && e.entry.status === 'open'));

export async function changeTime(db: Firestore, input: Actor & { entryId: string; entry: TimeInput }) {
  const found = await entryFor(db, input);
  if (!mayEdit(found)) throw new TimeError(found.entry.status === 'invoiced' ? 409 : 403, found.entry.status === 'invoiced' ? 'This time is on an invoice already' : 'Submitted time is changed by an owner or accountant, or sent back first');
  const merged = { ...found.entry, ...input.entry };
  const problem = timeProblem(merged);
  if (problem) throw new TimeError(400, problem);
  const fields = fieldsOf(merged);
  await found.ref.set({ ...found.entry, ...fields, ...(input.entry.customerId === '' ? { customerId: undefined } : {}), ...(input.entry.projectId === '' ? { projectId: undefined } : {}) });
  return { ...found.entry, ...fields, id: input.entryId };
}

export async function removeTime(db: Firestore, input: Actor & { entryId: string }) {
  const found = await entryFor(db, input);
  if (!mayEdit(found)) throw new TimeError(403, 'This time can no longer be removed');
  await found.ref.delete();
}

/** submit / withdraw (the person), approve / send back (owners and accountants). */
export async function moveTime(db: Firestore, input: Actor & { entryIds: string[]; to: unknown; note?: unknown }) {
  if (!['submitted', 'open', 'approved'].includes(String(input.to))) throw new TimeError(400, 'Submit, approve or send back');
  if (!Array.isArray(input.entryIds) || input.entryIds.length === 0 || input.entryIds.length > 500) throw new TimeError(400, 'Choose the time entries');
  const to = input.to as TimeStatus;
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 300) : '';
  const done: TimeEntry[] = [];
  const people = new Set<string>();
  for (const entryId of input.entryIds) {
    const found = await entryFor(db, { ...input, entryId: String(entryId) });
    const from = found.entry.status;
    const ok = (to === 'submitted' && found.own && from === 'open')
      || (to === 'open' && found.own && from === 'submitted')
      || (to === 'approved' && found.approver && from === 'submitted')
      || (to === 'open' && found.approver && (from === 'submitted' || from === 'approved'));
    if (!ok) throw new TimeError(found.approver || found.own ? 409 : 403, `A ${found.entry.date} entry is ${from}: it cannot be made ${to === 'open' ? 'open again' : to}`);
    if (found.entry.paidRunId) throw new TimeError(409, `The ${found.entry.date} entry was paid in a pay run: undo that run first`);
    const next = { ...found.entry, status: to, ...(to === 'approved' ? { approvedBy: input.uid, approvedAt: new Date().toISOString() } : {}), ...(to === 'open' && !found.own && note ? { note } : {}) };
    await found.ref.set(next);
    done.push({ ...next, id: String(entryId) });
    if (!found.own) people.add(found.entry.person);
  }
  await writeServerAuditLog({
    workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: to === 'approved' ? 'TIME_APPROVED' : to === 'submitted' ? 'TIME_SUBMITTED' : 'TIME_SENT_BACK', entityType: 'documents', entityId: String(input.entryIds[0]),
    details: { description: `${done.length} time ${done.length === 1 ? 'entry' : 'entries'} ${to === 'approved' ? 'approved' : to === 'submitted' ? 'submitted' : 'opened again'}`, entries: input.entryIds.length },
  }, { db });
  if (to !== 'submitted' && people.size) {
    await notify(db, {
      workspaceId: input.workspaceId, kind: 'time.decided', title: to === 'approved' ? 'Your time was approved' : 'Your time was sent back',
      message: `${done.length} ${done.length === 1 ? 'entry' : 'entries'}${note ? `: ${note}` : ''}`, eventKey: `time:${to}:${input.entryIds.join(',').slice(0, 200)}:${Date.now()}`,
      actorUid: input.uid, onlyUids: [...people],
    });
  }
  return done;
}

/** V-06: approved billable time put on an invoice is marked so, and locked. */
export async function markInvoiced(db: Firestore, input: Actor & { entryIds: unknown; invoiceId: unknown }) {
  const { role } = await roleOf(db, input);
  if (!BILLERS.includes(role)) throw new TimeError(403, 'Only owners, accountants and bookkeepers invoice time');
  if (!Array.isArray(input.entryIds) || input.entryIds.length === 0 || input.entryIds.length > 500 || typeof input.invoiceId !== 'string') throw new TimeError(400, 'Choose the time and the invoice');
  const invoice = (await db.collection('invoices').doc(input.invoiceId).get()).data();
  if (!invoice || invoice.workspaceId !== input.workspaceId) throw new TimeError(404, 'That invoice is not in this workspace');
  for (const entryId of input.entryIds) {
    const found = await entryFor(db, { ...input, entryId: String(entryId) });
    if (found.entry.status !== 'approved' || !found.entry.billable || found.entry.invoiceId) throw new TimeError(409, `The ${found.entry.date} entry is not approved billable time waiting for an invoice`);
    await found.ref.set({ ...found.entry, status: 'invoiced', invoiceId: input.invoiceId });
  }
  return { invoiced: input.entryIds.length };
}

export async function setRates(db: Firestore, input: Actor & { rates: unknown }) {
  const problem = ratesProblem(input.rates);
  if (problem) throw new TimeError(400, problem);
  const { role } = await roleOf(db, input);
  if (!APPROVERS.includes(role)) throw new TimeError(403, 'Only owners and accountants keep the rates');
  const rates = input.rates as TimeRates;
  await ratesRef(db, input.workspaceId).set({ kind: RATES_KIND, workspaceId: input.workspaceId, rates, updatedAt: new Date().toISOString() });
  await writeServerAuditLog({ workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'TIME_RATES_SET', entityType: 'documents', entityId: `${input.workspaceId}_timeRates`, details: { description: 'Hourly rates changed' } }, { db });
  return { rates };
}
