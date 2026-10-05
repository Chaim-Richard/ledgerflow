import './helpers/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDetailContext } from '../lib/recordDetailContext';
test('related record context resolves selected IDs and unique datalist names, refusing ambiguity', () => {
  document.body.innerHTML = '<label for="party">Vendor</label><select id="party"><option value="vendor-1">שלום</option></select><input aria-label="Customer" value="לקוח Customer"><input data-record-kind="inventory" data-record-id="item-1" value="Part"><input aria-label="Amount" value="100">';
  const records = { vendors: [{ id: 'vendor-1', name: 'שלום' }], customers: [{ id: 'customer-1', name: 'לקוח Customer' }], inventory: [{ id: 'item-1', sku: 'Part' }] };
  assert.deepEqual(recordDetailContext(document.querySelector('select'), records), { kind: 'vendors', id: 'vendor-1' });
  assert.deepEqual(recordDetailContext(document.querySelector('input[aria-label="Customer"]'), records), { kind: 'customers', id: 'customer-1' });
  assert.deepEqual(recordDetailContext(document.querySelector('input[data-record-kind]'), records), { kind: 'inventory', id: 'item-1' });
  assert.equal(recordDetailContext(document.querySelector('input[aria-label="Amount"]'), records), undefined);
  assert.equal(recordDetailContext(document.querySelector('input[aria-label="Customer"]'), { customers: [...records.customers, { id: 'duplicate', name: 'לקוח Customer' }] }), undefined);
  document.body.innerHTML = '';
});
test('explicit selected IDs resolve even when their lazy list is absent', () => {
 const input = document.createElement('input'); input.dataset.recordKind = 'vendors'; input.dataset.recordId = 'not-loaded';
 assert.deepEqual(recordDetailContext(input, {}), { kind: 'vendors', id: 'not-loaded' });
 const select = document.createElement('select'); select.dataset.recordKind = 'customers'; select.innerHTML = '<option value="unloaded-customer">לקוח</option>';
 assert.deepEqual(recordDetailContext(select, {}), { kind: 'customers', id: 'unloaded-customer' });
});
