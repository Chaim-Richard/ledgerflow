import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLineDimension, lineHasLabel, stableLabelValue } from '../lib/dimensionUtils';
import type { DimensionNode, Transaction, TransactionLine } from '../types';

// AU-2: one shared label filter. Old == new on generated scopes.
const nodes = [
  { id: 'loc_tlv', dimensionId: 'location', description: 'Tel Aviv', aliases: ['TLV'] },
  { id: 'loc_ny', dimensionId: 'location', description: 'New York', aliases: [] },
  { id: 'cls_retail', dimensionId: 'class', description: 'Retail', aliases: ['Shops'] },
] as unknown as DimensionNode[];
const values = ['loc_tlv', 'Tel Aviv', 'tlv', ' TLV ', 'New York', 'loc_ny/floor-2', 'Tel Aviv/north', 'Haifa', 'Retail', 'shops', 'Unassigned'];
const dims = ['location', 'class', 'project'];

let seed = 7;
const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

function genLine(): { line: TransactionLine; tx: Transaction } {
  const dim = dims[rnd(dims.length)];
  const value = values[rnd(values.length)];
  const where = rnd(4);
  const line = { accountId: 'a', amountCents: 100, ...(where === 0 ? { dimensions: { [dim]: value } } : {}), ...(where === 1 ? { tags: [`${dim}:${value}`] } : {}) } as unknown as TransactionLine;
  const tx = { id: 't', ...(where === 2 ? { dimensions: { [dim]: value } } : {}) } as unknown as Transaction;
  return { line, tx };
}

test('without nodes, the shared filter matches the old comparison (ignoring case) for every trimmed value', () => {
  for (let i = 0; i < 2000; i++) {
    const { line, tx } = genLine();
    const filter = { dimensionId: dims[rnd(dims.length)], value: values[rnd(values.length)].trim() };
    const own = getLineDimension(line, tx, filter.dimensionId);
    if (own !== own.trim()) continue; // the old filter missed padded values; the new one is meant to catch them
    const old = own.toLowerCase() === filter.value.toLowerCase(); // the new filter also ignores case
    assert.equal(lineHasLabel(line, tx, filter), old, JSON.stringify({ line, tx, filter }));
  }
});

test('with nodes, an id, its name and its alias select the same lines', () => {
  const line = { accountId: 'a', amountCents: 1, dimensions: { location: 'Tel Aviv' } } as unknown as TransactionLine;
  for (const v of ['loc_tlv', 'Tel Aviv', 'tlv', ' TLV ']) assert.ok(lineHasLabel(line, undefined, { dimensionId: 'location', value: v }, nodes), v);
  assert.equal(lineHasLabel(line, undefined, { dimensionId: 'location', value: 'New York' }, nodes), false);
  assert.equal(stableLabelValue('Tel Aviv/north', 'location', nodes), 'loc_tlv/north');
  assert.equal(stableLabelValue('Haifa', 'location', nodes), 'Haifa');
  assert.equal(stableLabelValue('Retail', 'location', nodes), 'Retail', 'a node of another dimension never matches');
});
