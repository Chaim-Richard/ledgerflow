/**
 * Account groups (K-14): an account can sit inside a parent account of the same type, at most three
 * levels deep and never in a loop. Nothing here moves a figure. A group is a way of *showing* the
 * accounts a report section already has: the parent, its children indented under it and a subtotal
 * that is exactly the sum of the accounts inside it, so the section total stays what it was.
 *
 * The saved links are untrusted — a spreadsheet import can carry a parent that is gone, a parent of
 * another type or a loop — so the layout drops a link it cannot use and keeps every account in the
 * list instead of hiding it or walking the loop forever.
 *
 * Pure: no store, no fetch, no posting (AGENTS.md layer 2).
 */

/** How deep a group may go: the parent, its child, its grandchild. */
export const ACCOUNT_GROUP_MAX_DEPTH = 3;

/** How far a report indents one level of a group, in pixels. */
export const ACCOUNT_GROUP_INDENT_PX = 16;

/** What grouping needs of an account; `ChartAccount` and the report lines both fit as they are. */
export interface AccountGroupMember {
  id: string;
  name: string;
  code?: string;
  type: string;
  parentId?: string | null;
}

export interface AccountGroupLayoutRow<M extends AccountGroupMember = AccountGroupMember> {
  /** Unique in the list: the account's id, or `subtotal:<parent id>`. */
  key: string;
  kind: 'account' | 'subtotal';
  /** The account itself; on a subtotal row, the group's parent account. */
  member: M;
  /** 0 for a top-level account, 1 for its child, 2 for a grandchild. */
  depth: number;
  /** An account row with accounts inside it, so a report can hide them. */
  hasChildren: boolean;
  /** The groups that hide this row while they are collapsed. */
  collapsedBy: string[];
  /** What the row is called: the account name, or "Total <parent>" on a subtotal row. */
  label: string;
}

/** Sibling order used when a report does not ask for one: by code, then by name. */
export const accountByCodeThenName = (a: AccountGroupMember, b: AccountGroupMember): number =>
  (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name);

function uniqueMembers<M extends AccountGroupMember>(members: M[]): M[] {
  return [...new Map(members.map(member => [member.id, member])).values()];
}

/**
 * The parent links that can be used: the parent is another account in the same list, nobody is its
 * own parent, and no link closes a loop. A loop is cut at the link that closes it, so the accounts
 * in it stay in the report (one of them as a top-level account) and a walk always ends.
 */
export function accountParentLinks(members: AccountGroupMember[]): Map<string, string> {
  const listed = uniqueMembers(members);
  const known = new Set(listed.map(member => member.id));
  const links = new Map<string, string>();
  for (const member of listed) {
    const parentId = member.parentId;
    if (!parentId || parentId === member.id || !known.has(parentId)) continue;
    links.set(member.id, parentId);
  }
  for (const member of listed) {
    const walked = new Set<string>([member.id]);
    let previous = member.id;
    let cursor = links.get(member.id);
    while (cursor) {
      if (walked.has(cursor)) {
        links.delete(previous); // the link just followed closes the loop
        break;
      }
      walked.add(cursor);
      previous = cursor;
      cursor = links.get(cursor);
    }
  }
  return links;
}

function childrenByParent<M extends AccountGroupMember>(members: M[], links: Map<string, string>): Map<string, M[]> {
  const children = new Map<string, M[]>();
  for (const member of members) {
    const parentId = links.get(member.id);
    if (!parentId) continue;
    const list = children.get(parentId);
    if (list) list.push(member);
    else children.set(parentId, [member]);
  }
  return children;
}

/** How many levels an account already sits in: 1 at the top, 2 inside a parent, 3 inside two. */
export function accountGroupDepth(links: Map<string, string>, accountId: string): number {
  let depth = 1;
  for (let cursor = links.get(accountId); cursor; cursor = links.get(cursor)) depth++;
  return depth;
}

/** How many levels the account and the accounts inside it take: 1 when it has none. */
export function accountSubtreeDepth(links: Map<string, string>, accountId: string): number {
  const children = new Map<string, string[]>();
  for (const [childId, parentId] of links) {
    const below = children.get(parentId);
    if (below) below.push(childId);
    else children.set(parentId, [childId]);
  }
  const depthOf = (id: string, walked: Set<string>): number => {
    if (walked.has(id)) return 1; // unreachable with the loop already cut; kept so this cannot hang
    const below = children.get(id) || [];
    if (below.length === 0) return 1;
    return 1 + Math.max(...below.map(child => depthOf(child, new Set(walked).add(id))));
  };
  return depthOf(accountId, new Set());
}

/**
 * Why an account cannot take this parent, or `null` when it can. `account` may be an account that is
 * not saved yet (a new one has no id and nothing inside it), so it is passed on its own.
 */
