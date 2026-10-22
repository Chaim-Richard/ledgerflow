import type { DocumentData, Firestore } from '../db/firestore';
import { checkLedgerEntry } from './ledgerDoor';
import { InvoiceSchema, BillSchema, ProjectSchema, CreditNoteSchema, VendorCreditSchema } from '../../schemas';

/**
 * Restores a workspace from a backup file (the export's JSON), all or nothing.
 *
 * Safety rules:
 * - A record id that already belongs to ANOTHER workspace refuses the whole restore; otherwise
 *   a crafted backup could overwrite or take over another company's records.
 * - Ownership, membership, billing and system fields of the workspace are never restored.
 * - The old records are deleted and the backup written in ONE database transaction, so a
 *   failure leaves the workspace as it was.
 */

export class RestoreError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'RestoreError';
  }
}

export const RESTORE_COLLECTIONS: { key: string; coll: string }[] = [
  { key: 'transactions', coll: 'transactions' },
  { key: 'accounts', coll: 'chartAccounts' },
  { key: 'projects', coll: 'projects' },
  { key: 'budgets', coll: 'budgets' },
  { key: 'vendors', coll: 'vendors' },
  { key: 'customers', coll: 'customers' },
  { key: 'invoices', coll: 'invoices' },
  { key: 'bills', coll: 'bills' },
  { key: 'payments', coll: 'payments' },
  { key: 'estimates', coll: 'estimates' },
  { key: 'inventory', coll: 'inventory' },
  { key: 'assets', coll: 'assets' },
  { key: 'recurringRules', coll: 'recurring' },
  { key: 'recurring', coll: 'recurring' },
  { key: 'taxRates', coll: 'taxRates' },
  { key: 'autoRules', coll: 'autoRules' },
  { key: 'reconciliations', coll: 'reconciliations' },
  // L-07: the rest of the books (older backups simply don't have these keys)
  { key: 'creditNotes', coll: 'creditNotes' },
  { key: 'vendorCredits', coll: 'vendorCredits' },
  { key: 'bankLines', coll: 'bankLines' },
  { key: 'journalEntries', coll: 'journalEntries' },
  { key: 'purchaseOrders', coll: 'purchaseOrders' },
  { key: 'employees', coll: 'employees' },
  { key: 'payRuns', coll: 'payRuns' },
  { key: 'partners', coll: 'partners' },
  { key: 'dimensionNodes', coll: 'dimensionNodes' },
  { key: 'numberingSeries', coll: 'numberingSeries' },
  { key: 'periods', coll: 'periods' },
  // W-02: the stock history goes with the quantities (an older backup without it clears it)
  { key: 'stockMoves', coll: 'stockMoves' },
];

/** Workspace fields a backup may not change: ownership, membership, billing, closing and system state. */
export const PROTECTED_WORKSPACE_FIELDS = new Set([
  'lockDate', 'softLockDate', 'lockException',
  'id', 'uid', 'createdAt', 'plan', 'billingCycle', 'computeCreditBalance', 'apiQuotaMonthlyLimitCents',
  'apiQuotaTotalCentsUsed', 'maxSeats', 'seatCount', 'concurrentUserLimit', 'activeUserCount',
  'stripeCustomerId', 'stripeSubscriptionId', 'bypassBilling', 'status', 'lockedUntilDate',
  'billingLedgerChain', 'allowedWorldPaths', 'analyticalTopology', 'computeHardnessScore', 'roles',
  'admins', 'members', 'adminCount', 'deletedAt', 'scheduledPurgeAt', 'retention', 'setupCompletedAt', 'openingBalanceDate', 'totalQueriesThisMonth',
]);

