import { AutoRule, Transaction, TransactionLine } from '../types';
import { isPostable, isTransactionInDateRange } from './txFilters';

/**
 * Pure-math Rules Evaluation & Backfill Engine
 * Handles condition matching, action execution, dry-run simulation, and batch reprocessing.
 */

export const ruleGroupName = (rule: AutoRule): string => rule.groupName || 'General';

/** Missing group flags keep legacy rules enabled. A disabled member gates the whole group. */
export function disabledRuleGroups(rules: AutoRule[]): Set<string> {
  return new Set(rules.filter(rule => rule.groupIsActive === false).map(ruleGroupName));
}

export function sortRulesByPriority(rules: AutoRule[]): AutoRule[] {
  return [...rules].sort((a, b) => {
    const priorityA = a.priority ?? 100;
    const priorityB = b.priority ?? 100;
    return priorityA - priorityB;
  });
}

export function evaluateRuleCondition(rule: AutoRule, tx: Transaction): boolean {
  if (rule.isActive === false || rule.groupIsActive === false) return false;
  const cond = rule.condition;
  if (!cond) return false;

  const desc = (tx.description || '').toLowerCase();
  const payee = (tx.payee || '').toLowerCase();

  // 1. Description contains
  if (cond.descriptionContains && cond.descriptionContains.trim().length > 0) {
    const searchTarget = cond.descriptionContains.trim().toLowerCase();
    if (!desc.includes(searchTarget) && !payee.includes(searchTarget)) {
      return false;
    }
  }

  // 1b. Description starts with
  if (cond.descriptionStartsWith && cond.descriptionStartsWith.trim().length > 0) {
    const searchTarget = cond.descriptionStartsWith.trim().toLowerCase();
    if (!desc.startsWith(searchTarget) && !payee.startsWith(searchTarget)) {
      return false;
    }
  }

  // 2. Vendor / Payee match
  if (cond.vendor && cond.vendor.trim().length > 0) {
    const searchVendor = cond.vendor.trim().toLowerCase();
    if (!payee.includes(searchVendor) && !desc.includes(searchVendor)) {
      return false;
    }
  }

  // 3. Project match
  if (cond.project && cond.project.trim().length > 0) {
    const txProject = (tx.projectId || '').toLowerCase();
    const hasLineProject = tx.lines?.some(l => (l.project || '').toLowerCase().includes(cond.project!.trim().toLowerCase()));
    if (!txProject.includes(cond.project.trim().toLowerCase()) && !hasLineProject) {
      return false;
    }
  }

  // 4. Category match
  if (cond.category && cond.category.trim().length > 0) {
    const targetCat = cond.category.trim().toLowerCase();
    const hasCat = tx.lines?.some(l => (l.category || '').toLowerCase().includes(targetCat) || (l.accountName || '').toLowerCase().includes(targetCat));
    if (!hasCat) return false;
  }

  // 5. Amount threshold (>= amount in dollars/cents)
  const amountDollars = (tx.totalAmountCents || 0) / 100;
  if (cond.amountThreshold !== undefined && cond.amountThreshold !== null && cond.amountThreshold > 0) {
    if (amountDollars < cond.amountThreshold) return false;
  }

  // 6. Exact amount match (in dollars)
  if (cond.exactAmount !== undefined && cond.exactAmount !== null && cond.exactAmount > 0) {
    if (Math.abs(amountDollars - cond.exactAmount) > 0.009) return false;
  }

  // 6b. Min / Max amount cents
  if (cond.minAmountCents !== undefined && cond.minAmountCents > 0) {
    if ((tx.totalAmountCents || 0) < cond.minAmountCents) return false;
  }
  if (cond.maxAmountCents !== undefined && cond.maxAmountCents > 0) {
    if ((tx.totalAmountCents || 0) > cond.maxAmountCents) return false;
  }

  // 7. Date range match
  if (cond.dateRange?.start || cond.dateRange?.end) {
    if (!isTransactionInDateRange(tx, cond.dateRange.start, cond.dateRange.end)) {
      return false;
    }
  }

  return true;
}