export function accountParentProblem(
  members: AccountGroupMember[],
  account: { id: string; name: string; type: string },
  parentId: string | null | undefined,
): string | null {
  const wanted = (parentId || '').trim();
  if (!wanted) return null; // taking an account back to the top level is always allowed
  const parent = members.find(member => member.id === wanted);
  if (!parent) return 'That parent is not an account in this chart';
  if (parent.id === account.id) return 'An account cannot be inside itself';
  if (parent.type !== account.type) {
    return `A group holds one type of account: ${parent.name} is "${parent.type}", ${account.name || 'this account'} is "${account.type}"`;
  }
  const links = accountParentLinks(members);
  for (let cursor = links.get(parent.id); cursor; cursor = links.get(cursor)) {
    if (cursor === account.id) return `${parent.name} is already inside ${account.name}`;
  }
  const levels = accountGroupDepth(links, parent.id) + accountSubtreeDepth(links, account.id);
  if (levels > ACCOUNT_GROUP_MAX_DEPTH) {
    return `Account groups are at most ${ACCOUNT_GROUP_MAX_DEPTH} levels deep, and this would take ${levels}`;
  }
  return null;
}

/** The accounts this one could be put inside, in the order a picker should show them. */
export function allowedParentAccounts<M extends AccountGroupMember>(
  members: M[],
  account: { id: string; name: string; type: string },
): M[] {
  return uniqueMembers(members)
    .filter(member => member.id !== account.id && accountParentProblem(members, account, member.id) === null)
    .sort(accountByCodeThenName);
}

/** True when at least one account in the list really sits inside another (so grouping is worth showing). */
export function hasAccountGroups(members: AccountGroupMember[]): boolean {
  return accountParentLinks(members).size > 0;
}

/**
 * The accounts as rows: each parent, the accounts inside it indented one level further, and a
 * "Total <parent>" row under them. Nothing is dropped — an account whose parent is missing, of
 * another type or part of a loop is a top-level row. Without any group this is the plain sorted list.
 */
export function accountGroupLayout<M extends AccountGroupMember>(
  members: M[],
  compare: (a: M, b: M) => number = accountByCodeThenName as (a: M, b: M) => number,
): AccountGroupLayoutRow<M>[] {
  const listed = uniqueMembers(members);
  const links = accountParentLinks(listed);
  const children = childrenByParent(listed, links);
  const roots = listed.filter(member => !links.get(member.id)).sort(compare);
  for (const group of children.values()) group.sort(compare);

  const rows: AccountGroupLayoutRow<M>[] = [];
  const walk = (member: M, depth: number, collapsedBy: string[]) => {
    const inside = children.get(member.id) || [];
    rows.push({
      key: member.id,
      kind: 'account',
      member,
      depth,
      hasChildren: inside.length > 0,
      collapsedBy,
      label: member.name,
    });
    if (inside.length === 0) return;
    const within = [...collapsedBy, member.id];
    for (const child of inside) walk(child, depth + 1, within);
    rows.push({
      key: `subtotal:${member.id}`,
      kind: 'subtotal',
      member,
      depth,
      hasChildren: false,
      collapsedBy: within,
      label: `Total ${member.name}`,
    });
  };
  for (const root of roots) walk(root, 0, []);
  return rows;
}

/**
 * Each group's subtotal: the parent's own figures plus every account inside it, key by the parent's
 * id. Adding the subtotals of the top-level groups and the accounts with no group gives the section
 * total back exactly — a subtotal is a sum of accounts already counted there, never a new figure.
 */
export function groupSubtotals<M extends AccountGroupMember, V extends Record<string, number>>(
  members: M[],
  valueOf: (member: M) => V,
): Map<string, V> {
  const listed = uniqueMembers(members);
  const links = accountParentLinks(listed);
  const children = childrenByParent(listed, links);
  const own = new Map(listed.map(member => [member.id, valueOf(member)]));
  const summed = new Map<string, Record<string, number>>();

  const sumOf = (id: string): Record<string, number> => {
    const cached = summed.get(id);
    if (cached) return cached;
    const total: Record<string, number> = { ...(own.get(id) || {}) };
    summed.set(id, total); // a cut loop cannot come back here, and this keeps a walk finite anyway
    for (const child of children.get(id) || []) {
      const part = sumOf(child.id);
      for (const key of Object.keys(part)) total[key] = (total[key] || 0) + part[key];
    }
    return total;
  };

  const subtotals = new Map<string, V>();
  for (const member of listed) {
    if ((children.get(member.id) || []).length === 0) continue;
    subtotals.set(member.id, sumOf(member.id) as V);
  }
  return subtotals;
}

/** The rows a report shows: everything outside a collapsed group (reports start with groups open). */
export function visibleGroupRows<T extends { collapsedBy?: string[] }>(rows: T[], collapsedGroups: Set<string>): T[] {
  return rows.filter(row => !(row.collapsedBy || []).some(id => collapsedGroups.has(id)));
}

/** The rows the chart of accounts shows: it keeps its own expanded list, so children start hidden. */
export function rowsInsideExpandedGroups<T extends { collapsedBy?: string[] }>(rows: T[], expandedGroups: Set<string>): T[] {
  return rows.filter(row => (row.collapsedBy || []).every(id => expandedGroups.has(id)));
}

/** Hide a group's accounts (or show them again); returns a new set, so React sees the change. */
export function toggleAccountGroup(collapsedGroups: Set<string>, groupId: string): Set<string> {
  const next = new Set(collapsedGroups);
  if (next.has(groupId)) next.delete(groupId);
  else next.add(groupId);
  return next;
}

/** The ids of the groups in a layout, for "hide all" / "show all". */
export function accountGroupIds<M extends AccountGroupMember>(rows: AccountGroupLayoutRow<M>[]): string[] {
  return rows.filter(row => row.hasChildren).map(row => row.member.id);
}
