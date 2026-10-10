/**
 * Approving in someone's place (BG-07): an owner or accountant who will be away names one person
 * in the workspace to approve invoices over the limit for them until a date (that day included).
 * The person approves as if they were an approver; every decision still records who made it. Saved
 * on the workspace by the server (`approvalDelegates`, src/server/services/approvalDelegateService.ts).
 */
import { workspaceRole } from './periodLock';

export interface ApprovalDelegate { from: string; to: string; until: string }

export const MAX_DELEGATION_DAYS = 92;

/** Whether this person approves today, for someone away. */
export function approvesInPlace(workspace: { approvalDelegates?: unknown } | null | undefined, uid: string | null | undefined, today: string): ApprovalDelegate | undefined {
  if (!uid || !Array.isArray(workspace?.approvalDelegates)) return undefined;
  return (workspace.approvalDelegates as ApprovalDelegate[]).find(d => d && d.to === uid && typeof d.until === 'string' && d.until >= today);
}

/** What a delegation needs; null when it is fine. */
export function delegationProblem(workspace: { uid?: string; members?: unknown; roles?: unknown }, from: string, input: { to?: unknown; until?: unknown }, today: string): string | null {
  const role = workspaceRole(workspace, from);
  if (role !== 'owner' && role !== 'accountant') return 'Only owners and accountants approve, so only they hand it over';
  if (typeof input.to !== 'string' || !input.to) return 'Choose who approves in your place';
  if (input.to === from) return 'Choose someone else';
  const people = [...(Array.isArray(workspace.members) ? workspace.members.map(String) : []), ...(workspace.uid ? [workspace.uid] : [])];
  if (!people.includes(input.to)) return 'That person is not in this workspace';
  if (workspaceRole(workspace, input.to) === 'viewer') return 'A viewer cannot approve; choose a bookkeeper, accountant or owner';
  if (typeof input.until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.until) || input.until < today) return 'Choose the last day, today or later';
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + MAX_DELEGATION_DAYS);
  if (input.until > limit.toISOString().slice(0, 10)) return `${MAX_DELEGATION_DAYS} days at most`;
  return null;
}
