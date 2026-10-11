/**
 * Price lists (M-11, src/lib/priceLists.ts): owners and accountants keep the workspace's lists. Only
 * the server writes them (`priceLists` on the workspace), with new ids for new lists and an audit
 * line. A list only fills prices on new invoice and estimate lines; nothing posted changes.
 */
import crypto from 'crypto';
import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { priceListsProblem, type PriceList } from '../../lib/priceLists';
import { writeServerAuditLog } from './auditLogService';

export class PriceListError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'PriceListError';
  }
}

export async function setPriceLists(db: Firestore, input: { workspaceId: string; uid: string; email?: string; lists: unknown }) {
  const problem = priceListsProblem(input.lists);
  if (problem) throw new PriceListError(400, problem);
  return db.runTransaction(async t => {
    const ref = db.collection('workspaces').doc(input.workspaceId);
    const workspace = (await t.get(ref)).data();
    if (!workspace) throw new PriceListError(404, 'Workspace not found');
    const role = workspaceRole(workspace, input.uid);
    if (role !== 'owner' && role !== 'accountant') throw new PriceListError(403, 'Only owners and accountants keep the price lists');
    const before = Array.isArray(workspace.priceLists) ? workspace.priceLists as PriceList[] : [];
    const known = new Set(before.map(l => l.id));
    const lists: PriceList[] = (input.lists as PriceList[]).map(l => ({
      // an id that is not one of this workspace's lists gets a new one
      id: l.id && known.has(l.id) ? l.id : `pl_${crypto.randomBytes(6).toString('hex')}`,
      name: l.name.trim(),
      ...(l.discountPercent ? { discountPercent: l.discountPercent } : {}),
      ...(l.prices && Object.keys(l.prices).length ? { prices: l.prices } : {}),
      ...(l.customerIds && l.customerIds.length ? { customerIds: [...new Set(l.customerIds)] } : {}),
    }));
    t.update(ref, { priceLists: lists, updatedAt: new Date().toISOString() });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'PRICE_LISTS_SET', entityType: 'workspaces', entityId: input.workspaceId,
      details: { description: `Price lists: ${lists.map(l => l.name).join(', ') || 'none'}` },
    }, { db, tx: t });
    return { lists };
  });
}
