import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReturnAuthorization,
  returnAuthorizationCapacityProblem,
  type ReturnAuthorizationRecord,
} from '../lib/warehouseRecords';

const scope = { workspaceId: 'ws-1', customerId: 'cust-1', invoiceId: 'inv-1' };
const line = (quantity: number, soldQuantity = 5) => ({
  invoiceLineId: 'line-1', itemId: 'item-1', description: 'Blue widget', quantity, soldQuantity,
});
function existing(quantity: number, status: ReturnAuthorizationRecord['status'] = 'requested'): ReturnAuthorizationRecord {
  return { ...createReturnAuthorization({
    ...scope, id: 'rma_abc123', number: 'RMA-TEST-1', customerName: 'Customer',
    invoiceNumber: 'INV-1', reason: 'Wrong size', lines: [line(quantity)],
    actor: { uid: 'staff-1', name: 'Staff', role: 'bookkeeper' }, at: '2026-10-16T10:00:00.000Z',
  }), status };
}
const check = (quantity: number, saved: ReturnAuthorizationRecord[], soldQuantity = 5) =>
  returnAuthorizationCapacityProblem({ ...scope, lines: [line(quantity, soldQuantity)] }, saved);

test('RMA cumulative cap reserves previous requests, approvals, received and closed returns', () => {
  for (const status of ['requested', 'approved', 'received', 'closed'] as const) {
    const old = existing(3, status);
    assert.match(check(3, [old]) || '', /3\.00 already requested or returned; only 2\.00/);
    assert.equal(check(2, [old]), null);
  }
  assert.equal(check(5, [existing(5, 'declined')]), null, 'a declined request no longer reserves quantity');
  assert.match(check(0.01, [existing(5)]) || '', /only 0\.00/);
});

test('RMA cumulative cap isolates invoice and customer / workspace; checks combined records', () => {
  const first = existing(1.25);
  const second = { ...existing(2.5), id: 'rma_other' };
  assert.equal(check(1.25, [first, second]), null);
  assert.match(check(1.26, [first, second]) || '', /only 1\.25/);
  assert.equal(check(5, [{ ...first, workspaceId: 'ws-2' }]), null);
  assert.equal(check(5, [{ ...first, customerId: 'cust-2' }]), null);
  assert.equal(check(5, [{ ...first, invoiceId: 'inv-2' }]), null);
});

test('RMA cap refuses unsafe/unsupported precision rather than silently permitting over-returns', () => {
  assert.match(check(0.01, [{ ...existing(2), lines: [{ ...existing(2).lines[0], quantity: 0.333 }] }]) || '', /cannot be verified/);
  assert.match(check(0.01, [], 5.001) || '', /cannot be verified/);
  assert.match(check(0.001, []) || '', /cannot be verified/);
  assert.equal(check(0.1, [existing(4.9)]), null, 'two-decimal integer units sum exactly');
  assert.match(check(0.11, [existing(4.9)]) || '', /only 0\.10/);
  assert.match(check(1, [{ ...existing(1), lines: [{ ...existing(1).lines[0], quantity: Number.MAX_SAFE_INTEGER }] }]) || '', /cannot be verified/);
});
