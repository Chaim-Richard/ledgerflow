/**
 * Invoice approval on the server (BE-04, L-191): only owners and accountants approve or send back,
 * and the record names them from the server; an invoice going out over the limit without a record
 * gets one, so leaving the field out can't skip the rule.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalRefused, serverApproval } from '../server/services/invoiceApprovalGuard';

const workspace = { uid: 'owner', roles: { acc: 'accountant', book: 'bookkeeper' }, invoiceApproval: { enabled: true, thresholdCents: 100000 } };
const now = '2026-10-05T21:00:00.000Z';
const big = { amountCents: 150000, status: 'pending' };

describe('Who may approve', () => {
  test('a bookkeeper cannot approve or send back, however the request is written', () => {
    for (const state of ['approved', 'rejected'] as const) {
      assert.throws(() => serverApproval({ ...big, approval: { state: 'awaiting', thresholdCents: 100000 } }, { approval: { state, thresholdCents: 100000, decidedBy: 'owner' } }, workspace, 'book', now), ApprovalRefused);
    }
  });

  test('an accountant can, and the record says who and when from the server', () => {
    const out = serverApproval({ ...big, approval: { state: 'awaiting', thresholdCents: 100000 } },
      { approval: { state: 'approved', thresholdCents: 100000, decidedBy: 'someone-else', decidedAt: '2020-01-01' } }, workspace, 'acc', now);
    assert.deepEqual(out.approval, { state: 'approved', thresholdCents: 100000, decidedBy: 'acc', decidedAt: now });
  });

  test('a save that repeats the stored decision unchanged is fine for anyone', () => {
    const stored = { state: 'approved' as const, thresholdCents: 100000, decidedBy: 'owner', decidedAt: '2026-10-01T00:00:00.000Z' };
    assert.deepEqual(serverApproval({ ...big, approval: stored }, { approval: { ...stored }, notes: 'x' }, workspace, 'book', now), {});
  });
});

describe('An invoice going out over the limit always gets a record', () => {
  test('saved issued by a bookkeeper without one: it waits', () => {
    const out = serverApproval(undefined, big, workspace, 'book', now);
    assert.deepEqual(out.approval, { state: 'awaiting', thresholdCents: 100000, requestedAt: now, requestedBy: 'book' });
  });

  test('by the owner: approved by the save itself', () => {
    assert.equal(serverApproval({ ...big, status: 'draft' }, { status: 'pending' }, workspace, 'owner', now).approval?.state, 'approved');
  });

  test('nothing when under the limit, a draft, the rule off, or already out before the rule', () => {
    assert.deepEqual(serverApproval(undefined, { amountCents: 100000, status: 'pending' }, workspace, 'book', now), {}, 'at the limit is not over it');
    assert.deepEqual(serverApproval(undefined, { ...big, status: 'draft' }, workspace, 'book', now), {});
    assert.deepEqual(serverApproval(undefined, big, { ...workspace, invoiceApproval: { enabled: false, thresholdCents: 100000 } }, 'book', now), {});
    assert.deepEqual(serverApproval({ ...big, status: 'sent' }, { notes: 'x' }, workspace, 'book', now), {});
  });
});
