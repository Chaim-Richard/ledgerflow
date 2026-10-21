/**
 * DIM-3: each label kind (Property, Project, Location…) has an accounting role, so balancing is asked for only
 * where the books need it:
 *   - informational (the default): a value on a line says what it is about; nothing has to add up;
 *   - fully attributed: every line of every posted entry carries a value of the label — no "Unassigned";
 *   - self-balancing: fully attributed, and in every posted entry each value's lines net to zero, so each value
 *     has a balance sheet of its own that balances (W5-BS shows it).
 * A line's value is read the one way the reports read it (`getLineDimension`). Postable entries only; an entry that
 * was corrected and its reversal cancel out, so neither is judged. The findings are listed (Data Health) and never
 * refuse a save; the role sits on the label's own definition (Settings → Dimensions).
 */
import type { ChartAccount, DimensionDefinition, Transaction } from '../types';
import { getLineDimension } from './dimensionUtils';
import { isPostable } from './txFilters';

export type LabelRole = NonNullable<DimensionDefinition['role']>;

export const LABEL_ROLES: Record<LabelRole, { name: string; hint: string }> = {
  informational: { name: 'Informational', hint: 'A value says what a line is about; nothing has to add up.' },
  attributed: { name: 'Fully attributed', hint: 'Every line of every entry needs a value.' },
  'self-balancing': { name: 'Self-balancing', hint: 'Every line needs a value, and each value balances in every entry.' },
};

export const labelRole = (d: Pick<DimensionDefinition, 'role'>): LabelRole => d.role || 'informational';

export interface LabelRoleProblem {
  transactionId: string;
  date: string;
  description: string;
  dimensionId: string;
  dimensionName: string;
  kind: 'unlabelled' | 'unbalanced';
  /** unlabelled: the account of a line with no value */
  accountName?: string;
  /** unbalanced: the value and how far its lines are from zero (debit-positive cents) */
  value?: string;
  cents?: number;
}

const UNASSIGNED = 'Unassigned';

/** What one entry does wrong for the labels whose role asks for something (none for informational labels). */
export function labelRoleProblems(tx: Transaction, dimensions: DimensionDefinition[] | undefined, accounts: Pick<ChartAccount, 'id' | 'name'>[] = []): LabelRoleProblem[] {
  if (!isPostable(tx)) return [];
  const accountName = (id: string) => accounts.find(a => a.id === id)?.name || id;
  const base = { transactionId: tx.id, date: String(tx.date || '').slice(0, 10), description: tx.description || 'Entry' };
  return (dimensions || []).filter(d => d.id !== 'category' && labelRole(d) !== 'informational').flatMap(d => {
    const problems: LabelRoleProblem[] = [];
    const net = new Map<string, number>();
    for (const line of tx.lines || []) {
      const value = getLineDimension(line, tx, d.id);
      if (!value || value === UNASSIGNED) {
        problems.push({ ...base, dimensionId: d.id, dimensionName: d.name, kind: 'unlabelled', accountName: accountName(line.accountId) });
        continue;
      }
      net.set(value, (net.get(value) || 0) + (Number(line.amountCents) || 0));
    }
    if (labelRole(d) === 'self-balancing') {
      for (const [value, cents] of [...net.entries()].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
        if (cents !== 0) problems.push({ ...base, dimensionId: d.id, dimensionName: d.name, kind: 'unbalanced', value, cents });
      }
    }
    return problems;
  });
}

/** Every posted entry's problems; an entry that was corrected and its reversal are left out (they cancel). */
export function labelRoleFindings(transactions: Transaction[], dimensions: DimensionDefinition[] | undefined, accounts: Pick<ChartAccount, 'id' | 'name'>[] = []): LabelRoleProblem[] {
  if (!(dimensions || []).some(d => labelRole(d) !== 'informational')) return [];
  const reversed = new Set(transactions.map(t => t.metadata?.reversesTxId || t.metadata?.reversedTransactionId).filter(Boolean));
  return transactions
    .filter(tx => !(tx.reversalEventId || tx.metadata?.isReversal || tx.metadata?.reversesTxId || reversed.has(tx.id)))
    .flatMap(tx => labelRoleProblems(tx, dimensions, accounts));
}

/** The dimensions with one label's role set (informational is stored as no role). */
export function withLabelRole(dimensions: DimensionDefinition[], dimensionId: string, role: LabelRole): DimensionDefinition[] {
  return dimensions.map(d => {
    if (d.id !== dimensionId) return d;
    const { role: _old, ...rest } = d;
    return role === 'informational' ? rest : { ...rest, role };
  });
}
