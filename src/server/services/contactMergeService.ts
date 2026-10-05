import type { DocumentData, Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { cleanContacts, MAX_NOTES, parseTags, type ContactNote, type ContactPerson } from '../../lib/contacts';
import { writeServerAuditLog } from './auditLogService';

/**
 * Merge duplicate contacts (Y-23 BA-01). Everything that points at the duplicate moves to the
 * contact that is kept: documents, payments, schedules and the contact references on ledger
 * entries. No amount changes. The kept contact keeps its own details and takes the duplicate's
 * where its own are empty; people, tags and notes are combined. The duplicate is deleted. One
 * database transaction, in the audit log. Owners and accountants only.
 */

export class ContactMergeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ContactMergeError';
  }
}

export type PartySide = 'customer' | 'vendor';

interface Reference { collection: string; path: string[]; name?: string }

const SIDES: Record<PartySide, { party: string; label: string; refs: Reference[]; recurring: string[][] }> = {
  customer: {
    party: 'customers',
    label: 'customer',
    refs: [
      { collection: 'invoices', path: ['customerId'], name: 'customerName' },
      { collection: 'estimates', path: ['customerId'], name: 'customerName' },
      { collection: 'creditNotes', path: ['customerId'], name: 'customerName' },
      { collection: 'payments', path: ['contactId'], name: 'contactName' },
      { collection: 'transactions', path: ['metadata', 'customerId'] },
      { collection: 'transactions', path: ['metadata', 'contactId'] },
    ],
    recurring: [['invoiceTemplate', 'customerId'], ['template', 'customerId']],
  },
  vendor: {
    party: 'vendors',
    label: 'vendor',
    refs: [
      { collection: 'bills', path: ['vendorId'], name: 'vendorName' },
      { collection: 'vendorCredits', path: ['vendorId'], name: 'vendorName' },
      { collection: 'purchaseOrders', path: ['vendorId'], name: 'vendorName' },
      { collection: 'payments', path: ['contactId'], name: 'contactName' },
      { collection: 'transactions', path: ['metadata', 'vendorId'] },
      { collection: 'transactions', path: ['metadata', 'contactId'] },
    ],
    recurring: [['billTemplate', 'vendorId'], ['template', 'vendorId']],
  },
};

const ADMIN_ROLES = ['owner', 'accountant'];
/** Kept as they are on the kept contact, never copied from the duplicate. */
const OWN_FIELDS = new Set(['id', 'workspaceId', 'uid', 'createdAt', 'updatedAt', 'status', 'importBatchId', 'name', 'contacts', 'tags', 'noteLog']);

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** A copy of `data` with the value at `path` replaced (nested objects copied, not mutated). */
function withPath(data: DocumentData, path: string[], value: unknown): DocumentData {
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...data, [head]: value };
  const inner = (data[head] && typeof data[head] === 'object' && !Array.isArray(data[head])) ? data[head] as DocumentData : {};
  return { ...data, [head]: withPath(inner, rest, value) };
}

function readPath(data: DocumentData, path: string[]): unknown {
  let cur: unknown = data;
  for (const p of path) cur = cur && typeof cur === 'object' ? (cur as DocumentData)[p] : undefined;
  return cur;
}

