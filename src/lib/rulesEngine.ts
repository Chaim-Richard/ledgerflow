import { AutoRule, ChartAccount, Transaction, TransactionLine } from '../types';
import { resolveAccountRole } from './accountUtils';
import { isCashAccount, isPostable, isTransactionInDateRange } from './txFilters';

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

export interface RuleActionContext { workspaceId: string; accounts: ChartAccount[]; currency?: string }
export interface RuleRecategorization { id: string; bankAccountId: string; toAccountId: string; expectedUpdatedAt?: string }
export interface RuleActionResult { modifiedTx: Transaction; changes: string[]; recategorization?: RuleRecategorization; error?: string }

export const hasFinancialRuleAction = (rule: AutoRule): boolean => !!(rule.action?.targetAccountId || rule.action?.targetTransactionKind);

export const hasOrdinaryRuleAction = (rule: AutoRule): boolean => Object.entries(rule.action).some(([key, value]) =>
  !['targetAccountId', 'targetTransactionKind', 'bankAccountId', 'setAmountCents', 'deleteTransaction'].includes(key) && value !== undefined && value !== false && value !== '' && (!Array.isArray(value) || value.length > 0));

/** Preview the existing recategorize contract; money and the bank-side line never change. */
function previewFinancialAction(rule: AutoRule, tx: Transaction, context?: RuleActionContext): RuleActionResult {
  const refuse = (error: string): RuleActionResult => ({ modifiedTx: tx, changes: [], error });
  if (!context || tx.workspaceId !== context.workspaceId) return refuse('Load the current workspace chart before testing an account action.');
  if (hasOrdinaryRuleAction(rule)) return refuse('Keep account/type actions in a separate rule from tagging and other actions.');
  if (tx.status === 'certified' || tx.isLocked || tx.type === 'reversal' || tx.eventId || tx.parentEventId ||
      ['invoiceId', 'billId', 'paymentId', 'loanId', 'payrollId', 'assetId'].some(key => tx.metadata?.[key])) {
    return refuse('This entry is linked to a document or locked. Use its financial editor.');
  }
  if (tx.lines.length !== 2 || tx.lines.some(line => line.splitAllocations?.length || line.taxAmountCents || line.taxRate) || tx.taxAmountCents) {
    return refuse('Account/type rules support standalone two-line bank entries without tax or splits.');
  }
  if (tx.lines.some(line => !Number.isSafeInteger(line.amountCents)) || tx.lines[0].amountCents === 0 || tx.lines[0].amountCents !== -tx.lines[1].amountCents) {
    return refuse('This entry is not a balanced pair of integer minor amounts.');
  }
  const accounts = new Map(context.accounts.filter(account => account.workspaceId === context.workspaceId).map(account => [account.id, account]));
  const cashLines = tx.lines.filter(line => isCashAccount(accounts.get(line.accountId)));
  const bankId = rule.action.bankAccountId || (cashLines.length === 1 ? cashLines[0].accountId : undefined);
  const bank = bankId && accounts.get(bankId);
  const bankLine = tx.lines.find(line => line.accountId === bankId);
  if (!bank || !isCashAccount(bank) || !bankLine) return refuse('Choose the bank account to preserve; automatic detection needs exactly one cash/bank line.');
  const counter = tx.lines.find(line => line.accountId !== bank.id);
  if (!counter) return refuse('Choose a different counterparty account.');
  const target = accounts.get(rule.action.targetAccountId || counter.accountId);
  if (!target || target.isArchived || target.archived || target.id === bank.id) return refuse('Choose an active, different account from this workspace chart.');
  const transfer = isCashAccount(target);
  const kind = rule.action.targetTransactionKind;
  if (kind === 'transfer' && !transfer) return refuse('A transfer needs an existing bank/cash destination account.');
  const targetRole = resolveAccountRole(target);
  if (kind === 'expense' && (transfer || !['expense', 'cogs'].includes(targetRole) || tx.type === 'income')) return refuse('An expense needs an existing expense/COGS account and an expense or journal entry.');
  const currentCounter = accounts.get(counter.accountId);
  const unit = (account: ChartAccount) => account.currency || context.currency || 'USD';
  if (!currentCounter || unit(currentCounter) !== unit(target) || (transfer && unit(bank) !== unit(target))) return refuse('Choose an account in the same currency; a rule does not convert money.');
  // The current server contract retains this legacy marker; refuse rather than show a false expense.
  if (!transfer && tx.metadata?.isTransfer) return refuse('This entry has a legacy transfer marker. Clear it through the financial editor before applying an expense rule.');
  const lines = tx.lines.map(line => {
    if (line.accountId === bank.id) return line;
    const moved = { ...line, accountId: target.id, accountName: target.name };
    if (transfer) moved.isTransfer = true;
    else delete moved.isTransfer;
    return moved;
  });
  const modifiedTx = { ...tx, lines };
  if (transfer) {
    modifiedTx.isTransfer = true;
    modifiedTx.transferDetails = bankLine.amountCents < 0 ? { fromAccountId: bank.id, toAccountId: target.id } : { fromAccountId: target.id, toAccountId: bank.id };
  } else { delete modifiedTx.isTransfer; delete modifiedTx.transferDetails; }
  if (JSON.stringify(modifiedTx) === JSON.stringify(tx)) return { modifiedTx: tx, changes: [] };
  return { modifiedTx, changes: [`Counterparty account: ${target.name}`, transfer ? 'Classified as transfer' : 'Transfer classification cleared'],
    recategorization: { id: tx.id, bankAccountId: bank.id, toAccountId: target.id, ...(tx.updatedAt ? { expectedUpdatedAt: tx.updatedAt } : {}) } };
}

export function applyRuleAction(rule: AutoRule, tx: Transaction, context?: RuleActionContext): RuleActionResult {
  if (hasFinancialRuleAction(rule)) return previewFinancialAction(rule, tx, context);
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
  recategorization?: RuleRecategorization;
}

export interface DryRunResult {
  matches: DryRunMatch[];
  errors: Array<{ transactionId: string; ruleId: string; message: string }>;
  summary: {
    totalScanned: number;
    totalMatched: number;
    rulesTriggered: Record<string, number>;
  };
}

/**
 * Dry-run test of rules against transaction ledger
 */
export function dryRunRules(rules: AutoRule[], transactions: Transaction[], context?: RuleActionContext): DryRunResult {
  const disabledGroups = disabledRuleGroups(rules);
  const sortedRules = sortRulesByPriority(rules.filter(r => r.isActive !== false && !disabledGroups.has(ruleGroupName(r))));
  const matches: DryRunMatch[] = [];
  const errors: DryRunResult['errors'] = [];
  const rulesTriggered: Record<string, number> = {};

  const postableTransactions = transactions.filter(t => isPostable(t));

  for (const tx of postableTransactions) {
    let currentTx = { ...tx };

    for (const rule of sortedRules) {
      if (evaluateRuleCondition(rule, currentTx)) {
        const { modifiedTx, changes, recategorization, error } = applyRuleAction(rule, currentTx, context);
        if (error) { errors.push({ transactionId: tx.id, ruleId: rule.id, message: error }); break; }
        if (changes.length > 0) {
          matches.push({
            transactionId: tx.id,
            txOriginal: tx,
            txModified: modifiedTx,
            matchedRule: rule,
            changes,
            ...(recategorization ? { recategorization } : {})
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
    errors,
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
  if (rules.some(hasFinancialRuleAction)) throw new Error('Account/type actions must use the validated recategorize service.');
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
