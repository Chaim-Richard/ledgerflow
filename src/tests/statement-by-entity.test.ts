/**
 * A-72: a statement scoped to one entity label, with worked figures.
 *
 * The numbers below are worked by hand. Customer "Northwind" has two entities:
 *   Entity A: invoice INV-A 1,000.00 on 10 Mar, paid 400.00 on 20 Apr
 *   Entity B: invoice INV-B   600.00 on 15 Mar, unpaid
 *   before the period: invoice INV-A0 250.00 on 1 Jan, Entity A
 *   no entity label: invoice INV-N 90.00 on 5 Mar
 *   a posted payment of 1,000.00 on 25 Apr: 400.00 to INV-A, 600.00 to INV-B
 *   a posted payment of 300.00 on 26 Apr with no allocation (money on account)
 *
 * Whole account, 1 Mar – 30 Apr 2026: opening 250.00, invoices 1,000 + 600 + 90, payments 1,000 + 300
 *   → closing = 250 + 1,690 − 1,300 = 640.00
 * Entity A only: opening 250.00, invoice 1,000, payment 400 → closing 850.00, and the 300.00
 *   unallocated payment is reported as left out.
 * Entity B only: opening 0, invoice 600, payment 600 → closing 0.00.
 * No entity label: opening 0, invoice 90, no payment → closing 90.00.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNLABELLED_ENTITY,
  entityLabelOf,
  entityOptions,
  entityStatementNote,
  matchesEntity,
  scopeStatementDocuments,
} from '../lib/statementByEntity';
import { computeStatement } from '../server/reports/computeReports';
import type { Invoice, Payment } from '../types';

const customer = { id: 'c1', name: 'Northwind', workspaceId: 'ws' } as never;

function invoice(id: string, amountCents: number, date: string, entity?: string): Invoice {
  return {
    id,
    number: id,
    customerId: 'c1',
    workspaceId: 'ws',
    date,
    amountCents,
    status: 'sent',
    lines: entity ? [{ dimensions: { world: entity } }] : [],
  } as unknown as Invoice;
}

function payment(id: string, amountCents: number, date: string, allocations: Array<{ documentId: string; amountCents: number }>): Payment {
  const allocated = allocations.reduce((sum, a) => sum + a.amountCents, 0);
  return {
    id,
    contactId: 'c1',
    contactName: 'Northwind',
    workspaceId: 'ws',
    direction: 'received',
    date,
    amountCents,
    method: 'bank_transfer',
    status: 'posted',
    allocations: allocations.map(a => ({ ...a, documentType: 'invoice' as const })),
    unappliedCents: amountCents - allocated,
  } as unknown as Payment;
}

const invoices = [
  invoice('INV-A0', 25000, '2026-01-01', 'Entity A'),
  invoice('INV-N', 9000, '2026-03-05'),
  invoice('INV-A', 100000, '2026-03-10', 'Entity A'),
  invoice('INV-B', 60000, '2026-03-15', 'Entity B'),
];
const payments = [
  payment('PAY-1', 100000, '2026-04-25', [
    { documentId: 'INV-A', amountCents: 40000 },
    { documentId: 'INV-B', amountCents: 60000 },
  ]),
  payment('PAY-2', 30000, '2026-04-26', []),
];

const whole = computeStatement(customer, invoices, [], payments, '2026-03-01', '2026-04-30', 'customer');

test('A-72: the entity label is read from the document, then from its lines', () => {
  assert.equal(entityLabelOf({ dimensions: { world: 'Entity A' } }), 'Entity A');
  assert.equal(entityLabelOf({ dimensions: { World: ' Entity B ' } }), 'Entity B');
  assert.equal(entityLabelOf({ lines: [{ dimensions: { world: 'Entity A' } }] }), 'Entity A');
  assert.equal(entityLabelOf({ dimensions: { world: 'Unassigned' } }), '');
  assert.equal(entityLabelOf({}), '');
  assert.equal(entityLabelOf(null), '');
  // a custom world dimension id is honoured
  assert.equal(entityLabelOf({ dimensions: { company: 'Sub 1' } }, 'company'), 'Sub 1');
});

test('A-72: the labels a contact actually uses, and documents with none', () => {
  assert.deepEqual(entityOptions(invoices), ['Entity A', 'Entity B']);
  assert.equal(matchesEntity(invoices[0], 'Entity A'), true);
  assert.equal(matchesEntity(invoices[0], 'Entity B'), false);
  assert.equal(matchesEntity(invoices[1], UNLABELLED_ENTITY), true);
  assert.equal(matchesEntity(invoices[1], 'Entity A'), false);
  // the whole account matches everything
  assert.equal(matchesEntity(invoices[1], ''), true);
});

test('A-72: whole account, worked by hand: 250.00 + 1,690.00 − 1,300.00 = 640.00', () => {
  assert.equal(whole.openingBalanceCents, 25000);
  assert.equal(whole.entries.filter(e => e.type === 'Invoice').length, 3);
  assert.equal(whole.endingBalanceCents, 64000);
});

test('A-72: Entity A only: 250.00 + 1,000.00 − 400.00 = 850.00', () => {
  const scoped = scopeStatementDocuments({ invoices, bills: [], payments, credits: [] }, 'Entity A');
  assert.deepEqual(scoped.invoices.map(i => i.id), ['INV-A0', 'INV-A']);
  assert.deepEqual(scoped.payments.map(p => p.id), ['PAY-1']);
  // the payment copy carries only the part allocated to this entity's invoice
  assert.equal(scoped.payments[0].amountCents, 40000);
  assert.equal(scoped.payments[0].allocations?.length, 1);
  // the unallocated 300.00 payment is reported, not silently dropped
  assert.equal(scoped.paymentsWithoutScope, 1);
  assert.equal(scoped.paymentsWithoutScopeCents, 30000);

  const statement = computeStatement(customer, scoped.invoices, [], scoped.payments, '2026-03-01', '2026-04-30', 'customer');
  assert.equal(statement.openingBalanceCents, 25000);
  assert.equal(statement.endingBalanceCents, 85000);
});

test('A-72: Entity B only: 0.00 + 600.00 − 600.00 = 0.00', () => {
  const scoped = scopeStatementDocuments({ invoices, bills: [], payments, credits: [] }, 'Entity B');
  assert.deepEqual(scoped.invoices.map(i => i.id), ['INV-B']);
  assert.equal(scoped.payments[0].amountCents, 60000);
  const statement = computeStatement(customer, scoped.invoices, [], scoped.payments, '2026-03-01', '2026-04-30', 'customer');
  assert.equal(statement.openingBalanceCents, 0);
  assert.equal(statement.endingBalanceCents, 0);
});

test('A-72: documents with no entity label are their own scope: 90.00', () => {
  const scoped = scopeStatementDocuments({ invoices, bills: [], payments, credits: [] }, UNLABELLED_ENTITY);
  assert.deepEqual(scoped.invoices.map(i => i.id), ['INV-N']);
  const statement = computeStatement(customer, scoped.invoices, [], scoped.payments, '2026-03-01', '2026-04-30', 'customer');
  assert.equal(statement.endingBalanceCents, 9000);
});

test('A-72: the whole account leaves nothing out and copies nothing', () => {
  const scoped = scopeStatementDocuments({ invoices, bills: [], payments, credits: [] }, '');
  assert.equal(scoped.wholeAccount, true);
  assert.equal(scoped.paymentsWithoutScope, 0);
  assert.equal(scoped.invoices, invoices);
  assert.equal(scoped.payments, payments);
});

test('A-72: the stored payment is never changed by scoping', () => {
  const before = JSON.stringify(payments);
  scopeStatementDocuments({ invoices, bills: [], payments, credits: [] }, 'Entity A');
  assert.equal(JSON.stringify(payments), before);
  // and a second scope reads the original 1,000.00 again
  const second = scopeStatementDocuments({ invoices, bills: [], payments, credits: [] }, 'Entity B');
  assert.equal(second.payments[0].amountCents, 60000);
});

test('A-72: the note says the three things a reader must know', () => {
  const note = entityStatementNote({
    entity: 'Entity A',
    paymentsWithoutScope: 1,
    paymentsWithoutScopeCents: 30000,
    formattedMissing: '$300.00',
  });
  assert.match(note, /entity “Entity A” only/);
  assert.match(note, /1 posted payment \(\$300\.00\) allocated to no invoice of this entity is not in this statement/);
  assert.match(note, /PDF and the server statement still cover the whole account/);
  // nothing to say for the whole account
  assert.equal(entityStatementNote({ entity: '', paymentsWithoutScope: 0, paymentsWithoutScopeCents: 0 }), '');
  // documents with no label read as what they are
  assert.match(entityStatementNote({ entity: UNLABELLED_ENTITY, paymentsWithoutScope: 0, paymentsWithoutScopeCents: 0 }), /documents with no entity label/);
});