/** The kept contact's fields after the merge (pure, exported for tests). */
export function mergedPartyFields(keep: DocumentData, dup: DocumentData, note: ContactNote): DocumentData {
  const out: DocumentData = {};
  for (const [key, value] of Object.entries(dup)) {
    if (!OWN_FIELDS.has(key) && isEmpty(keep[key]) && !isEmpty(value)) out[key] = value;
  }
  const people = [...((keep.contacts as ContactPerson[]) || []), ...((dup.contacts as ContactPerson[]) || [])];
  const seen = new Set<string>();
  const contacts = cleanContacts(people).filter(p => {
    const key = (p.email || p.name).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (contacts.length) out.contacts = contacts;
  const tags = parseTags([...((keep.tags as string[]) || []), ...((dup.tags as string[]) || [])].join(','));
  if (tags.length) out.tags = tags;
  const notes = [note, ...((keep.noteLog as ContactNote[]) || []), ...((dup.noteLog as ContactNote[]) || [])]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, MAX_NOTES);
  out.noteLog = notes;
  return out;
}

export interface MergeInput {
  workspaceId: string;
  uid: string;
  email?: string;
  side: PartySide;
  keepId: string;
  mergeId: string;
}

export async function mergeContacts(db: Firestore, input: MergeInput): Promise<{ kept: string; removed: string; moved: Record<string, number> }> {
  const side = SIDES[input.side];
  if (input.keepId === input.mergeId) throw new ContactMergeError(400, 'Choose two different contacts');

  return db.runTransaction(async t => {
    const workspace = (await t.get(db.collection('workspaces').doc(input.workspaceId))).data();
    if (!workspace) throw new ContactMergeError(404, 'Workspace not found');
    if (!ADMIN_ROLES.includes(workspaceRole(workspace, input.uid))) throw new ContactMergeError(403, 'Only owners and accountants merge contacts');
    const keepRef = db.collection(side.party).doc(input.keepId);
    const dupRef = db.collection(side.party).doc(input.mergeId);
    const [keepSnap, dupSnap] = await Promise.all([t.get(keepRef), t.get(dupRef)]);
    const keep = keepSnap.data();
    const dup = dupSnap.data();
    // another workspace's contact answers like a missing one
    if (!keep || keep.workspaceId !== input.workspaceId || !dup || dup.workspaceId !== input.workspaceId) {
      throw new ContactMergeError(404, `${side.label[0].toUpperCase()}${side.label.slice(1)} not found`);
    }
    const keepName = String(keep.name || '');
    const updates = new Map<string, { collection: string; id: string; data: DocumentData }>();

    for (const ref of side.refs) {
      const snap = await t.get(db.collection(ref.collection).where('workspaceId', '==', input.workspaceId).where(ref.path.join('.'), '==', input.mergeId));
      for (const d of snap.docs) {
        const key = `${ref.collection}/${d.id}`;
        let next = withPath(updates.get(key)?.data || d.data(), ref.path, input.keepId);
        if (ref.name && next[ref.name] !== undefined) next = { ...next, [ref.name]: keepName };
        updates.set(key, { collection: ref.collection, id: d.id, data: next });
      }
    }
    const schedules = await t.get(db.collection('recurring').where('workspaceId', '==', input.workspaceId));
    for (const d of schedules.docs) {
      let data = d.data();
      let hit = false;
      for (const path of side.recurring) {
        if (readPath(data, path) === input.mergeId) { data = withPath(data, path, input.keepId); hit = true; }
      }
      if (hit) updates.set(`recurring/${d.id}`, { collection: 'recurring', id: d.id, data });
    }

    const now = new Date().toISOString();
    const note: ContactNote = { id: `merge-${input.mergeId}`, text: `Merged with "${String(dup.name || input.mergeId)}"`, at: now, ...(input.email ? { by: input.email } : {}) };
    const moved: Record<string, number> = {};
    for (const { collection, id, data } of updates.values()) {
      t.set(db.collection(collection).doc(id), { ...data, updatedAt: now });
      moved[collection] = (moved[collection] || 0) + 1;
    }
    t.update(keepRef, { ...mergedPartyFields(keep, dup, note), updatedAt: now });
    t.delete(dupRef);
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email,
      action: `${input.side.toUpperCase()}_MERGED`, entityType: side.party, entityId: input.keepId,
      details: { description: `Merged ${side.label} "${String(dup.name || input.mergeId)}" into "${keepName}"`, mergedId: input.mergeId, moved },
      severity: 'info',
    }, { db, tx: t });
    return { kept: input.keepId, removed: input.mergeId, moved };
  });
}
