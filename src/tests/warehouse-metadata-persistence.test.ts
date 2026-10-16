import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { binLocationFieldPath, createShipmentRecord, shipmentFieldPath, shipmentSourcesForOrder } from '../lib/warehouseWorkflows';
import {
  createReturnAuthorization, createWarrantyRecord, returnAuthorizationsFromMetadata,
  rmaFieldPath, transitionReturnAuthorization, warrantyCandidates, warrantyFieldPath, warrantyRecordsFromMetadata,
} from '../lib/warehouseRecords';
import type { Customer, Estimate, InventoryItem, Invoice } from '../types';

/** Real migrated Postgres/RLS and the same nested-field RPC used by the four warehouse screens. */
describe('Warehouse metadata persistence (A-64–A-67)', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const workspaceId = `warehouse_${randomBytes(6).toString('hex')}`;
  const uid = `${workspaceId}_owner`;
  const book = `${workspaceId}_book`;
  const viewer = `${workspaceId}_viewer`;
  const actor = { uid: book, name: 'Dana דנה', role: 'bookkeeper' };
  const at = '2026-10-16T10:00:00.000Z';
  const customer: Customer = { id: `${workspaceId}_customer`, uid, workspaceId, name: 'לקוח Customer', metadata: { existingNote: 'Keep this' } };
  const item: InventoryItem = {
    id: `${workspaceId}_item`, uid, workspaceId, name: 'ציוד Widget', sku: 'SKU-01', itemType: 'stock',
    unitPriceCents: 1000, unitCostCents: 400, quantityAtHand: 20, reorderPoint: 2, createdAt: '2026-01-01',
  };
  const order: Estimate = {
    id: `${workspaceId}_order`, uid, workspaceId, customerId: customer.id, customerName: customer.name,
    number: 'SO-01', amountCents: 5000, date: '2026-10-10', status: 'accepted', orderedAt: '2026-10-11',
    createdAt: '2026-10-10', metadata: { existingNote: 'Keep order note' },
    lines: [{ itemId: item.id, description: item.name, quantity: 5, unitPriceCents: 1000, amountCents: 5000 }],
  };
  const invoice: Invoice = {
    id: `${workspaceId}_invoice`, uid, workspaceId, customerId: customer.id, customerName: customer.name,
    number: 'INV-01', amountCents: 5000, date: '2026-10-12', dueDate: '2026-11-11', status: 'sent', currency: 'USD',
    metadata: { convertedFromEstimateId: order.id },
    items: [{ id: 'line-01', itemId: item.id, description: item.name, quantity: 5, rateCents: 1000, amountCents: 5000, accountId: 'income', serialNumbers: ['SN-אב-01'], metadata: { orderLine: 0 } }],
  };
  let client: pg.Client;
  async function asUser(userId: string, operation: () => Promise<void>) {
    await client.query('begin');
    try {
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated', aal: 'aal1' })]);
      await operation();
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; }
  }
  async function read<T>(table: 'inventory' | 'estimates' | 'customers' | 'invoices', id: string): Promise<T> {
    return (await client.query<{ data: T }>(`select data from public."${table}" where id = $1`, [id])).rows[0].data;
  }
  const patch = async (table: string, id: string, fields: Record<string, unknown>, userId = book) => {
    await asUser(userId, async () => { await client.query('select public.lf_update($1, $2, $3)', [table, id, fields]); });
  };
  before(async () => {
    client = new pg.Client({ connectionString: process.env.LF_TEST_DATABASE_URL });
    await client.connect();
    await client.query('insert into public.workspaces (id, data) values ($1, $2)', [workspaceId, {
      uid, name: 'Warehouse persistence tests', currency: 'USD', members: [uid, book, viewer], roles: { [book]: 'bookkeeper', [viewer]: 'viewer' },
    }]);
    for (const [table, record] of [['inventory', item], ['estimates', order], ['customers', customer], ['invoices', invoice]] as const) {
      await client.query(`insert into public."${table}" (id, data) values ($1, $2)`, [record.id, record]);
    }
  });
  after(async () => {
    if (!client) return;
    for (const table of ['inventory', 'estimates', 'customers', 'invoices']) {
      await client.query(`delete from public."${table}" where workspace_id = $1`, [workspaceId]);
    }
    await client.query('delete from public.workspaces where id = $1', [workspaceId]);
    await client.end();
  });

  test('bin and shipment annotations survive a fresh database read without changing order or stock amounts', async () => {
    const bin = { locationId: 'מקום.ראשי', bin: 'A-03', updatedAt: at, updatedByUid: book, updatedByName: actor.name };
    await patch('inventory', item.id, { [binLocationFieldPath(bin.locationId)]: bin });
    const savedItem = await read<InventoryItem>('inventory', item.id);
    assert.deepEqual(Object.values(savedItem.binLocations || {}), [bin]);
    for (const [key, value] of Object.entries(item)) assert.deepEqual(savedItem[key as keyof InventoryItem], value);

    const source = shipmentSourcesForOrder(order, [invoice], [], [item], 'invoice')[0];
    assert.ok(source);
    const shipment = createShipmentRecord({ id: 'ship_test', workspaceId, orderId: order.id, source, carrier: 'שליח Parcel', trackingNumber: 'TRACK-01', shippedDate: '2026-10-15', recordedAt: at, actor });
    const path = shipmentFieldPath(source.sourceType, source.sourceId);
    assert.ok(path);
    await patch('estimates', order.id, { [path!]: shipment });
    const savedOrder = await read<Estimate>('estimates', order.id);
    assert.equal(savedOrder.metadata?.existingNote, 'Keep order note');
    assert.deepEqual(Object.values(savedOrder.metadata?.warehouseShipmentsBySource || {}), [shipment]);
    assert.equal(savedOrder.amountCents, 5000);
    assert.deepEqual(savedOrder.lines, order.lines);
    assert.deepEqual(await read<Invoice>('invoices', invoice.id), invoice);
  });

  test('RMA request and screen-validated transition persist alongside existing customer metadata', async () => {
    const record = createReturnAuthorization({
      id: 'rma_persistence', number: 'RMA-2026-TEST', workspaceId, customerId: customer.id, customerName: customer.name,
      invoiceId: invoice.id, invoiceNumber: invoice.number!, reason: 'מידה שגויה Wrong size', actor, at,
      lines: [{ invoiceLineId: 'line-01', itemId: item.id, description: item.name, quantity: 1, soldQuantity: 5 }],
    });
    await patch('customers', customer.id, { [rmaFieldPath(record.id)]: record });
    let saved = await read<Customer>('customers', customer.id);
    assert.deepEqual(returnAuthorizationsFromMetadata(saved.metadata, customer.id, workspaceId), [record]);
    const approved = transitionReturnAuthorization(record, { type: 'approve' }, { uid, role: 'owner', name: 'Owner' }, '2026-10-16T11:00:00.000Z');
    if (!approved.ok) assert.fail(approved.reason);
    await patch('customers', customer.id, { [rmaFieldPath(record.id)]: approved.record }, uid);
    saved = await read<Customer>('customers', customer.id);
    assert.equal(saved.metadata?.existingNote, 'Keep this');
    const [reopened] = returnAuthorizationsFromMetadata(saved.metadata, customer.id, workspaceId);
    assert.equal(reopened.status, 'approved');
    assert.deepEqual(reopened.events.map(event => [event.status, event.byUid]), [['requested', book], ['approved', uid]]);
  });

  test('warranty history is retained after reopening and editing a serial date again', async () => {
    const candidate = warrantyCandidates([invoice], [customer], [item], workspaceId)[0];
    assert.ok(candidate);
    const record = createWarrantyRecord({ candidate, endDate: '2027-10-15', actor, at });
    await patch('customers', customer.id, { [warrantyFieldPath(candidate)]: record });
    const saved = await read<Customer>('customers', customer.id);
    const [reopened] = warrantyRecordsFromMetadata(saved.metadata, customer.id, workspaceId);
    assert.equal(reopened.serial, 'SN-אב-01');
    const amended = createWarrantyRecord({ candidate, endDate: '2028-10-15', actor, at: '2026-10-16T12:00:00.000Z', existing: reopened });
    await patch('customers', customer.id, { [warrantyFieldPath(candidate)]: amended });
    const [final] = warrantyRecordsFromMetadata((await read<Customer>('customers', customer.id)).metadata, customer.id, workspaceId);
    assert.deepEqual(final.changeLog.map(change => [change.previousEndDate, change.endDate]), [[null, '2027-10-15'], ['2027-10-15', '2028-10-15']]);
  });

  test('viewers and non-members are refused, workspace reassignment fails, and no financial or stock event was created', async () => {
    for (const [table, record] of [['inventory', item], ['estimates', order], ['customers', customer]] as const) {
      const before = await read<typeof record>(table, record.id);
      for (const forbiddenUser of [viewer, `${workspaceId}_outsider`]) {
        await assert.rejects(patch(table, record.id, { 'metadata.forbidden': 'Should not save' }, forbiddenUser));
        assert.deepEqual(await read(table, record.id), before);
      }
      await assert.rejects(patch(table, record.id, { workspaceId: `${workspaceId}_other` }));
      assert.deepEqual(await read(table, record.id), before);
    }
    for (const table of ['transactions', 'stockMoves', 'creditNotes']) {
      const result = await client.query<{ count: number }>(`select count(*)::int as count from public."${table}" where workspace_id = $1`, [workspaceId]);
      assert.equal(result.rows[0].count, 0, `no ${table} created by metadata updates`);
    }
    assert.deepEqual(await read<Invoice>('invoices', invoice.id), invoice);
    const savedItem = await read<InventoryItem>('inventory', item.id);
    assert.equal(savedItem.quantityAtHand, 20);
    assert.equal(savedItem.unitCostCents, 400);
  });
});
