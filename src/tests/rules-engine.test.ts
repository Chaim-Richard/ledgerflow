/**
 * Automatic rules on existing entries: every condition, every action, priority order, "stop after
 * this rule", drafts and voids untouched, and the dry run that the rules screen shows before
 * anything changes. Rules never change amounts (L-177).
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyRuleAction, dryRunRules, evaluateRuleCondition, executeRulesOnTransactions, sortRulesByPriority } from '../lib/rulesEngine';
import type { AutoRule, Transaction } from '../types';
import { makeTransaction } from './fixtures';

const rule = (id: string, condition: AutoRule['condition'], action: AutoRule['action'] = {}, extra: Partial<AutoRule> = {}): AutoRule =>
  ({ id, uid: 'u1', name: `Rule ${id}`, condition, action, ...extra } as AutoRule);
const tx = (overrides: Partial<Transaction>): Transaction => makeTransaction({
  id: 't', date: '2026-05-10', description: 'GITHUB INC SUBSCRIPTION', payee: 'GitHub', totalAmountCents: 2500, status: 'completed',
  lines: [{ id: 'l1', accountId: 'sw', accountName: 'Software', category: 'Software', amountCents: 2500, tags: ['old'] }, { id: 'l2', accountId: 'bank', accountName: 'Bank', amountCents: -2500 }],
  ...overrides,
});

describe('Rule conditions', () => {
  const t = tx({});
  const matches = (condition: AutoRule['condition'], target = t) => evaluateRuleCondition(rule('r', condition), target);

  test('text: contains, starts with, vendor (description or payee), case-insensitive', () => {
    assert.equal(matches({ descriptionContains: 'subscription' }), true);
    assert.equal(matches({ descriptionContains: 'github' }), true);
    assert.equal(matches({ descriptionContains: 'aws' }), false);
    assert.equal(matches({ descriptionStartsWith: 'GITHUB' }), true);
    assert.equal(matches({ descriptionStartsWith: 'subscription' }), false);
    assert.equal(matches({ vendor: 'github' }), true);
    assert.equal(matches({ vendor: 'gitlab' }), false);
    assert.equal(matches({ descriptionContains: '   ' }), true, 'blank conditions are ignored');
  });

  test('project and category on the entry or its lines', () => {
    assert.equal(matches({ project: 'apollo' }, tx({ projectId: 'Apollo-1' })), true);
    assert.equal(matches({ project: 'apollo' }, tx({ lines: [{ id: 'x', accountId: 'a', amountCents: 0, project: 'apollo launch' }] })), true);
    assert.equal(matches({ project: 'apollo' }), false);
    assert.equal(matches({ category: 'software' }), true);
    assert.equal(matches({ category: 'rent' }), false);
  });

  test('amounts: at least, exactly (dollars), between (cents); dates', () => {
    assert.equal(matches({ amountThreshold: 25 }), true);
    assert.equal(matches({ amountThreshold: 25.01 }), false);
    assert.equal(matches({ exactAmount: 25 }), true);
    assert.equal(matches({ exactAmount: 24.99 }), false);
    assert.equal(matches({ minAmountCents: 2500, maxAmountCents: 2500 }), true);
    assert.equal(matches({ minAmountCents: 2501 }), false);
    assert.equal(matches({ maxAmountCents: 2499 }), false);
    assert.equal(matches({ dateRange: { start: '2026-05-01', end: '2026-05-31' } }), true);
    assert.equal(matches({ dateRange: { start: '2026-06-01', end: '2026-06-30' } }), false);
  });

  test('an inactive rule or a rule without a condition never matches', () => {
    assert.equal(evaluateRuleCondition(rule('r', { vendor: 'github' }, {}, { isActive: false }), t), false);
    assert.equal(evaluateRuleCondition({ ...rule('r', {}), condition: undefined } as unknown as AutoRule, t), false);
  });
});

describe('Rule actions', () => {
  test('category, account, project, class, location, dimensions and tags on every line', () => {
    const { modifiedTx, changes } = applyRuleAction(rule('r', {}, {
      targetCategory: 'Dev Tools', targetNodeId: 'tools', targetProject: 'P9', targetClass: 'eng', targetLocation: 'TLV',
      targetDimensions: { dept: 'rnd' }, targetTags: ['saas'], addTags: ['monthly'], removeTags: ['old'],
    }), tx({ tags: ['old', 'keep'] }));
    const line = modifiedTx.lines[0];
    assert.deepEqual([line.category, line.accountId, line.project, line.class, line.location], ['Dev Tools', 'tools', 'P9', 'eng', 'TLV']);
    assert.deepEqual(line.dimensions, { dept: 'rnd' });
    assert.deepEqual(line.tags, ['saas', 'monthly']);
    assert.equal(modifiedTx.projectId, 'P9');
    assert.deepEqual(modifiedTx.tags, ['keep', 'monthly']);
    assert.deepEqual(changes, ['Set project to "P9"', 'Added tags: monthly', 'Removed tags: old', 'Categorized to "Dev Tools"']);
  });

  test('flag, prefix, suffix (once), notes; never the amount', () => {
    const r = rule('r', {}, { flagForReview: true, descriptionPrefix: '[SaaS] ', descriptionSuffix: ' (auto)', setNotes: 'Check plan', setAmountCents: 99 });
    const once = applyRuleAction(r, tx({})).modifiedTx;
    assert.equal(once.status, 'flagged');
    assert.equal(once.description, '[SaaS] GITHUB INC SUBSCRIPTION (auto)');
    assert.equal(once.metadata?.notes, 'Check plan');
    assert.equal(once.totalAmountCents, 2500, 'the amount stays');
    assert.equal(applyRuleAction(r, once).modifiedTx.description, '[SaaS] GITHUB INC SUBSCRIPTION (auto)', 'not added twice');
    assert.deepEqual(applyRuleAction({ ...r, action: undefined } as unknown as AutoRule, tx({})).changes, []);
  });
});

describe('Running rules', () => {
  const entries = [
    tx({ id: 'a' }),
    tx({ id: 'b', description: 'AWS EMEA', payee: 'Amazon' }),
    tx({ id: 'd', status: 'draft' }),
    tx({ id: 'v', status: 'void' }),
  ];

  test('priority order; "stop after this rule"; drafts and voids are not touched', () => {
    const rules = [
      rule('low', { vendor: 'github' }, { addTags: ['second'] }, { priority: 50 }),
      rule('high', { vendor: 'github' }, { targetCategory: 'Software' }, { priority: 1 }),
      rule('off', { vendor: 'github' }, { addTags: ['never'] }, { isActive: false }),
      rule('default', { vendor: 'amazon' }, { targetCategory: 'Cloud' }),
    ];
    assert.deepEqual(sortRulesByPriority(rules).map(r => r.id), ['high', 'low', 'off', 'default']);
    const run = dryRunRules(rules, entries);
    assert.equal(run.summary.totalScanned, 2);
    assert.deepEqual(run.matches.map(m => [m.transactionId, m.matchedRule.id]), [['a', 'high'], ['a', 'low'], ['b', 'default']]);
    assert.deepEqual(run.summary.rulesTriggered, { high: 1, low: 1, default: 1 });
    assert.deepEqual(run.matches[1].txModified.tags, ['second'], 'the second rule builds on the first');

    const stopped = dryRunRules([{ ...rules[1], stopProcessingOnMatch: true }, rules[0]], entries);
    assert.deepEqual(stopped.matches.map(m => m.matchedRule.id), ['high']);
  });

  test('applying saves each change and writes one audit line per change', async () => {
    const saved: string[] = [];
    const audit: string[] = [];
    const result = await executeRulesOnTransactions(
      [rule('cat', { vendor: 'amazon' }, { targetCategory: 'Cloud' })], entries,
      t => { saved.push(t.id); }, (action, details) => { audit.push(`${action}: ${details}`); });
    assert.deepEqual(saved, ['b']);
    assert.deepEqual([result.processedCount, result.modifiedCount], [2, 1]);
    assert.match(audit[0], /^APPLY_AUTO_RULE: Applied rule "Rule cat" to transaction b: Categorized to "Cloud"$/);
    const quiet = await executeRulesOnTransactions([rule('cat', { vendor: 'amazon' }, { targetCategory: 'Cloud' })], entries, () => {});
    assert.equal(quiet.modifiedCount, 1);
  });
});
