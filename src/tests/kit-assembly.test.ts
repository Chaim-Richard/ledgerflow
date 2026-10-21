/**
 * A-116: kits assembled on demand — how many kits the parts on hand can build and what building N
 * takes, against figures worked by hand. Nothing is recorded or posted here.
 *
 * Starter kit = 2 × Part A + 1 × Part B. On hand: A 5, B 3.
 *   → 2 kits from stock (A allows 2, B allows 3); 3 kits would take A 6 (short 1) and B 3.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { kitBuildPlan, kitBuildableSummary, assembleOnDemandOf, assembleOnDemandProblem } from '../lib/kitAssembly';

const kit = { id: 'kit', name: 'Starter kit', bundleParts: [{ itemId: 'a', quantity: 2 }, { itemId: 'b', quantity: 1 }] };
const items = [
  { id: 'a', name: 'Part A', sku: 'A-1', quantityAtHand: 5 },
  { id: 'b', name: 'Part B', sku: 'B-1', quantityAtHand: 3 },
];

test('A-116 two kits can be built from stock; three would take 6 × Part A and fall one short', () => {
  const plan = kitBuildPlan(kit, items, 3);
  assert.equal(plan.buildableKits, 2);
  assert.deepEqual(plan.parts.map(p => [p.itemId, p.perKit, p.onHand, p.buildable, p.shortfallPerKit]), [
    ['a', 2, 5, 2, 0],
    ['b', 1, 3, 3, 0],
  ]);
  assert.equal(plan.requestedKits, 3);
  assert.deepEqual(plan.consumption?.map(c => [c.itemId, c.needed, c.remaining]), [
    ['a', 6, -1],
    ['b', 3, 0],
  ]);
  assert.match(plan.problem || '', /Only 2 kits can be built/);
  assert.match(plan.problem || '', /Part A is short 1/);
});

test('A-116 building what the parts allow has no problem, and the leftovers are on the plan', () => {
  const plan = kitBuildPlan(kit, items, 2);
  assert.equal(plan.problem, null);
  assert.deepEqual(plan.consumption?.map(c => [c.needed, c.remaining]), [[4, 1], [2, 1]]);
  const none = kitBuildPlan(kit, items, 0);
  assert.equal(none.problem, null);
  assert.deepEqual(none.consumption?.map(c => c.remaining), [5, 3]);
});

test('A-116 a part missing from the item list counts as none on hand and names itself', () => {
  const plan = kitBuildPlan({ id: 'kit', name: 'Starter kit', bundleParts: [{ itemId: 'gone', quantity: 4 }] }, items);
  assert.equal(plan.buildableKits, 0);
  assert.deepEqual(plan.parts.map(p => [p.name, p.onHand, p.shortfallPerKit]), [['gone', 0, 4]]);
  assert.match(kitBuildableSummary({ id: 'kit', name: 'Starter kit', bundleParts: [{ itemId: 'gone', quantity: 4 }] }, items), /missing 4 gone per kit/);
});

test('A-116 the summary reads in plain words: "2 kits from stock" or what is missing per kit', () => {
  assert.equal(kitBuildableSummary(kit, items), '2 kits from stock');
  const short = kitBuildableSummary({ id: 'k2', name: 'K2', bundleParts: [{ itemId: 'a', quantity: 7 }] }, items);
  assert.equal(short, '0 kits from stock; missing 2 Part A per kit');
  assert.equal(kitBuildableSummary({ id: 'k3', name: 'K3' }, items), 'no parts');
});

test('A-116 only a bundle can be marked assemble on demand', () => {
  assert.equal(assembleOnDemandOf({ assembleOnDemand: true }), true);
  assert.equal(assembleOnDemandOf({}), false);
  assert.equal(assembleOnDemandProblem(kit, true), null);
  assert.match(assembleOnDemandProblem({ id: 'x', name: 'Plain item' }, true) || '', /Only a bundle/);
  assert.equal(assembleOnDemandProblem({ id: 'x', name: 'Plain item' }, false), null);
});
