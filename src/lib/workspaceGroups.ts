/**
 * Groups of books (DA-01): a person's own grouping of the workspaces they can open, e.g. a holding
 * and its companies, or an accountant's clients by kind. A group has a stable id, a name and its
 * members; belonging to one changes nothing in a workspace. The server keeps them
 * (src/server/services/workspaceGroupService.ts) and only ever shows members the person can open.
 * Later, reports across a group (Z-16) read each member under the person's own access.
 */
export interface WorkspaceGroup {
  id: string;
  name: string;
  /** the member workspaces, in the order chosen */
  workspaceIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export const MAX_GROUPS = 100;
export const MAX_GROUP_MEMBERS = 500;
export const GROUP_ID = /^grp_[a-z0-9]{8,40}$/;

/** Why this group can't be saved, or null. */
export function groupProblem(input: { name?: unknown; workspaceIds?: unknown }): string | null {
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim()) return 'Give the group a name';
    if (input.name.trim().length > 80) return 'A group name is 80 characters at most';
  }
  if (input.workspaceIds !== undefined) {
    if (!Array.isArray(input.workspaceIds) || input.workspaceIds.some(id => typeof id !== 'string' || !id)) return 'Choose the workspaces of the group';
    if (new Set(input.workspaceIds).size !== input.workspaceIds.length) return 'A workspace is in the group twice';
    if (input.workspaceIds.length > MAX_GROUP_MEMBERS) return `A group holds ${MAX_GROUP_MEMBERS} workspaces at most`;
  }
  return null;
}

/** The groups a workspace is in (for showing it next to the workspace's name). */
export const groupsOf = (groups: WorkspaceGroup[], workspaceId: string) => groups.filter(g => g.workspaceIds.includes(workspaceId));
