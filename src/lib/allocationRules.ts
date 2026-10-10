/**
 * Cost allocation rules (Q-05, one rule family with the bank rules K-39 and CA-13): a saved rule
 * says how a cost is split, e.g. "Rent split": the landlord's bill, 60% to Property 5 and 40% to
 * Property 6. Each share has a percentage and may set its own account and labels.
 *
 * A rule never posts on its own. On a bill whose vendor or description contains the rule's text, it is
 * suggested with why ("rule 'Rent split' matched: vendor contains 'Landlord'"); applying it only
 * changes the lines on screen, in whole cents with the remainder on the last share, and saving goes
 * through the normal checked route (the period lock, the labels, the balance). Owners and accountants
 * keep the rules (saved by the server on the workspace, `allocationRules`).
 */
export interface AllocationShare {
  /** above 0, two decimals at most; the shares of a rule add up to 100 */
  percent: number;
  /** this share's account; none = the line's own */
  accountId?: string;
  /** this share's labels, e.g. { property: 'P5' } */
  labels?: Record<string, string>;
}

export interface AllocationRule {
  id: string;
  name: string;
  /** suggested when the vendor (payee) or the description contains this text */
  match: string;
  shares: AllocationShare[];
}

export const MAX_ALLOCATION_RULES = 50;
export const MAX_SHARES = 20;
export const ALLOCATION_RULE_ID = /^ar_[a-z0-9]{6,20}$/;

const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
const hundredths = (n: number) => Math.round(n * 100);

/** Why these rules can't be saved, or null. Ids may be missing (new rules). */
export function allocationRulesProblem(rules: unknown): string | null {
  if (!Array.isArray(rules)) return 'The rules must be a list';
  if (rules.length > MAX_ALLOCATION_RULES) return `${MAX_ALLOCATION_RULES} rules at most`;
  const names = new Set<string>();
  for (const raw of rules) {
    const rule = (raw || {}) as Partial<AllocationRule>;
    const name = typeof rule.name === 'string' ? rule.name.trim() : '';
    if (name.length < 2 || name.length > 80) return 'Each rule needs a name of 2 to 80 characters';
    if (names.has(norm(name))) return `"${name}" is in the list twice`;
    names.add(norm(name));
    if (rule.id !== undefined && (typeof rule.id !== 'string' || !ALLOCATION_RULE_ID.test(rule.id))) return `"${name}": its id is not one of this workspace's rules`;
    const match = typeof rule.match === 'string' ? rule.match.trim() : '';
    if (match.length < 2 || match.length > 80) return `"${name}": say what the vendor or description contains (2 to 80 characters)`;
    if (!Array.isArray(rule.shares) || rule.shares.length < 2 || rule.shares.length > MAX_SHARES) return `"${name}": split into 2 to ${MAX_SHARES} shares`;
    let sum = 0;
    for (const share of rule.shares as Array<Partial<AllocationShare>>) {
      const p = share?.percent;
      if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0 || p > 100) return `"${name}": each share is a percentage above 0`;
      if (Math.abs(p * 100 - hundredths(p)) > 1e-6) return `"${name}": a percentage has two decimals at most`;
      sum += hundredths(p);
      if (share.accountId !== undefined && (typeof share.accountId !== 'string' || !share.accountId || share.accountId.length > 200)) return `"${name}": choose each share's account, or leave it as the line's`;
      if (share.labels !== undefined) {
        if (!share.labels || typeof share.labels !== 'object' || Array.isArray(share.labels)) return `"${name}": a share's labels are pairs of label and value`;
        if (Object.entries(share.labels).some(([k, v]) => !k || typeof v !== 'string' || !v || v.length > 200)) return `"${name}": a share's labels are pairs of label and value`;
      }
    }
    if (sum !== 10000) return `"${name}": the shares add up to ${sum / 100}%, not 100%`;
  }
  return null;
}

/** Why the rule applies to this document, in words, or null. */
export function ruleMatch(rule: Pick<AllocationRule, 'name' | 'match'>, doc: { vendorName?: string; description?: string }): string | null {
  const text = norm(rule.match);
  if (!text) return null;
  if (doc.vendorName && norm(doc.vendorName).includes(text)) return `rule '${rule.name}' matched: vendor contains '${rule.match.trim()}'`;
  if (doc.description && norm(doc.description).includes(text)) return `rule '${rule.name}' matched: description contains '${rule.match.trim()}'`;
  return null;
}

/** The first rule that applies, with why. */
export function suggestRule(rules: AllocationRule[] | undefined, doc: { vendorName?: string; description?: string }): { rule: AllocationRule; why: string } | null {
  for (const rule of rules || []) {
    const why = ruleMatch(rule, doc);
    if (why) return { rule, why };
  }
  return null;
}

/**
 * One amount split by the rule's shares, in whole cents: each share is the amount × its percentage,
 * rounded toward zero, and the last share takes what is left, so the shares add up exactly.
 */
export function splitByRule(rule: Pick<AllocationRule, 'shares'>, amountCents: number): number[] {
  const parts = rule.shares.map(s => Math.trunc((amountCents * hundredths(s.percent)) / 10000));
  parts[parts.length - 1] = amountCents - parts.slice(0, -1).reduce((a, b) => a + b, 0);
  return parts;
}

/**
 * The lines of a document after applying the rule to each of them: every line becomes one line per
 * share, with the share's account (or the line's own) and the line's labels plus the share's.
 */
export function applyRule<L extends { amountCents: number; accountId: string; description?: string; dimensions?: Record<string, string> }>(
  rule: Pick<AllocationRule, 'shares'>, lines: L[], newId: () => string,
): Array<L & { id: string }> {
  return lines.flatMap(line => splitByRule(rule, line.amountCents).map((amountCents, i) => {
    const share = rule.shares[i];
    const dimensions = { ...(line.dimensions || {}), ...(share.labels || {}) };
    return { ...line, id: newId(), amountCents, accountId: share.accountId || line.accountId, ...(Object.keys(dimensions).length ? { dimensions } : {}) };
  }));
}
