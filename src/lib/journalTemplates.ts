/**
 * Journal entry templates (BD-09 / CA-27): an entry made again and again (monthly accruals,
 * payroll journals, depreciation by hand) saved once under a name, then picked to start a new
 * entry. A template keeps the accounts, the side and, if typed, the amounts of each line; amounts
 * left out are typed each time. Nothing is posted from a template: it only fills the journal form.
 */
import type { JournalLine } from '../types';

export const JOURNAL_TEMPLATE_KIND = 'journalTemplate';

export interface TemplateLine { accountId: string; debitCents: number; creditCents: number; dimensions?: Record<string, string> }

export interface JournalTemplateInput { name: string; description?: string; adjusting?: boolean; lines: TemplateLine[] }

export interface JournalTemplate extends JournalTemplateInput {
  id: string;
  workspaceId: string;
  kind: typeof JOURNAL_TEMPLATE_KIND;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const MAX_TEMPLATE_LINES = 100;

const wholeCents = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

/** What is wrong with a template, or null. `accountIds`: the workspace's accounts. */
export function templateProblem(input: JournalTemplateInput, accountIds: Set<string>): string | null {
  const name = (input.name || '').trim();
  if (!name) return 'Give the template a name';
  if (name.length > 60) return 'Template names are at most 60 characters';
  if ((input.description || '').length > 200) return 'The description is at most 200 characters';
  const lines = input.lines || [];
  if (lines.length < 2) return 'A template needs at least two lines with an account';
  if (lines.length > MAX_TEMPLATE_LINES) return `A template has at most ${MAX_TEMPLATE_LINES} lines`;
  for (const [i, l] of lines.entries()) {
    if (!l.accountId || !accountIds.has(l.accountId)) return `Line ${i + 1}: choose an account of this workspace`;
    if (!wholeCents(l.debitCents) || !wholeCents(l.creditCents)) return `Line ${i + 1}: amounts must be zero or more`;
    if (l.debitCents > 0 && l.creditCents > 0) return `Line ${i + 1}: a line is a debit or a credit, not both`;
  }
  const debit = lines.reduce((s, l) => s + l.debitCents, 0);
  const credit = lines.reduce((s, l) => s + l.creditCents, 0);
  if (debit !== credit) return 'The amounts do not balance: leave them all empty, or make debits equal credits';
  return null;
}

/** The journal form's lines as template lines: lines without an account are left out. */
export function templateLines(lines: JournalLine[]): TemplateLine[] {
  return lines.filter(l => l.accountId).map(l => {
    const dims = Object.fromEntries(Object.entries(l.dimensions || {}).filter(([, v]) => typeof v === 'string' && v.trim()));
    return {
      accountId: l.accountId,
      debitCents: Math.max(0, Math.round(l.debit || 0)),
      creditCents: Math.max(0, Math.round(l.credit || 0)),
      ...(Object.keys(dims).length ? { dimensions: dims } : {}),
    };
  });
}

/**
 * A template's lines for the journal form, named from today's chart of accounts. Lines whose
 * account no longer exists are left out and counted, so the form can say so.
 */
export function formLines(template: Pick<JournalTemplate, 'lines'>, accounts: Array<{ id: string; name: string }>): { lines: JournalLine[]; missing: number } {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const lines: JournalLine[] = [];
  let missing = 0;
  for (const l of template.lines || []) {
    const account = byId.get(l.accountId);
    if (!account) { missing++; continue; }
    lines.push({ accountId: account.id, accountName: account.name, debit: l.debitCents || 0, credit: l.creditCents || 0, dimensions: { ...(l.dimensions || {}) } });
  }
  return { lines, missing };
}

/** "3 lines · 1,200.00" or "3 lines · amounts typed each time". */
export function templateSummary(template: Pick<JournalTemplate, 'lines'>, format: (cents: number) => string): string {
  const total = template.lines.reduce((s, l) => s + l.debitCents, 0);
  return `${template.lines.length} lines · ${total > 0 ? format(total) : 'amounts typed each time'}`;
}
