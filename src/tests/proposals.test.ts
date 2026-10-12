/**
 * A-35 (CC-03): proposals. Hand-checked: optional items are priced and shown but never added to
 * the required total (2,000 + 1,500 required, 800 optional); refusals are in plain words; the page
 * text lists every item with its arithmetic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalFromEstimate, proposalProblem, proposalText, proposalTotals, type Proposal } from '../lib/proposals';

const proposal: Proposal = {
  estimateId: 'e1',
  customerName: 'Acme',
  title: 'Website rebuild',
  coverLetter: 'As discussed, here is the plan.',
  sections: [
    { id: 's1', title: 'Design', items: [{ description: 'Design', quantity: 2, unitPriceCents: 100_000, amountCents: 200_000 }] },
    { id: 's2', title: 'Build', body: 'Two stages.', items: [
      { description: 'Build', quantity: 1, unitPriceCents: 150_000, amountCents: 150_000 },
      { description: 'Extra workshop', quantity: 1, unitPriceCents: 80_000, amountCents: 80_000, optional: true },
    ] },
  ],
};

test('optional items are priced but stay out of the required total', () => {
  const totals = proposalTotals(proposal.sections);
  assert.deepEqual(totals, { requiredCents: 350_000, optionalCents: 80_000, withOptionalsCents: 430_000, requiredItems: 2, optionalItems: 1 });
  assert.deepEqual(proposalTotals([]), { requiredCents: 0, optionalCents: 0, withOptionalsCents: 0, requiredItems: 0, optionalItems: 0 });
});

test('the refusals say what is missing', () => {
  assert.equal(proposalProblem(proposal), null);
  assert.equal(proposalProblem({ title: '  ', sections: proposal.sections }), 'Give the proposal a title.');
  assert.equal(proposalProblem({ title: 'x', sections: [] }), 'A proposal needs at least one section.');
  assert.equal(proposalProblem({ title: 'x', sections: [{ id: 'a', title: '', items: [{ description: 'd', quantity: 1, unitPriceCents: 1, amountCents: 1 }] }] }), 'Every section needs a title.');
  assert.equal(proposalProblem({ title: 'x', sections: [{ id: 'a', title: 'A', items: [] }] }), 'The section “A” has no items; write “Included” or add an item.');
  assert.equal(proposalProblem({ title: 'x', sections: [{ id: 'a', title: 'A', items: [{ description: ' ', quantity: 1, unitPriceCents: 1, amountCents: 1 }] }] }), 'Every item needs a description.');
  assert.equal(proposalProblem({ title: 'x', sections: [{ id: 'a', title: 'A', items: [{ description: 'd', quantity: 0, unitPriceCents: 1, amountCents: 1 }] }] }), 'The item “d” needs a quantity above zero.');
});

test('the page text shows every item, the optionals and the totals', () => {
  const text = proposalText(proposal, 'ILS');
  const lines = text.split('\n');
  assert.equal(lines[0], 'Website rebuild');
  assert.equal(lines[1], 'Prepared for Acme');
  assert.ok(text.includes('As discussed, here is the plan.'));
  assert.ok(text.includes('Design — 2 × 1000.00 ILS = 2000.00 ILS'));
  assert.ok(text.includes('Extra workshop (optional) — 1 × 800.00 ILS = 800.00 ILS'));
  assert.ok(text.includes('Total: 3500.00 ILS'));
  assert.ok(text.includes('Optional items would add 800.00 ILS (4300.00 ILS with them).'));
  const withoutOptionals = proposalText({ ...proposal, sections: [proposal.sections[0]] }, '');
  assert.ok(withoutOptionals.includes('Total: 2000.00'), 'no currency sign when none is given');
  assert.equal(withoutOptionals.includes('Optional items'), false);
});

test('a proposal can start from an estimate’s lines', () => {
  const fromEstimate = proposalFromEstimate({ id: 'e9', customerName: 'Beta', lines: [{ description: 'Advice', quantity: 3, unitPriceCents: 10_000 }] });
  assert.equal(fromEstimate.estimateId, 'e9');
  assert.equal(fromEstimate.title, 'Proposal for Beta');
  assert.deepEqual(fromEstimate.sections[0].items, [{ description: 'Advice', quantity: 3, unitPriceCents: 10_000, amountCents: 30_000 }]);
  const anonymous = proposalFromEstimate({ id: 'e10' });
  assert.equal(anonymous.title, 'Proposal for the customer');
  assert.equal(proposalTotals(anonymous.sections).requiredCents, 0);
});
