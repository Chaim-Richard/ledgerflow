import type { DocumentData } from '../db/firestore';
import { approvalForSave, isApproverRole, isIssuedForApproval, normalizeInvoiceApproval, type InvoiceApprovalRecord } from '../../lib/invoiceApproval';
import { workspaceRole } from '../../lib/periodLock';

/**
 * Invoice approval on the server (BE-04, L-191). The browser used to decide who signed: a save that
 * carried `approval: { state: 'approved' }` was stored as sent. Now every invoice the server saves
 * goes through here:
 * - approving or sending back is refused unless the person is an owner or an accountant, and the
 *   record says who and when from the server, not from the request;
 * - an invoice that starts going out over the limit without a record gets one (approved when an
 *   owner or accountant saves it, else awaiting), so leaving the field out can't skip the rule.
 */
export class ApprovalRefused extends Error {
  readonly status = 403;
}

export function serverApproval(existing: DocumentData | undefined, incoming: DocumentData, workspace: DocumentData, uid: string, now: string): { approval?: InvoiceApprovalRecord } {
  const role = workspaceRole(workspace, uid);
  const approver = isApproverRole(role);
  const sent = incoming.approval as InvoiceApprovalRecord | undefined;
  const before = existing?.approval as InvoiceApprovalRecord | undefined;
  if (sent) {
    const decided = sent.state === 'approved' || sent.state === 'rejected';
    const changed = sent.state !== before?.state || sent.decidedAt !== before?.decidedAt || sent.note !== before?.note;
    if (decided && changed) {
      if (!approver) throw new ApprovalRefused('Only owners and accountants approve or send back invoices');
      return { approval: { ...sent, decidedBy: uid, decidedAt: now } };
    }
    if (sent.state === 'awaiting' && changed) return { approval: { ...sent, requestedBy: uid, requestedAt: now } };
    return {};
  }
  const settings = normalizeInvoiceApproval(workspace.invoiceApproval);
  if (!settings.enabled || before) return {};
  if (existing && isIssuedForApproval(existing.status)) return {}; // it was already out before: never reached back
  const stamp = approvalForSave({ ...(existing || {}), ...incoming }, settings, { role, uid, now });
  return stamp ? { approval: stamp } : {};
}
