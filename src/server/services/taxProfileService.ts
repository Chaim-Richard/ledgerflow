/**
 * Tax profiles (docs/PLAN.md §6, src/lib/tax/profile.ts): owners and accountants keep the books' tax
 * profile and each label value's. Only the server writes them (`taxProfiles` on the workspace),
 * checked and with an audit line. Nothing is posted.
 */
import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { taxProfilesProblem, type TaxProfiles } from '../../lib/tax/profile';
import { writeServerAuditLog } from './auditLogService';

export class TaxProfileError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'TaxProfileError';
  }
}

export async function setTaxProfiles(db: Firestore, input: { workspaceId: string; uid: string; email?: string; profiles: unknown }) {
  const problem = taxProfilesProblem(input.profiles);
  if (problem) throw new TaxProfileError(400, problem);
  const sent = input.profiles as TaxProfiles;
  const profiles: TaxProfiles = {
    ...(sent.books ? { books: sent.books } : {}),
    ...(sent.labels && Object.keys(sent.labels).length ? { labels: sent.labels } : {}),
  };
  return db.runTransaction(async t => {
    const ref = db.collection('workspaces').doc(input.workspaceId);
    const workspace = (await t.get(ref)).data();
    if (!workspace) throw new TaxProfileError(404, 'Workspace not found');
    const role = workspaceRole(workspace, input.uid);
    if (role !== 'owner' && role !== 'accountant') throw new TaxProfileError(403, 'Only owners and accountants keep the tax profiles');
    t.update(ref, { taxProfiles: profiles, updatedAt: new Date().toISOString() });
    const labels = Object.keys(profiles.labels || {});
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'TAX_PROFILES_SET', entityType: 'workspaces', entityId: input.workspaceId,
      details: { description: `Tax profiles: ${profiles.books ? 'the books' : 'no books profile'}${labels.length ? `, ${labels.join(', ')}` : ''}` },
    }, { db, tx: t });
    return { profiles };
  });
}
