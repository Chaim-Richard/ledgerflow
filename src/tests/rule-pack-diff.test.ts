/**
 * A-60: the rule-pack diff a person reviews. What the test holds: an added, an ended and a changed
 * rule (dates and rates) each appear with the field, what it was and what it now is; a change that
 * nothing a review reads (an unchanged rule) is counted, not listed; the report says a change is what
 * the packs now say, never a reviewed answer; and the snapshot of the real packs parses with the
 * fields the diff compares.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { diffRuleSnapshots, diffIsEmpty, packDiffMarkdown, snapshotRule, RULE_DIFF_FIELDS, type RuleSnapshot } from '../lib/rules/packDiff';
import { taxRulePacks } from '../lib/rules/packs/index';
import type { Rule } from '../lib/rules/rules';
import type { TaxEffect } from '../lib/rules/packs/shared';

const rateRule = (id: string, input: Partial<Rule<TaxEffect>> & { rate?: number } = {}): Rule<TaxEffect> => ({
  id,
  name: `rule ${id}`,
  scope: 'line',
  when: [{ attribute: 'state', op: 'in', values: ['TX'] }],
  combine: 'accumulate',
  effect: { kind: 'rate', level: 'state', name: `rule ${id}`, rate: input.rate ?? 0.0625 },
  validFrom: '2025-01-01',
  source: { authority: 'Texas Comptroller', url: 'https://comptroller.texas.gov/' },
  status: 'calculation',
  ...input,
} as Rule<TaxEffect>);

const snapshot = (rules: Array<[string, Rule<TaxEffect>]>) => rules.map(([pack, rule]) => snapshotRule(pack, rule));

test('a snapshot keeps the fields a review reads, and only those', () => {
  const rule = rateRule('us-sales-tx', { validTo: '2026-12-31', rate: 0.07 });
  const shot = snapshotRule('us-sales-tax', rule);
  assert.deepEqual(Object.keys(shot).sort(), ['combine', 'effectKind', 'id', 'isRate', 'name', 'pack', 'rate', 'scope', 'sourceUrl', 'validFrom', 'validTo', 'when']);
  assert.equal(shot.rate, 0.07);
  assert.equal(shot.sourceUrl, 'https://comptroller.texas.gov/');
  assert.deepEqual(shot.when, ['state=TX']);
  for (const field of RULE_DIFF_FIELDS) assert.ok(field in shot || field === 'validTo', `the diff compares a field the snapshot keeps: ${field}`);
});

test('added, ended and changed rules are each reported with what a person needs', () => {
  const before = snapshot([
    ['us-sales-tax', rateRule('us-sales-tx')],
    ['us-sales-tax', rateRule('us-sales-ny', { rate: 0.04, when: [{ attribute: 'state', op: 'in', values: ['NY'] }] })],
    ['us-sales-tax', rateRule('us-sales-ca')],
  ]);
  const after = snapshot([
    ['us-sales-tax', rateRule('us-sales-tx', { rate: 0.07, validTo: '2026-12-31' })],
    ['us-sales-tax', rateRule('us-sales-ny', { rate: 0.045, when: [{ attribute: 'state', op: 'in', values: ['NY'] }] })],
    ['us-sales-tax', rateRule('us-sales-ca', { combine: 'override', targets: ['us-sales-tx'] })],
  ]);
  const diff = diffRuleSnapshots(before, after, { beforeDate: '2026-10-01', afterDate: '2026-10-12' });
  assert.equal(diff.added.length, 0);
  assert.equal(diff.ended.length, 0);
  assert.equal(diff.unchanged, 0, 'every rule changed something');
  assert.deepEqual(diff.changed.map(c => c.id).sort(), ['us-sales-ca', 'us-sales-ny', 'us-sales-tx']);
  const texas = diff.changed.find(c => c.id === 'us-sales-tx')!;
  assert.deepEqual(texas.fields.map(f => f.field).sort(), ['rate', 'validTo']);
  assert.equal(texas.fields.find(f => f.field === 'rate')?.before, '0.0625');
  assert.equal(texas.fields.find(f => f.field === 'rate')?.after, '0.07');
  assert.equal(texas.fields.find(f => f.field === 'validTo')?.before, '—');
  const markdown = packDiffMarkdown(diff);
  assert.match(markdown, /6\.25% \| 7%/);
  assert.match(markdown, /not a reviewed tax answer/);
  assert.match(markdown, /\| rule us-sales-ca \| combine \| accumulate \| override \|/);
});

test('a rule that left the packs is listed as ended, never silently dropped', () => {
  const gone = rateRule('us-sales-fl', { name: 'Florida state sales tax', rate: 0.06, validFrom: '2019-01-01', validTo: '2025-12-31' });
  const diff = diffRuleSnapshots(snapshot([['us-sales-tax', gone]]), [], { afterDate: '2026-10-12' });
  assert.equal(diff.ended.length, 1);
  assert.equal(diff.added.length, 0);
  assert.ok(!diffIsEmpty(diff));
  const markdown = packDiffMarkdown(diff);
  assert.match(markdown, /## Rules that ended/);
  assert.match(markdown, /Florida state sales tax/);
  assert.match(markdown, /2019-01-01 \| 2025-12-31 \| 6% /);
});

test('an empty diff says nothing needs review, and a date-only change still lists the dates', () => {
  const rules = snapshot([['us-sales-tax', rateRule('us-sales-tx')]]);
  const same = diffRuleSnapshots(rules, rules, { afterDate: '2026-10-12' });
  assert.ok(diffIsEmpty(same));
  assert.match(packDiffMarkdown(same), /No rule was added, ended or changed/);

  const moved = diffRuleSnapshots(rules, snapshot([['us-sales-tax', rateRule('us-sales-tx', { validFrom: '2026-01-01' })]]), { afterDate: '2026-10-12' });
  assert.equal(moved.changed.length, 1);
  assert.deepEqual(moved.changed[0].fields, [{ field: 'validFrom', before: '2025-01-01', after: '2026-01-01' }]);
});

test('the real packs snapshot to the same shape the diff compares, and a committed snapshot parses', () => {
  const rules = taxRulePacks().flatMap(pack => pack.rules.map(rule => snapshotRule(pack.id, rule)));
  assert.ok(rules.length > 200, `${rules.length} rules snapshotted`);
  assert.equal(new Set(rules.map(r => r.id)).size, rules.length, 'rule ids are unique across the packs');
  assert.ok(rules.every(r => r.sourceUrl.startsWith('https://')));
  assert.ok(rules.every(r => typeof r.isRate === 'boolean'));

  const dir = path.resolve('docs/eval/rule-pack-snapshots');
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    assert.ok(files.length, 'the directory holds at least one snapshot');
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'));
    assert.ok(Array.isArray(parsed.rules) && parsed.rules.length > 200);
    assert.match(parsed.date, /^\d{4}-\d{2}-\d{2}$/);
    const snapshotShape = parsed.rules[0] as RuleSnapshot;
    for (const field of ['pack', 'id', 'name', 'validFrom', 'effectKind', 'sourceUrl', 'when']) {
      assert.ok(field in snapshotShape, `the committed snapshot keeps ${field}`);
    }
  }
});
