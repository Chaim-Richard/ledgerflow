import { accountParentLinks, accountByCodeThenName, type AccountGroupMember } from './accountGroups';
import { monthBoundsISO } from './utils';
import { validCustomReportPeriod, type CustomReportPeriod } from './reportCustomPeriod';

export interface BalanceMember extends AccountGroupMember { netSigned: number }
export interface AccountBlock { id: string; label: string; cents: number; ownCents: number; weight: number; children: AccountBlock[] }

/** Layout only: signed figures come from the existing trial balance, once per account. */
export function accountIcicleTree(members: BalanceMember[]): AccountBlock {
  const listed = [...new Map(members.map(row => [row.id, row])).values()].sort(accountByCodeThenName);
  const links = accountParentLinks(listed);
  const byId = new Map(listed.map(row => [row.id, row]));
  for (const [id, parent] of links) if (byId.get(id)?.type !== byId.get(parent)?.type) links.delete(id);
  const children = new Map<string | undefined, BalanceMember[]>();
  for (const row of listed) {
    const parent = links.get(row.id);
    children.set(parent, [...(children.get(parent) || []), row]);
  }
  const build = (row: BalanceMember): AccountBlock => {
    const nested = (children.get(row.id) || []).map(build);
    const own = Number.isFinite(row.netSigned) ? row.netSigned : 0;
    // A parent can have its own postings as well as children; give those postings their own block.
    const direct = nested.length && own !== 0 ? [{ id: JSON.stringify(['direct', row.id]), label: `${row.name} · direct balance`, cents: own, ownCents: own, weight: Math.abs(own), children: [] }] : [];
    return { id: JSON.stringify(['account', row.id]), label: row.name, cents: own + nested.reduce((sum, node) => sum + node.cents, 0), ownCents: own, weight: Math.abs(own) + nested.reduce((sum, node) => sum + node.weight, 0), children: [...direct, ...nested] };
  };
  const roots = (children.get(undefined) || []).map(build);
  return { id: 'root', label: 'All accounts', cents: roots.reduce((sum, node) => sum + node.cents, 0), ownCents: 0, weight: roots.reduce((sum, node) => sum + node.weight, 0), children: roots };
}

export function monthBrushPeriod(months: string[], start: number, end: number): CustomReportPeriod | undefined {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= months.length) return;
  const first = months[start], last = months[end];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(first) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(last)) return;
  try {
    const result = { startDate: `${first}-01`, endDate: monthBoundsISO(`${last}-01`).end };
    return validCustomReportPeriod(result) ? result : undefined;
  } catch { return; }
}

export function brushIndex(clientX: number, left: number, width: number, length: number): number {
  if (![clientX, left, width, length].every(Number.isFinite) || width <= 0 || length <= 1) return 0;
  return Math.min(length - 1, Math.max(0, Math.round((clientX - left) / width * (length - 1))));
}
