import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPaletteResults, paletteGroup } from '../lib/paletteGroups';
test('mixed search results group by stable kind, retaining order and record IDs', () => {
  const results = [{ id: 'recent-invoice-1', type: 'recent' }, { id: 'tx-line-שלום-100', type: 'data' }, { id: 'cust-1', type: 'data' }, { id: 'tx-2', type: 'data' }, { id: 'switch-tab-sales', type: 'command' }, { id: 'vend-1', type: 'data' }, { id: 'inv-2', type: 'data' }];
  const groups = groupPaletteResults(results);
  assert.deepEqual(groups.map(group => group.label), ['Recent items', 'Transactions', 'Customers', 'Commands', 'Vendors', 'Invoices']);
  assert.deepEqual(groups[1].items.map(item => item.id), ['tx-line-שלום-100', 'tx-2']);
  assert.equal(paletteGroup({ id: 'acc-a', type: 'data' }), 'Accounts');
  assert.equal(paletteGroup({ id: 'proj-a', type: 'data' }), 'Projects');
  assert.deepEqual(groupPaletteResults([]), []);
});
