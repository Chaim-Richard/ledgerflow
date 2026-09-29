/**
 * Filing a tax return (T-07): the server computes the return for the period from the saved
 * documents (src/lib/taxReturnDocs.ts) and keeps a copy that never changes, with who filed it and
 * when. Later edits to documents in that period show up as differences against the copy (the
 * screen recomputes and compares). One filed return per period.
 */
import type { DocumentData, Firestore } from '../db/firestore';
import { buildTaxReturn } from '../../lib/taxReturnDocs';
import type { TaxableDocument } from '../../lib/taxReturnDocs';
import { writeServerAuditLog } from './auditLogService';
import { workspaceRole } from '../../lib/periodLock';

export class TaxReturnError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

async function load(db: Firestore, table: string, workspaceId: string): Promise<TaxableDocument[]> {
  const snap = await db.collection(table).where('workspaceId', '==', workspaceId).get();
  return snap.docs.map(d => ({ ...(d.data() as DocumentData), id: d.id }) as TaxableDocument);
}

export async function computeWorkspaceTaxReturn(db: Firestore, workspaceId: string, startDate: string, endDate: string) {
  if (!YMD.test(startDate) || !YMD.test(endDate) || startDate > endDate) throw new TaxReturnError(400, 'Choose a valid period');
  const [invoices, bills, creditNotes, vendorCredits] = await Promise.all(
    ['invoices', 'bills', 'creditNotes', 'vendorCredits'].map(t => load(db, t, workspaceId)));
  return buildTaxReturn({ invoices, bills, creditNotes, vendorCredits, startDate, endDate });
}

export function taxReturnId(workspaceId: string, startDate: string, endDate: string) {
  return `${workspaceId}_tax_${startDate}_${endDate}`;
}

export async function fileTaxReturn(db: Firestore, input: { workspaceId: string; uid: string; startDate: string; endDate: string; reference?: string }) {
  const workspace = (await db.collection('workspaces').doc(input.workspaceId).get()).data();
  if (!workspace) throw new TaxReturnError(404, 'Workspace not found');
  if (!['owner', 'accountant'].includes(workspaceRole(workspace, input.uid))) throw new TaxReturnError(403, 'Only owners and accountants file tax returns');
  const ref = db.collection('taxReturns').doc(taxReturnId(input.workspaceId, input.startDate, input.endDate));
  if ((await ref.get()).exists) throw new TaxReturnError(409, 'A return for this period was already filed');
  const computed = await computeWorkspaceTaxReturn(db, input.workspaceId, input.startDate, input.endDate);
  const filed = {
    workspaceId: input.workspaceId,
    startDate: input.startDate,
    endDate: input.endDate,
    currency: String(workspace.currency || 'USD'),
    boxes: computed.boxes,
    sales: computed.sales,
    purchases: computed.purchases,
    documentCount: computed.documentCount,
    reference: (input.reference || '').slice(0, 100),
    filedAt: new Date().toISOString(),
    filedBy: input.uid,
  };
  await ref.create(filed);
  await writeServerAuditLog({
    workspaceId: input.workspaceId, uid: input.uid, action: 'TAX_RETURN_FILED', entityType: 'taxReturn', entityId: ref.id,
    details: { description: `Tax return ${input.startDate} to ${input.endDate} filed`, boxes: computed.boxes.map(b => [b.key, b.cents]) },
  }, { db });
  return { id: ref.id, ...filed };
}

export type FiledTaxReturn = Awaited<ReturnType<typeof fileTaxReturn>>;

export async function listTaxReturns(db: Firestore, workspaceId: string): Promise<FiledTaxReturn[]> {
  const snap = await db.collection('taxReturns').where('workspaceId', '==', workspaceId).get();
  return snap.docs
    .map(d => ({ ...(d.data() as Omit<FiledTaxReturn, 'id'>), id: d.id }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
