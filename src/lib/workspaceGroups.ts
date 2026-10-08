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
  /** Z-16: the company that owns the others, when the group is a holding structure */
  parentId?: string;
  /** Z-16: the parent's share of each other member, in percent (a member not listed: 100) */
  ownership?: Record<string, number>;
  /** Z-17: the translation rates used, by `ratesKey` (reporting currency and period), then member currency */
  rates?: Record<string, Record<string, { closing: number; average: number; historical: number }>>;
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

/**
 * Why the group's structure (Z-16) can't be saved, or null. The parent is one of the members; each
 * other member's share is above 50% (a company the parent controls, so its books are added in full
 * and the rest belongs to other owners) and at most 100%, with two decimals at most.
 */
export function structureProblem(input: { workspaceIds: string[]; parentId?: unknown; ownership?: unknown }): string | null {
  if (input.parentId !== undefined && input.parentId !== null) {
    if (typeof input.parentId !== 'string' || !input.workspaceIds.includes(input.parentId)) return 'The parent company must be one of the group\'s workspaces';
  }
  if (input.ownership === undefined || input.ownership === null) return null;
  if (typeof input.ownership !== 'object' || Array.isArray(input.ownership)) return 'Enter the share owned of each company';
  const entries = Object.entries(input.ownership as Record<string, unknown>);
  if (entries.length > 0 && !input.parentId) return 'Choose the parent company before the shares it owns';
  for (const [id, share] of entries) {
    if (!input.workspaceIds.includes(id)) return 'A share is given for a workspace outside the group';
    if (id === input.parentId) return 'The parent company has no share of itself';
    if (typeof share !== 'number' || !Number.isFinite(share) || share > 100) return 'A share is a percentage up to 100';
    if (Math.round(share * 100) / 100 !== share) return 'A share has two decimals at most';
    if (share <= 50) return 'A company owned 50% or less is not added line by line (the equity method is not supported): leave it out of the group';
  }
  return null;
}

/** The parent's share of a member, in percent: 100 without a parent, for the parent, or when none is given. */
export const shareOf = (group: Pick<WorkspaceGroup, 'parentId' | 'ownership'>, workspaceId: string) =>
  group.parentId && workspaceId !== group.parentId ? group.ownership?.[workspaceId] ?? 100 : 100;

/** Z-17: rates are kept per reporting currency and period (the average depends on where it starts). */
export const ratesKey = (reportCurrency: string, startDate: string, endDate: string) => `${reportCurrency}:${startDate}:${endDate}`;
export const MAX_KEPT_RATES = 120;
const CURRENCY = /^[A-Z]{3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Why these rates can't be kept, or null. */
export function keptRatesProblem(input: { reportCurrency?: unknown; startDate?: unknown; endDate?: unknown; rates?: unknown }): string | null {
  if (typeof input.reportCurrency !== 'string' || !CURRENCY.test(input.reportCurrency)) return 'Say the reporting currency (three letters)';
  if (typeof input.startDate !== 'string' || !DAY.test(input.startDate) || typeof input.endDate !== 'string' || !DAY.test(input.endDate) || input.startDate > input.endDate) return 'Say the period (YYYY-MM-DD, from before to)';
  if (!input.rates || typeof input.rates !== 'object' || Array.isArray(input.rates)) return 'Send the rates by currency';
  const entries = Object.entries(input.rates as Record<string, unknown>);
  if (entries.length === 0 || entries.length > 50) return 'Send the rates by currency';
  for (const [currency, r] of entries) {
    if (!CURRENCY.test(currency) || currency === input.reportCurrency) return `There are no rates to keep for ${currency}`;
    const x = (r || {}) as Record<string, unknown>;
    if (!['closing', 'average', 'historical'].every(k => typeof x[k] === 'number' && Number.isFinite(x[k]) && (x[k] as number) > 0) || Object.keys(x).length !== 3) {
      return `The closing, average and historical rates for ${currency} are numbers above zero`;
    }
  }
  return null;
}

/** The groups a workspace is in (for showing it next to the workspace's name). */
export const groupsOf = (groups: WorkspaceGroup[], workspaceId: string) => groups.filter(g => g.workspaceIds.includes(workspaceId));