const VALID_ID = /^[^\s/]{1,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface RestoreResult {
  restoredCollections: string[];
  counts: Record<string, number>;
}

/** The later of two YYYY-MM-DD dates ('' when neither is set). */
function latestDate(a: unknown, b: unknown): string {
  const x = typeof a === 'string' ? a : '';
  const y = typeof b === 'string' ? b : '';
  return x > y ? x : y;
}

export async function restoreWorkspaceBackup(db: Firestore, workspaceId: string, backup: unknown): Promise<RestoreResult> {
  if (!isRecord(backup)) throw new RestoreError(400, 'Invalid backup payload');
  const backupWorkspace = backup.workspace;
  if (backupWorkspace !== undefined && (!isRecord(backupWorkspace) || backupWorkspace.id !== workspaceId)) {
    throw new RestoreError(400, 'Backup workspace ID does not match target workspace ID');
  }
  if (backup.schemaVersion !== undefined && Number(backup.schemaVersion) !== 1) {
    throw new RestoreError(400, 'Unsupported schema version');
  }

  // 1. Collect the backup's records (the same record under two keys: the last one wins).
  const records = new Map<string, { coll: string; id: string; data: DocumentData }>();
  for (const { key, coll } of RESTORE_COLLECTIONS) {
    const items = backup[key];
    if (items === undefined || items === null) continue;
    if (!Array.isArray(items)) throw new RestoreError(400, `Backup field "${key}" must be a list`);
    for (const item of items) {
      if (!isRecord(item)) throw new RestoreError(400, `Backup field "${key}" contains an invalid record`);
      const { id: rawId, ...data } = item;
      const id = rawId === undefined || rawId === null || rawId === '' ? db.collection(coll).doc().id : rawId;
      if (typeof id !== 'string' || !VALID_ID.test(id)) {
        throw new RestoreError(400, `Backup field "${key}" contains an invalid record id`);
      }
      records.set(`${coll}/${id}`, { coll, id, data: { ...data, workspaceId } });
    }
  }

  // AUD-02: every ledger entry in the backup must be one the ledger door would accept (its workspace,
  // whole cents, debits = credits, total = lines) — checked before anything is read or written, so a
  // tampered or broken backup restores nothing.
  for (const r of records.values()) {
    if (r.coll !== 'transactions') continue;
    try {
      checkLedgerEntry(r.data);
    } catch (err) {
      throw new RestoreError(400, `Backup entry transactions/${r.id} is not a valid ledger entry (${err instanceof Error ? err.message : 'invalid'}); nothing was restored`);
    }
  }

  // AUD-02: the closed-books check, the ownership check and the reads of what is deleted all happen
  // inside the one serializable transaction that writes the backup — a month closed, or a record moved
  // or added, between checking and writing can no longer slip past the checks.
  const counts: Record<string, number> = {};
  await db.runTransaction(async t => {
    // a retried transaction (serialization conflict) counts again from zero, or the answer doubles
    for (const key of Object.keys(counts)) delete counts[key];
    // Closed books are never replaced by an older state: a backup may be restored over closed periods
    // only if it was made when the books were closed at least as far as they are now, so its closed
    // months are those closed books. (Refusing every restore once a month was closed left no way to
    // restore at all: reopening a month never clears the lock date. Found by the main-path test, DA-07.)
    const current = (await t.get(db.collection('workspaces').doc(workspaceId))).data() || {};
    const closedNow = latestDate(current.lockDate, current.softLockDate);
    if (closedNow) {
      const closedInBackup = isRecord(backupWorkspace) ? latestDate(backupWorkspace.lockDate, backupWorkspace.softLockDate) : '';
      if (!closedInBackup || closedInBackup < closedNow) {
        throw new RestoreError(409, closedInBackup
          ? `Books are closed through ${closedNow}, but this backup was made when they were closed through ${closedInBackup}: it can't replace the months closed since. Use a backup made after the close, or reopen those months first (Month-End Close).`
          : `Books are closed through ${closedNow}, and this backup was made before any month was closed: it can't replace closed periods. Use a backup made after the close.`);
      }
    }

    // AUD-02: the documents with a schema (the same ones a normal save checks): every field they carry must
  // have the type a save would accept — an amount as text or a date as a number refuses the whole backup.
  // Fields that are missing, and the status label (older versions wrote others), are not judged, and the
  // record is restored as it was: the check never strips fields an older or newer version wrote.
  const DOCUMENT_SCHEMAS = { invoices: InvoiceSchema, bills: BillSchema, projects: ProjectSchema, creditNotes: CreditNoteSchema, vendorCredits: VendorCreditSchema } as const;
  for (const r of records.values()) {
    const schema = DOCUMENT_SCHEMAS[r.coll as keyof typeof DOCUMENT_SCHEMAS];
    if (!schema) continue;
    const { status: _status, ...fields } = r.data;
    const parsed = schema.partial().safeParse(fields);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new RestoreError(400, `Backup record ${r.coll}/${r.id} is not a valid ${r.coll === 'bills' ? 'bill' : r.coll.replace(/s$/, '')} (${issue?.path.join('.') || 'record'}: ${issue?.message || 'invalid'}); nothing was restored`);
    }
  }

  // 2. Refuse ids that belong to another workspace.
    const byCollection = new Map<string, string[]>();
    for (const r of records.values()) byCollection.set(r.coll, [...(byCollection.get(r.coll) || []), r.id]);
    for (const [coll, ids] of byCollection) {
      for (let i = 0; i < ids.length; i += 500) {
        const snaps = await t.getAll(...ids.slice(i, i + 500).map(id => db.collection(coll).doc(id)));
        const foreign = snaps.find(s => s.exists && s.data()?.workspaceId !== workspaceId);
        if (foreign) {
          throw new RestoreError(409, `Backup record ${coll}/${foreign.id} belongs to another workspace; nothing was restored`);
        }
      }
    }

    // 3. Delete this workspace's records, write the backup, update safe settings.
    const colls = Array.from(new Set(RESTORE_COLLECTIONS.map(c => c.coll)));
    // every read happens before the first write (a transaction rule)
    const existing = [];
    for (const coll of colls) existing.push(await t.get(db.collection(coll).where('workspaceId', '==', workspaceId)));
    for (const snap of existing) snap.docs.forEach(doc => t.delete(doc.ref));
    for (const r of records.values()) {
      t.set(db.collection(r.coll).doc(r.id), r.data);
      counts[r.coll] = (counts[r.coll] || 0) + 1;
    }
    if (isRecord(backupWorkspace)) {
      const safe: DocumentData = {};
      for (const [k, v] of Object.entries(backupWorkspace)) {
        if (!PROTECTED_WORKSPACE_FIELDS.has(k)) safe[k] = v;
      }
      if (Object.keys(safe).length > 0) t.set(db.collection('workspaces').doc(workspaceId), safe, { merge: true });
    }
  });

  return {
    restoredCollections: Array.from(new Set(RESTORE_COLLECTIONS.filter(c => backup[c.key] != null).map(c => c.key))),
    counts,
  };
}

