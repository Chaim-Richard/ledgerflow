import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import type { CreditNote, Customer, Estimate, Invoice, InventoryItem, Transaction } from '../types';
import { DELIVERY_COGS_TYPE, DELIVERY_RETURN_TYPE } from './deliveries';
import {
  binLocationFieldPath,
  binLocationKey,
  binLocationProblem,
  buildWarehousePickList,
  createShipmentRecord,
  itemBinForLocation,
  shipmentFieldPath,
  shipmentProblem,
  shipmentRecordsFromMetadata,
  shipmentSourcesForOrder,
  warehouseLocationOptions,
  warehouseOrders,
} from './warehouseWorkflows';
import {
  createReturnAuthorization,
  createWarrantyRecord,
  filterWarrantyCandidates,
  returnAuthorizationId,
  returnAuthorizationNumber,
  returnAuthorizationRequestProblem,
  returnAuthorizationsFromMetadata,
  transitionReturnAuthorization,
  warrantyCandidates,
  warrantyEndDateProblem,
  warrantyFieldPath,
  warrantyRecordForCandidate,
  warrantyRecordsFromMetadata,
  warrantyStatus,
} from './warehouseRecords';

const workspaceId = 'ws-1';
const customer: Customer = {
  id: 'customer-1', uid: 'u1', workspaceId, name: 'Acme Co',
};
const item = (id = 'item-1', overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id, uid: 'u1', workspaceId, name: `Item ${id}`, sku: id.toUpperCase(),
  unitPriceCents: 1000, unitCostCents: 400, quantityAtHand: 10, reorderPoint: 0,
  createdAt: '2026-01-01', ...overrides,
});
const order: Estimate = {
  id: 'order-1', uid: 'u1', workspaceId, customerId: customer.id, customerName: customer.name,
  number: 'SO-001', amountCents: 5000, date: '2026-10-01', status: 'accepted', orderedAt: '2026-10-02',
  createdAt: '2026-10-01', lines: [
    { itemId: 'item-1', description: 'Blue Widget', quantity: 5, unitPriceCents: 1000, amountCents: 5000 },
  ],
};
const invoice = (id: string, status: Invoice['status'], quantity: number, extra: Partial<Invoice> = {}): Invoice => ({
  id, uid: 'u1', workspaceId, customerId: customer.id, customerName: customer.name,
  number: id.toUpperCase(), amountCents: quantity * 1000, date: '2026-10-03', dueDate: '2026-11-03', status,
  metadata: { convertedFromEstimateId: order.id },
  items: [{
    id: `${id}-line-1`, itemId: 'item-1', description: 'Blue Widget', quantity, rateCents: 1000,
    amountCents: quantity * 1000, accountId: 'income', metadata: { orderLine: 0 },
  }],
  ...extra,
});
const transaction = (id: string, type: string, quantity: number, orderLine = 0): Transaction => ({
  id, uid: 'u1', workspaceId, date: '2026-10-03', description: id, lines: [], totalAmountCents: 0,
  currency: 'USD', status: 'completed', type: 'actual',
  metadata: { type, orderId: order.id, deliveryId: 'dlv_0123456789abcdef', inventoryItemId: 'item-1', orderLine, quantity },
});
const actor = (uid: string, role: string): { uid: string; name: string; role: string } => ({ uid, name: uid, role });

// A typo in an early caller is caught by TypeScript instead of being silently treated as a bin.
const location = { id: 'loc.1', dimensionId: 'location', description: 'Main warehouse', status: 'active' as const };