export function applyRuleAction(rule: AutoRule, tx: Transaction): { modifiedTx: Transaction; changes: string[] } {
  const changes: string[] = [];
  const act = rule.action;
  if (!act) return { modifiedTx: tx, changes };

  const updatedLines: TransactionLine[] = (tx.lines || []).map(line => {
    const newLine: TransactionLine = { ...line };

    if (act.targetCategory && line.category !== act.targetCategory) {
      newLine.category = act.targetCategory;
    }

    if (act.targetNodeId && line.accountId !== act.targetNodeId) {
      newLine.accountId = act.targetNodeId;
    }

    if (act.targetProject && line.project !== act.targetProject) {
      newLine.project = act.targetProject;
    }

    if (act.targetClass && line.class !== act.targetClass) {
      newLine.class = act.targetClass;
    }

    if (act.targetLocation && line.location !== act.targetLocation) {
      newLine.location = act.targetLocation;
    }

    if (act.targetDimensions) {
      newLine.dimensions = { ...(newLine.dimensions || {}), ...act.targetDimensions };
    }

    if (act.targetTags && act.targetTags.length > 0) {
      const existingTags = new Set(newLine.tags || []);
      act.targetTags.forEach(t => existingTags.add(t));
      newLine.tags = Array.from(existingTags);
    }

    if (act.addTags && act.addTags.length > 0) {
      const existingTags = new Set(newLine.tags || []);
      act.addTags.forEach(t => existingTags.add(t));
      newLine.tags = Array.from(existingTags);
    }

    if (act.removeTags && act.removeTags.length > 0) {
      const removeSet = new Set(act.removeTags);
      newLine.tags = (newLine.tags || []).filter(t => !removeSet.has(t));
    }

    return newLine;
  });

  const modifiedTx: Transaction = {
    ...tx,
    lines: updatedLines
  };

  // Transaction level updates
  if (act.flagForReview) {
    modifiedTx.status = 'flagged';
    changes.push('Flagged for review');
  }

  if (act.targetProject && tx.projectId !== act.targetProject) {
    modifiedTx.projectId = act.targetProject;
    changes.push(`Set project to "${act.targetProject}"`);
  }

  if (act.descriptionPrefix && !modifiedTx.description.startsWith(act.descriptionPrefix)) {
    modifiedTx.description = `${act.descriptionPrefix}${modifiedTx.description}`;
    changes.push(`Prefixed description with "${act.descriptionPrefix}"`);
  }

  if (act.descriptionSuffix && !modifiedTx.description.endsWith(act.descriptionSuffix)) {
    modifiedTx.description = `${modifiedTx.description}${act.descriptionSuffix}`;
    changes.push(`Suffixed description with "${act.descriptionSuffix}"`);
  }

  if (act.setNotes) {
    modifiedTx.metadata = {
      ...(modifiedTx.metadata || {}),
      notes: act.setNotes
    };
    changes.push(`Added notes: "${act.setNotes}"`);
  }

  if (act.addTags && act.addTags.length > 0) {
    const existingTags = new Set(modifiedTx.tags || []);
    act.addTags.forEach(t => existingTags.add(t));
    modifiedTx.tags = Array.from(existingTags);
    changes.push(`Added tags: ${act.addTags.join(', ')}`);
  }

  if (act.removeTags && act.removeTags.length > 0) {
    const removeSet = new Set(act.removeTags);
    modifiedTx.tags = (modifiedTx.tags || []).filter(t => !removeSet.has(t));
    changes.push(`Removed tags: ${act.removeTags.join(', ')}`);
  }

  if (act.targetCategory) {
    changes.push(`Categorized to "${act.targetCategory}"`);
  }

  // setAmountCents is ignored: a rule never changes money. It rewrote the stated total without
  // the posted lines, so the entry and the ledger disagreed (L-177; the AI builder already dropped it).

  return { modifiedTx, changes };
}

export interface DryRunMatch {
  transactionId: string;
  txOriginal: Transaction;
  txModified: Transaction;
  matchedRule: AutoRule;
  changes: string[];
}

export interface DryRunResult {
  matches: DryRunMatch[];
  summary: {
    totalScanned: number;
    totalMatched: number;
    rulesTriggered: Record<string, number>;
  };
}

/**
 * Dry-run test of rules against transaction ledger
 */
export function dryRunRules(rules: AutoRule[], transactions: Transaction[]): DryRunResult {
  const disabledGroups = disabledRuleGroups(rules);
  const sortedRules = sortRulesByPriority(rules.filter(r => r.isActive !== false && !disabledGroups.has(ruleGroupName(r))));
  const matches: DryRunMatch[] = [];
  const rulesTriggered: Record<string, number> = {};

  const postableTransactions = transactions.filter(t => isPostable(t));

  for (const tx of postableTransactions) {
    let currentTx = { ...tx };

    for (const rule of sortedRules) {
      if (evaluateRuleCondition(rule, currentTx)) {
        const { modifiedTx, changes } = applyRuleAction(rule, currentTx);
        if (changes.length > 0) {
          matches.push({
            transactionId: tx.id,
            txOriginal: tx,
            txModified: modifiedTx,
            matchedRule: rule,
            changes
          });
          rulesTriggered[rule.id] = (rulesTriggered[rule.id] || 0) + 1;
          currentTx = modifiedTx;
        }

        if (rule.stopProcessingOnMatch) {
          break;
        }
      }
    }
  }

  return {
    matches,
    summary: {
      totalScanned: postableTransactions.length,
      totalMatched: matches.length,
      rulesTriggered
    }
  };
}

/**
 * Execute rules on existing transactions and persist updates
 */
export async function executeRulesOnTransactions(
  rules: AutoRule[],
  transactions: Transaction[],
  onUpdateTx: (tx: Transaction) => Promise<void> | void,
  onRecordAudit?: (action: string, details: string) => Promise<void> | void
): Promise<{ processedCount: number; modifiedCount: number; updatedTransactions: Transaction[] }> {
  const dryRun = dryRunRules(rules, transactions);
  const updatedTransactions: Transaction[] = [];

  for (const match of dryRun.matches) {
    await onUpdateTx(match.txModified);
    updatedTransactions.push(match.txModified);

    if (onRecordAudit) {
      await onRecordAudit(
        'APPLY_AUTO_RULE',
        `Applied rule "${match.matchedRule.name || match.matchedRule.id}" to transaction ${match.transactionId}: ${match.changes.join(', ')}`
      );
    }
  }

  return {
    processedCount: dryRun.summary.totalScanned,
    modifiedCount: dryRun.matches.length,
    updatedTransactions
  };
}
