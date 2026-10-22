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
import { belongsTo } from '../../lib/tax/ilVatReturn';
import { registrationKey, type TaxProfiles } from '../../lib/tax/profile';

export class TaxReturnError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

async function load(db: Firestore, table: string, workspaceId: string): Promise<TaxableDocument[]> {
  const snap = await db.collection(table).where('workspaceId', '==', workspaceId).get();
  return snap.docs.map(d => ({ ...(d.data() as DocumentData), id: d.id }) as TaxableDocument);
}

/**
 * CON-4b: the documents of one VAT registration (their seller profile, by the entity label of their first line, PLAN
 * §6), as the Israel month journey counts them; without a registration, every document of the workspace.
 */
export async function computeWorkspaceTaxReturn(db: Firestore, workspaceId: string, startDate: string, endDate: string, scope?: { registration: string; profiles: TaxProfiles; order: string[] }) {
  if (!YMD.test(startDate) || !YMD.test(endDate) || startDate > endDate) throw new TaxReturnError(400, 'Choose a valid period');
  const [invoices, bills, creditNotes, vendorCredits] = (await Promise.all(
    ['invoices', 'bills', 'creditNotes', 'vendorCredits'].map(t => load(db, t, workspaceId))))
    .map(docs => scope ? docs.filter(d => belongsTo(d, scope.profiles, scope.order, scope.registration)) : docs);
  return buildTaxReturn({ invoices, bills, creditNotes, vendorCredits, startDate, endDate });
}

/** Every registration key the workspace's tax profiles hold (the books' and each label's). */
function workspaceRegistrations(profiles: TaxProfiles | undefined): Set<string> {
  const all = [profiles?.books, ...Object.values(profiles?.labels || {})].flatMap(p => p?.registrations || []);
  return new Set(all.map(r => registrationKey(r)));
}

export function taxReturnId(workspaceId: string, startDate: string, endDate: string, registration?: string) {
  return `${workspaceId}_tax_${startDate}_${endDate}${registration ? `_${registration.replace(/[^A-Za-z0-9]/g, '-')}` : ''}`;
}

export async function fileTaxReturn(db: Firestore, input: { workspaceId: string; uid: string; startDate: string; endDate: string; reference?: string; registration?: string }) {
  const workspace = (await db.collection('workspaces').doc(input.workspaceId).get()).data();
  if (!workspace) throw new TaxReturnError(404, 'Workspace not found');
  if (!['owner', 'accountant'].includes(workspaceRole(workspace, input.uid))) throw new TaxReturnError(403, 'Only owners and accountants file tax returns');
  // CON-4b: a return can be filed for one of the workspace's registrations, so with several each is recorded apart
  const profiles = workspace.taxProfiles as TaxProfiles | undefined;
  if (input.registration && !workspaceRegistrations(profiles).has(input.registration)) {
    throw new TaxReturnError(400, `${input.registration} is not one of this workspace's registrations`);
  }
  const ref = db.collection('taxReturns').doc(taxReturnId(input.workspaceId, input.startDate, input.endDate, input.registration));
  if ((await ref.get()).exists) throw new TaxReturnError(409, 'A return for this period was already filed');
  const samePeriod = (await db.collection('taxReturns').where('workspaceId', '==', input.workspaceId).get()).docs
    .map(d => d.data()).filter(r => r.startDate === input.startDate && r.endDate === input.endDate);
  if (samePeriod.some(r => !r.registration) || (!input.registration && samePeriod.length > 0)) {
    throw new TaxReturnError(409, input.registration
      ? 'A return for the whole workspace was already filed for this period'
      : 'Returns for single registrations were already filed for this period; file each registration\'s return apart');
  }
  const worldId = (workspace.dimensions as Array<{ id: string; isWorld?: boolean }> | undefined)?.find(d => d.isWorld)?.id || 'world';
  const computed = await computeWorkspaceTaxReturn(db, input.workspaceId, input.startDate, input.endDate,
    input.registration ? { registration: input.registration, profiles: profiles || {}, order: [worldId] } : undefined);
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
    ...(input.registration ? { registration: input.registration } : {}),
    filedAt: new Date().toISOString(),
    filedBy: input.uid,
  };
  await ref.create(filed);
  await writeServerAuditLog({
    workspaceId: input.workspaceId, uid: input.uid, action: 'TAX_RETURN_FILED', entityType: 'taxReturn', entityId: ref.id,
    details: { description: `Tax return ${input.startDate} to ${input.endDate}${input.registration ? ` for ${input.registration.replace(/^vat:/, '')}` : ''} filed`, boxes: computed.boxes.map(b => [b.key, b.cents]) },
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
