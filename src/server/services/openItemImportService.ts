import crypto from 'crypto';
import type { Firestore } from '../db/firestore';
import type { RequestUser } from '../auth/requestUser';
import { isOpeningBalanceEquity } from '../../lib/openingBalances';
import { openingBalanceDocument } from '../../lib/partyOpeningBalance';
import { readOpenItemsCsv, type OpenItemRow, type OpenItemSide } from '../../lib/openItemImport';
import { workspaceRole } from '../../lib/periodLock';
import type { ChartAccount } from '../../types';
import { postDocument } from './documentPostService';
import { BulkRefusal } from './ledgerBulkCommit';
import { writeServerAuditLog } from './auditLogService';

/**
 * EG-14: opening open items, from a CSV (src/lib/openItemImport.ts). `preview` reads the file on the server against
 * the books and answers every row with its problem, writing nothing; `confirm` reads it again (the preview is never
 * trusted) and, only when no row has a problem, saves each row as an open invoice (bill) through the same server
 * posting every invoice uses (documentPostService.ts): A/R debit (A/P credit) for the open amount against Opening Balance
 * Equity, dated on the row's own date. No revenue or expense line is made.
 *
 * The cut-over date is the workspace's opening-balance date (set by recordOpeningBalances, openingBalanceService.ts).
 * Owners and accountants, as the opening balances. Each document's id and idempotency key come from the workspace,
 * the side, the contact and the number, so a confirm sent twice saves each document once.
 */
export class OpenItemImportError extends Error {
  constructor(readonly status: number, message: string, readonly rows: OpenItemRow[] = []) {
    super(message);
    this.name = 'OpenItemImportError';
  }
}

export interface OpenItemImportInput {
  workspaceId: string;
  side: OpenItemSide;
  csv: string;
  mode: 'preview' | 'confirm';
}

export interface OpenItemImportResult {
  cutOverDate: string;
  rows: OpenItemRow[];
  openTotalCents: number;
  /** confirm: the saved documents' ids, in file order */
  created: string[];
}

const ROLES = ['owner', 'accountant'];

export function openItemDocId(workspaceId: string, side: OpenItemSide, contactId: string, number: string): string {
  const hash = crypto.createHash('sha256').update([workspaceId, side, contactId, number.trim().toLowerCase()].join('|')).digest('hex').slice(0, 24);
  return `${workspaceId}_open_${hash}`;
}

export async function importOpenItems(db: Firestore, user: RequestUser, input: OpenItemImportInput): Promise<OpenItemImportResult> {
  const { workspaceId, side } = input;
  if (user.developerWorkspaceId && user.developerWorkspaceId !== workspaceId) throw new OpenItemImportError(403, 'This API key belongs to another workspace');
  const workspace = (await db.collection('workspaces').doc(workspaceId).get()).data();
  if (!workspace) throw new OpenItemImportError(404, 'Workspace not found');
  if (!ROLES.includes(workspaceRole(workspace as never, user.uid))) throw new OpenItemImportError(403, 'Only owners and accountants import opening invoices and bills');
  const cutOverDate = String(workspace.openingBalanceDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutOverDate)) throw new OpenItemImportError(400, 'Record the opening balances first: their date is the cut-over date');

  const accounts = (await db.collection('chartAccounts').where('workspaceId', '==', workspaceId).get()).docs.map(d => ({ ...d.data(), id: d.id }) as ChartAccount);
  const equity = accounts.find(a => isOpeningBalanceEquity(a) && !a.isArchived);
  if (!equity) throw new OpenItemImportError(400, 'Add an "Opening Balance Equity" account (equity) to the chart of accounts first');

  const contactCollection = side === 'customer' ? 'customers' : 'vendors';
  const docCollection = side === 'customer' ? 'invoices' : 'bills';
  const contactKey = side === 'customer' ? 'customerId' : 'vendorId';
  const nameKey = side === 'customer' ? 'customerName' : 'vendorName';
  const contacts = (await db.collection(contactCollection).where('workspaceId', '==', workspaceId).get()).docs
    .map(d => ({ ...d.data(), id: d.id }) as { id: string; name?: string; isArchived?: boolean; status?: string })
    .filter(c => c.name && !c.isArchived && c.status !== 'archived') as Array<{ id: string; name: string }>;
  const existing = (await db.collection(docCollection).where('workspaceId', '==', workspaceId).get()).docs
    .map(d => d.data()).filter(d => d.status !== 'void' && d.status !== 'voided')
    .map(d => ({ number: String(d.number || ''), contactId: String(d[contactKey] || ''), contactName: String(d[nameKey] || '') }));

  const read = readOpenItemsCsv(input.csv, { cutOverDate, currency: String(workspace.currency || 'USD'), contacts, existing });
  if (read.fileProblem) throw new OpenItemImportError(400, read.fileProblem);
  const result: OpenItemImportResult = { cutOverDate, rows: read.rows, openTotalCents: read.openTotalCents, created: [] };
  if (input.mode === 'preview') return result;

  const bad = read.rows.filter(r => r.problem);
  if (bad.length) throw new OpenItemImportError(400, `${bad.length} row${bad.length === 1 ? ' has a problem' : 's have problems'}: nothing was imported`, read.rows);

  for (const row of read.rows) {
    const party = { id: row.contactId!, name: row.contactName };
    const base = side === 'customer'
      ? openingBalanceDocument('customer', party, equity, row.openCents, row.date, row.currency, { number: row.number, dueDate: row.dueDate })
      : openingBalanceDocument('vendor', party, equity, row.openCents, row.date, row.currency, { number: row.number, dueDate: row.dueDate });
    const docId = openItemDocId(workspaceId, side, party.id, row.number);
    const data = { ...base, metadata: { ...base.metadata, openItemImport: true, originalAmountCents: row.amountCents, cutOverDate } } as Record<string, unknown>;
    try {
      await postDocument(db, user, { collection: docCollection, docId, workspaceId, action: 'create', data, idempotencyKey: `open-item-${docId}` });
    } catch (err) {
      const message = err instanceof BulkRefusal ? String(err.body.error || err.message) : err instanceof Error ? err.message : String(err);
      throw new OpenItemImportError(err instanceof BulkRefusal ? err.status : 500,
        `Line ${row.line} (${row.number}) could not be saved: ${message}. ${result.created.length} saved before it; import the rest again.`, read.rows);
    }
    result.created.push(docId);
  }
  await writeServerAuditLog({
    workspaceId, uid: user.uid, email: user.email || '', action: 'OPEN_ITEMS_IMPORTED', entityType: 'workspace', entityId: workspaceId,
    details: { description: `${result.created.length} opening ${side === 'customer' ? 'invoices' : 'bills'} imported as of ${cutOverDate}: ${read.openTotalCents} cents open`, side },
  }, { db });
  return result;
}
