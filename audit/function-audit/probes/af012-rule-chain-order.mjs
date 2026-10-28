/**
 * AF-012 (#161) reproduction: an override chain's result depends on the order of the rule array.
 *
 * Run from the repository root:   npx tsx audit/function-audit/probes/af012-rule-chain-order.mjs
 *
 * Three active rules on the same facts: A overrides B, B overrides C, C accumulates. The documented
 * semantics ("a switched-off rule cannot replace another") do not say what a chain means; the engine
 * answers differently for each order, and a rule that is itself displaced keeps its displacement.
 */
import { evaluateRules } from '../../../src/lib/rules/rules';

const rule = (id, targets, combine) => ({
  id,
  name: id,
  scope: 'line',
  when: [{ attribute: 'country', op: 'in', values: ['IL'] }],
  combine,
  targets,
  effect: id,
  validFrom: '2026-01-01',
  source: { authority: 'audit probe', url: 'https://example.test' },
  status: 'calculation',
});

const rules = [rule('A', ['B'], 'override'), rule('B', ['C'], 'override'), rule('C', [], 'accumulate')];
const composed = { facts: { country: { values: ['IL'], source: 'declared' } }, conflicts: [] };

for (const order of [[0, 1, 2], [1, 0, 2], [2, 1, 0]]) {
  const chosen = order.map(i => rules[i]);
  const out = evaluateRules(chosen, composed, { date: '2026-10-18', scope: 'line' });
  console.log(
    `order ${order.map(i => rules[i].id).join(',')} -> applied ${out.applied.map(a => a.rule.id).join(',') || '(none)'}` +
      ` | displaced ${out.displaced.map(d => `${d.rule.id} by ${d.by}`).join(', ') || '(none)'}`,
  );
}
