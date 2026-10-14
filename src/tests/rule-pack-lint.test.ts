/**
 * A-110: the rule pack linter. What the test holds: every rule in every pack passes the shape check
 * (id, name, scope, conditions, validFrom, source url, status, targets), the linter really fails on a
 * broken rule rather than returning nothing, and the packs' own guard still passes — so a pack that
 * ships a rule with no source cannot land.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { lintRule, lintRules, ruleLintLines, ruleLintSummary, type RuleLintField, type RuleLintProblem } from '../lib/rules/lint';
import { taxRulePacks, allTaxRules, taxRulePackProblems } from '../lib/rules/packs/index';
import type { Rule } from '../lib/rules/rules';

const good: Rule<{ kind: 'rate' }> = {
  id: 'test-good',
  name: 'A good rule',
  scope: 'line',
  when: [{ attribute: 'state', op: 'in', values: ['TX'] }],
  combine: 'accumulate',
  effect: { kind: 'rate' },
  validFrom: '2026-01-01',
  source: { authority: 'A Department', url: 'https://example.gov/rates' },
  status: 'calculation',
};

const fieldsOf = (problems: RuleLintProblem[]) => problems.map(p => p.field);

test('a well-formed rule has no problems, and the summary counts what was read', () => {
  assert.deepEqual(lintRule(good), []);
  assert.equal(ruleLintSummary([good], []), '1 rule(s) checked, 0 problem(s)');
});

test('every promise a rule makes is checked, one defect at a time', () => {
  const cases: Array<[{ [key: string]: unknown }, RuleLintField]> = [
    [{ id: '' }, 'id'],
    [{ name: '  ' }, 'name'],
    [{ scope: 'workspace' }, 'scope'],
    [{ when: [] }, 'when'],
    [{ validFrom: '2026' }, 'validFrom'],
    [{ validFrom: undefined }, 'validFrom'],
    [{ validTo: '2025-12-31' }, 'validTo'],
    [{ validTo: 'next year' }, 'validTo'],
    [{ status: 'draft' }, 'status'],
    [{ status: 'reviewed' }, 'status'],
    [{ combine: 'replace' }, 'shape'],
    [{ effect: undefined }, 'shape'],
    [{ source: undefined }, 'source'],
    [{ source: { authority: '', url: 'https://example.gov' } }, 'source'],
    [{ source: { authority: 'A Department', url: 'http://example.gov' } }, 'source'],
    [{ source: { authority: 'A Department', url: 'https://example.gov', retrieved: 'yesterday' } }, 'source'],
    [{ combine: 'exclude', targets: [] }, 'targets'],
  ];
  for (const [broken, field] of cases) {
    const problems = lintRule({ ...good, ...broken });
    assert.ok(fieldsOf(problems).includes(field), `${JSON.stringify(broken)} should report ${field}, got ${ruleLintLines(problems).join('; ')}`);
  }
});

test('a target that no other rule defines is a problem, and a real one is not', () => {
  const other: Rule<{ kind: 'rate' }> = { ...good, id: 'test-target', combine: 'accumulate' };
  const excluding: Rule<{ kind: 'rate' }> = { ...good, id: 'test-exclude', combine: 'exclude', targets: ['test-target'] };
  assert.deepEqual(lintRules([other, excluding]).filter(p => p.field === 'targets'), []);
  const dangling = lintRules([{ ...excluding, targets: ['never-written'] }]);
  assert.equal(dangling.length, 1);
  assert.match(dangling[0].problem, /never-written/);
});

test('the same id twice is a duplicate, and a rule written by another lane may say reviewed', () => {
  assert.deepEqual(fieldsOf(lintRules([good, good])), ['duplicate-id']);
  assert.deepEqual(lintRule({ ...good, status: 'filing-ready' }, { requireCalculationStatus: false }), []);
  assert.deepEqual(fieldsOf(lintRule({ ...good, status: 'filing-ready' })), ['status']);
});

test('every rule in every pack passes the linter, and the packs still hold to their promises', () => {
  // one list, so a target may name a rule in another pack (an exemption switching off a state rate)
  const problems = lintRules(allTaxRules());
  assert.deepEqual(ruleLintLines(problems), []);
  for (const pack of taxRulePacks()) {
    assert.deepEqual(ruleLintLines(lintRules(pack.rules, { pack: pack.id }).filter(p => p.field !== 'targets')), [], pack.id);
  }
  assert.deepEqual(taxRulePackProblems(), []);
  assert.ok(allTaxRules().length > 200, `the packs carry the tables: ${allTaxRules().length} rules`);
  for (const rule of allTaxRules()) {
    assert.ok(rule.id && rule.name, `a rule without an id or a name: ${JSON.stringify(rule.id)}`);
    assert.ok(rule.scope, rule.id);
    assert.match(rule.validFrom, /^\d{4}-\d{2}-\d{2}$/, rule.id);
    assert.match(rule.source.url, /^https:\/\//, rule.id);
    assert.equal(rule.status, 'calculation', rule.id);
  }
});
