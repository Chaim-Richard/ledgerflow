/**
 * Required labels (Z-12): a workspace can say that entries on some accounts must carry a label,
 * e.g. "Property is required on Utilities" or "Project is required on Construction". The rule sits
 * on the label's own definition (`requiredOn` in Settings → Dimensions): the accounts, and the day it
 * applies from, so older entries are not suddenly flagged. Nothing is required unless a rule is set,
 * so simple books see nothing new.
 *
 * A line counts as labelled when `getLineDimension` finds a value for it (on the line, in its tags or
 * on the entry), or when every split of the line has one. Missing labels are a Data Health finding
 * that opens the entry, gone once it is labelled, and a warning in the journal form before saving.
 * Postable entries only (AGENTS.md): drafts and voided entries are never flagged.
 */
import type { ChartAccount, DimensionDefinition, Transaction, TransactionLine } from '../types';
import { getLineDimension } from './dimensionUtils';
import { isPostable } from './txFilters';

export interface RequiredOn {
  /** the accounts whose lines need this label */
  accountIds: string[];
  /** YYYY-MM-DD: entries dated before it are not checked */
  since: string;
}

export interface MissingLabel {
  transactionId: string;
  date: string;
  description: string;
  accountId: string;
  accountName: string;
  dimensionId: string;
  dimensionName: string;
}

type LineLike = Pick<TransactionLine, 'accountId' | 'dimensions' | 'class' | 'location' | 'project' | 'department' | 'tags' | 'splitAllocations' | 'accountName'>;

/** The label rules of a workspace (only labels with at least one account). */
export function requiredLabelRules(dimensions: DimensionDefinition[] | undefined) {
  return (dimensions || []).flatMap(d => (d.id !== 'category' && d.requiredOn?.accountIds?.length
    ? [{ dimensionId: d.id, dimensionName: d.name || d.id, accountIds: new Set(d.requiredOn.accountIds), since: d.requiredOn.since || '' }]
    : []));
}

function hasLabel(line: LineLike, tx: Pick<Transaction, 'tags' | 'dimensions' | 'projectId' | 'classId' | 'locationId'> | undefined, dimensionId: string): boolean {
  if (getLineDimension(line as TransactionLine, tx as Transaction | undefined, dimensionId) !== 'Unassigned') return true;
  const splits = line.splitAllocations || [];
  return splits.length > 0 && splits.every(s => Boolean(s.dimensions?.[dimensionId]));
}

/** The required labels missing on one entry (one per label and account). */
export function missingLabels(tx: Transaction, dimensions: DimensionDefinition[] | undefined, accounts: Pick<ChartAccount, 'id' | 'name'>[] = []): MissingLabel[] {
  const rules = requiredLabelRules(dimensions);
  if (rules.length === 0 || !isPostable(tx)) return [];
  const date = String(tx.date || '').slice(0, 10);
  const name = new Map(accounts.map(a => [a.id, a.name]));
  const found = new Map<string, MissingLabel>();
  for (const rule of rules) {
    if (rule.since && date < rule.since) continue;
    for (const line of tx.lines || []) {
      if (!rule.accountIds.has(line.accountId) || hasLabel(line, tx, rule.dimensionId)) continue;
      const key = `${rule.dimensionId}|${line.accountId}`;
      if (!found.has(key)) found.set(key, {
        transactionId: tx.id, date, description: tx.description || '', accountId: line.accountId,
        accountName: name.get(line.accountId) || line.accountName || 'an account', dimensionId: rule.dimensionId, dimensionName: rule.dimensionName,
      });
    }
  }
  return [...found.values()];
}

/**
 * For a form before it is saved: "Project is required on Utilities (line 2)". `lines` are the form's
 * lines with an account; `date` is the entry's date.
 */
export function requiredLabelWarnings(lines: LineLike[], date: string, dimensions: DimensionDefinition[] | undefined, accounts: Pick<ChartAccount, 'id' | 'name'>[] = []): string[] {
  const rules = requiredLabelRules(dimensions);
  if (rules.length === 0) return [];
  const name = new Map(accounts.map(a => [a.id, a.name]));
  const warnings: string[] = [];
  for (const rule of rules) {
    if (rule.since && date.slice(0, 10) < rule.since) continue;
    lines.forEach((line, i) => {
      if (line.accountId && rule.accountIds.has(line.accountId) && !hasLabel(line, undefined, rule.dimensionId)) {
        warnings.push(`${rule.dimensionName} is required on ${name.get(line.accountId) || line.accountName || 'this account'} (line ${i + 1})`);
      }
    });
  }
  return warnings;
}

/** The definitions with this label's rule changed: no accounts means no rule. */
export function withRequiredOn(dimensions: DimensionDefinition[], dimensionId: string, requiredOn: RequiredOn | undefined): DimensionDefinition[] {
  return dimensions.map(d => {
    if (d.id !== dimensionId) return d;
    const { requiredOn: _old, ...rest } = d;
    return requiredOn && requiredOn.accountIds.length > 0 ? { ...rest, requiredOn: { accountIds: [...new Set(requiredOn.accountIds)], since: requiredOn.since } } : rest;
  });
}
