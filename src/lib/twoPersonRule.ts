/**
 * The two-person rule (P-05): when an owner turns it on, nobody approves what they prepared
 * themselves. An invoice over the approval limit waits for someone else even when an owner or an
 * accountant issued it, and every pay run waits (an owner's too) for an owner or accountant other
 * than whoever prepared it. Turning it on needs two people who can approve, so nothing gets stuck.
 * Saved on the workspace by the server (`twoPersonRule`, twoStepPolicyService.ts); the server
 * enforces it, the screens only follow it.
 */
import { workspaceRole } from './periodLock';

export const APPROVING_ROLES = ['owner', 'accountant'];

export const TWO_PERSON_REFUSAL = 'Under the two-person rule, someone else approves what you prepared';

export const twoPersonOn = (workspace: { twoPersonRule?: unknown } | null | undefined) => workspace?.twoPersonRule === true;

/** How many people in the workspace can approve (owners and accountants). */
export function approverCount(workspace: { uid?: string; members?: unknown; roles?: unknown } | null | undefined): number {
  if (!workspace) return 0;
  const people = new Set([...(Array.isArray(workspace.members) ? workspace.members.map(String) : []), ...(workspace.uid ? [workspace.uid] : [])]);
  return [...people].filter(uid => APPROVING_ROLES.includes(workspaceRole(workspace, uid))).length;
}

/** May this person approve something prepared by `preparedBy`? Always, unless the rule is on and it is theirs. */
export const mayApprove = (on: boolean, uid: string | null | undefined, preparedBy: string | null | undefined) =>
  !on || !uid || !preparedBy || uid !== preparedBy;