describe('Warehouse operations workflows (A-64–A-67)', () => {
  test('bin locations use a safe per-location metadata path and reject unsafe labels', () => {
    assert.equal(binLocationKey('loc.1'), 'loc_loc%2E1');
    assert.equal(binLocationFieldPath('loc.1'), 'binLocations.loc_loc%2E1');
    assert.equal(binLocationProblem('loc.1', ' A-03 '), null);
    assert.match(binLocationProblem('', 'A-03') || '', /Choose a Location/);
    assert.match(binLocationProblem('loc.1', 'x'.repeat(81)) || '', /80 characters/);

    const assigned = item('item-1', { binLocations: { [binLocationKey(location.id)]: { locationId: location.id, bin: 'A-03' } } });
    assert.equal(itemBinForLocation(assigned, location.id), 'A-03');
    assert.equal(itemBinForLocation(assigned, 'other'), '');
    assert.equal(warehouseLocationOptions([location], [assigned])[0].id, location.id);
  });

  test('invoice-mode pick lists use existing order progress, ignore unissued invoices, and sort by bin', () => {
    const secondItem = item('item-2', { name: 'Red Widget', sku: 'W-2', binLocations: { [binLocationKey('loc.1')]: { locationId: 'loc.1', bin: 'A-02' } } });
    const firstItem = item('item-1', { binLocations: { [binLocationKey('loc.1')]: { locationId: 'loc.1', bin: 'A-10' } } });
    const twoLineOrder: Estimate = {
      ...order,
      lines: [
        { itemId: 'item-1', description: 'Blue Widget', quantity: 5, unitPriceCents: 1000, amountCents: 5000 },
        { itemId: 'item-2', description: 'Red Widget', quantity: 3, unitPriceCents: 500, amountCents: 1500 },
      ],
    };
    const invoices = [
      invoice('issued', 'paid', 2),
      invoice('draft', 'draft', 1),
      invoice('rejected', 'rejected', 1),
      invoice('void', 'void', 1),
      invoice('cancelled', 'cancelled', 1),
    ];
    const rows = buildWarehousePickList(twoLineOrder, invoices, [], [firstItem, secondItem], 'loc.1', 'invoice', [location]);
    assert.deepEqual(rows.map(row => [row.itemId, row.bin, row.quantityToPick]), [
      ['item-2', 'A-02', 3],
      ['item-1', 'A-10', 3],
    ]);
    assert.deepEqual(warehouseOrders([order, { ...order, id: 'quote', orderedAt: undefined }], workspaceId).map(row => row.id), ['order-1']);
  });

  test('delivery-mode pick quantities use existing deliveries less existing returns', () => {
    const rows = buildWarehousePickList(
      order,
      [invoice('ignored-invoice', 'paid', 4)],
      [transaction('delivery-entry', DELIVERY_COGS_TYPE, 2), transaction('return-entry', DELIVERY_RETURN_TYPE, 1)],
      [item()],
      'loc.1',
      'delivery',
      [location],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quantityToPick, 4, 'five ordered less two delivered plus one returned');
  });

  test('shipment sources are existing deliveries or issued invoices, and tracking annotations validate without posting', () => {
    const shippedInvoice = invoice('issued', 'sent', 2);
    const draftInvoice = invoice('draft', 'draft', 1);
    const sources = shipmentSourcesForOrder(order, [shippedInvoice, draftInvoice], [], [item()], 'invoice');
    assert.equal(sources.length, 1);
    assert.equal(sources[0].sourceId, 'issued');
    assert.equal(shipmentFieldPath('invoice', 'issued'), 'metadata.warehouseShipmentsBySource.invoice_issued');

    const valid = {
      source: sources[0], existing: null, carrier: 'Carrier Co', trackingNumber: '1Z0001',
      shippedDate: '2026-10-14', today: '2026-10-15',
    };
    assert.equal(shipmentProblem(valid), null);
    assert.match(shipmentProblem({ ...valid, shippedDate: '2026-10-16' }) || '', /future/);
    assert.match(shipmentProblem({ ...valid, trackingNumber: '' }) || '', /tracking number/);

    const record = createShipmentRecord({
      id: 'ship_0123456789ab', workspaceId, orderId: order.id, source: sources[0],
      carrier: valid.carrier, trackingNumber: valid.trackingNumber, shippedDate: valid.shippedDate,
      recordedAt: '2026-10-14T13:00:00.000Z', actor: actor('u1', 'bookkeeper'),
    });
    const metadata = { warehouseShipmentsBySource: { 'invoice_issued': record } };
    assert.equal(shipmentRecordsFromMetadata(metadata).length, 1);
    assert.equal(shipmentProblem({ ...valid, existing: record }), 'This delivery or invoice already has a shipment record.');
    assert.equal(shipmentSourcesForOrder(order, [], [transaction('delivery-entry', DELIVERY_COGS_TYPE, 2)], [item()], 'delivery')[0].sourceType, 'delivery');
  });

  test('RMA requests validate sold quantities and enforce two-person approval plus an exact credit-note reference', () => {
    const input = {
      id: returnAuthorizationId('ABCDEFGHJKLM'), number: returnAuthorizationNumber('2026-10-15', 'ABCDEFGHJKLM'),
      workspaceId, customerId: customer.id, customerName: customer.name, invoiceId: 'invoice-1', invoiceNumber: 'INV-1',
      reason: 'Wrong size', lines: [{ invoiceLineId: 'line-1', itemId: 'item-1', description: 'Blue Widget', quantity: 1, soldQuantity: 2 }],
      actor: actor('requester', 'bookkeeper'), at: '2026-10-15T12:00:00.000Z',
    };
    assert.equal(returnAuthorizationRequestProblem(input), null);
    assert.match(returnAuthorizationRequestProblem({ ...input, lines: [{ ...input.lines[0], quantity: 3 }] }) || '', /more than the 2 sold/);
    assert.match(returnAuthorizationRequestProblem({ ...input, lines: [{ ...input.lines[0], quantity: 0.333 }] }) || '', /two decimal/);
    const rma = createReturnAuthorization(input);
    assert.equal(rma.status, 'requested');
    assert.equal(returnAuthorizationsFromMetadata({ returnAuthorizationsById: { [rma.id]: rma } }, customer.id, workspaceId)[0].id, rma.id);

    assert.equal(transitionReturnAuthorization(rma, { type: 'approve' }, actor('requester', 'owner'), '2026-10-15T13:00:00.000Z').ok, false, 'no self-approval');
    assert.equal(transitionReturnAuthorization(rma, { type: 'approve' }, actor('bookkeeper-2', 'bookkeeper'), '2026-10-15T13:00:00.000Z').ok, false, 'a bookkeeper cannot approve');
    const approved = transitionReturnAuthorization(rma, { type: 'approve' }, actor('accountant', 'accountant'), '2026-10-15T13:00:00.000Z');
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    const received = transitionReturnAuthorization(approved.record, { type: 'receive' }, actor('receiver', 'bookkeeper'), '2026-10-16T13:00:00.000Z');
    assert.equal(received.ok, true);
    if (!received.ok) return;

    const wrongCredit = { id: 'credit-1', number: 'CN-1', workspaceId, customerId: 'someone-else', invoiceId: 'invoice-1', status: 'open' } as CreditNote;
    assert.equal(transitionReturnAuthorization(received.record, { type: 'link-credit-note', creditNote: wrongCredit }, actor('receiver', 'bookkeeper'), '2026-10-16T14:00:00.000Z').ok, false);
    const credit = { ...wrongCredit, customerId: customer.id };
    const closed = transitionReturnAuthorization(received.record, { type: 'link-credit-note', creditNote: credit }, actor('receiver', 'bookkeeper'), '2026-10-16T14:00:00.000Z');
    assert.equal(closed.ok, true);
    if (closed.ok) {
      assert.equal(closed.record.status, 'closed');
      assert.equal(closed.record.linkedCreditNoteId, credit.id);
      assert.deepEqual(closed.record.events.map(event => event.status), ['requested', 'approved', 'received', 'closed']);
    }
  });

  test('warranty reports derive serials from issued invoice lines and keep a date-change audit trail', () => {
    const issued = invoice('serial-sale', 'paid', 1, {
      date: '2026-09-01',
      items: [{
        id: 'serial-line', itemId: 'item-1', description: 'Blue Widget', quantity: 1,
        rateCents: 1000, amountCents: 1000, accountId: 'income', serialNumbers: ['SN 001'],
      }],
    });
    const draft = invoice('draft-sale', 'draft', 1, {
      items: [{ ...issued.items![0], id: 'draft-line', serialNumbers: ['DRAFT-SN'] }],
    });
    const candidates = warrantyCandidates([issued, draft], [customer], [item()], workspaceId);
    assert.equal(candidates.length, 1);
    const candidate = candidates[0];
    assert.equal(candidate.serial, 'SN 001');
    assert.equal(warrantyFieldPath(candidate), `metadata.warrantiesById.${candidate.id}`);
    assert.equal(warrantyEndDateProblem('2026-02-29') !== null, true);
    assert.equal(warrantyEndDateProblem('2028-02-29'), null);
    assert.equal(warrantyStatus('2026-10-15', '2026-10-15'), 'under warranty');
    assert.equal(warrantyStatus('2026-10-14', '2026-10-15'), 'expired');
    assert.equal(warrantyStatus(undefined, '2026-10-15'), 'not set');

    const first = createWarrantyRecord({
      candidate, endDate: '2027-09-01', actor: actor('u1', 'owner'), at: '2026-10-15T12:00:00.000Z',
    });
    const revised = createWarrantyRecord({
      candidate, endDate: '2028-09-01', existing: first, actor: actor('u2', 'accountant'), at: '2026-10-16T12:00:00.000Z',
    });
    assert.equal(revised.changeLog.length, 2);
    assert.equal(revised.changeLog[1].previousEndDate, '2027-09-01');
    const stored = warrantyRecordsFromMetadata({ warrantiesById: { [revised.id]: revised } }, customer.id, workspaceId);
    assert.equal(warrantyRecordForCandidate(stored, candidate)?.endDate, '2028-09-01');
    assert.equal(filterWarrantyCandidates([{ endDate: '2028-09-01' }, { endDate: '2020-01-01' }], 'under warranty', '2026-10-15').length, 1);
  });
});
