/**
 * The group summary account by account (Z-20): each company's accounts side by side, matched across
 * the companies by their code, or by their name when an account has no code (so "4000 Sales" in one
 * company and "4000 Revenue" in another are one line, said with both names). Each line is the
 * company's own balance (the period's movement for income and costs, the balance at the end date for
 * assets, liabilities and equity), translated like the totals when the group is shown in one currency
 * (average rate for income and costs, closing for assets and liabilities, historical for equity, with
 * the profit not yet closed and the translation difference on lines of their own). Lines are rounded
 * one by one, so a translated section can differ by a few cents from its total. Balances and sales
 * between the companies are taken out of the totals, not of these lines: they show each company's
 * books as they are.
 */

export type LineSection = 'income' | 'cogs' | 'expense' | 'asset' | 'liability' | 'equity';
export const SECTIONS: LineSection[] = ['income', 'cogs', 'expense', 'asset', 'liability', 'equity'];

export interface GroupAccountLine {
  key: string;
  section: LineSection;
  name: string;
  code?: string;
  /** other names the same code has in other companies */
  alsoNamed?: string[];
  /** each company's figure, in the report's currency */
  byMember: Record<string, number>;
  total: number;
}

/** An account as far as matching needs it */
export interface LineAccount { id: string; name: string; code?: string }

export interface MemberAccounts {
  workspaceId: string;
  accounts: LineAccount[];
  /** account id → its figure, per section, in the company's own currency */
  sections: Record<LineSection, Record<string, number>>;
  /** the rate a section is translated at (1 without translation) */
  rate: (section: LineSection) => number;
  /** translated equity lines that are not accounts: the profit not yet closed, the translation difference */
  extraEquity?: { profit: number; cta: number };
}

const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

/** One line per account across the companies: by code, else by name. */
export const lineKey = (section: LineSection, acc: Omit<LineAccount, 'id'>) =>
  `${section}|${acc.code && String(acc.code).trim() ? `code:${norm(String(acc.code))}` : `name:${norm(acc.name || '')}`}`;

export function groupAccountLines(members: MemberAccounts[]): GroupAccountLine[] {
  const lines = new Map<string, GroupAccountLine>();
  const add = (key: string, section: LineSection, name: string, code: string | undefined, workspaceId: string, cents: number) => {
    const line = lines.get(key) || { key, section, name, ...(code ? { code } : {}), byMember: {}, total: 0 };
    if (line.name !== name && !line.alsoNamed?.includes(name)) line.alsoNamed = [...(line.alsoNamed || []), name];
    line.byMember[workspaceId] = (line.byMember[workspaceId] || 0) + cents;
    line.total += cents;
    lines.set(key, line);
  };
  for (const m of members) {
    const byId = new Map(m.accounts.map(a => [a.id, a]));
    for (const section of SECTIONS) {
      for (const [id, cents] of Object.entries(m.sections[section] || {})) {
        const acc = byId.get(id);
        if (!acc || !cents) continue;
        const code = acc.code && String(acc.code).trim() ? String(acc.code).trim() : undefined;
        add(lineKey(section, acc), section, acc.name, code, m.workspaceId, Math.round(cents * m.rate(section)));
      }
    }
    if (m.extraEquity?.profit) add('equity|profit', 'equity', 'Profit not yet closed into equity', undefined, m.workspaceId, m.extraEquity.profit);
    if (m.extraEquity?.cta) add('equity|cta', 'equity', 'Translation difference', undefined, m.workspaceId, m.extraEquity.cta);
  }
  const order = (l: GroupAccountLine) => SECTIONS.indexOf(l.section);
  return [...lines.values()].sort((a, b) => order(a) - order(b) || (a.code || '￿').localeCompare(b.code || '￿', undefined, { numeric: true }) || a.name.localeCompare(b.name));
}