/** Collections a backup holds: one entry per table (old backups used "recurringRules" too). */
const BACKUP_TABLES = RESTORE_COLLECTIONS.filter(c => c.key !== 'recurring');

/**
 * The backup file (export): every collection RESTORE_COLLECTIONS restores, the workspace's
 * settings, counts, and a SHA-256 checksum over the payload without it (the Settings screen checks
 * it before restoring).
 */
export async function exportWorkspaceBackup(db: Firestore, workspaceId: string, exportedBy: string): Promise<Record<string, unknown> & { metadata: Record<string, unknown> }> {
  // AUD-02: every table is read inside one transaction, so the backup is one consistent moment of the
  // books — a save made while the export runs is either wholly in it or wholly out of it.
  const tables: Record<string, Array<Record<string, unknown>>> = {};
  const wsData = await db.runTransaction(async t => {
    const wsDoc = await t.get(db.collection('workspaces').doc(workspaceId));
    for (const { key, coll } of BACKUP_TABLES) {
      const snap = await t.get(db.collection(coll).where('workspaceId', '==', workspaceId));
      tables[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return wsDoc.exists ? wsDoc.data() || {} : {};
  }, { readOnly: true });
  const payload: Record<string, unknown> & { metadata: Record<string, unknown> } = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    workspace: { ...wsData, id: workspaceId },
    metadata: {},
  };
  const counts: Record<string, number> = {};
  for (const { key } of BACKUP_TABLES) {
    payload[key] = tables[key];
    counts[key] = tables[key].length;
  }
  payload.metadata = {
    counts,
    transactionCount: counts.transactions || 0,
    currency: (wsData.currency as string) || 'USD',
    exportedBy,
    serverAuthoritative: true,
  };
  const { createHash } = await import('node:crypto');
  payload.metadata.checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return payload;
}

