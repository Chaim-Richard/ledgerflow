/** Line tax from the rule packs (PLAN §10): any place with a pack is priced by the rules, never guessed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSellerProfile, type TaxProfiles } from '../lib/tax/profile';
import { resolveLineTax } from '../lib/tax/resolveLineTax';
import { ruleRateTable } from '../lib/tax/ruleRateTable';

const reg = (kind: 'vat' | 'sales_tax', country: string, state?: string) => ({ kind, number: '1', place: { country, ...(state ? { state } : {}) } });
const profiles: TaxProfiles = {
  labels: {
    'world:tx': { place: { country: 'US', state: 'TX' }, registrations: [reg('sales_tax', 'US', 'TX')] },
    'world:uk': { place: { country: 'GB' }, registrations: [reg('vat', 'GB')] },
    'world:de': { place: { country: 'DE' }, registrations: [reg('vat', 'DE')] },
    'world:nh': { place: { country: 'US', state: 'NH' }, registrations: [reg('sales_tax', 'US', 'NH')] },
  },
};
const fallback = ruleRateTable();
const line = (world: string, buyer: { country: string; state?: string }, date = '2026-10-11') =>
  resolveLineTax({ seller: resolveSellerProfile(profiles, { world }, ['world']), buyer, date, fallback });

test('Texas, the UK and Germany are priced from their packs, each with its registration', () => {
  const tx = line('tx', { country: 'US', state: 'TX' });
  assert.deepEqual([tx.reason, tx.rate], ['taxed', 0.0625]);
  assert.equal(tx.components[0].level, 'state');
  const uk = line('uk', { country: 'GB' });
  assert.deepEqual([uk.reason, uk.rate], ['taxed', 0.2]);
  const de = line('de', { country: 'DE' });
  assert.deepEqual([de.reason, de.rate], ['taxed', 0.19]);
});

test('a state with no sales tax answers zero from its pack; without the fallback nothing is guessed', () => {
  const nh = line('nh', { country: 'US', state: 'NH' });
  assert.equal(nh.rate, 0);
  const none = resolveLineTax({ seller: resolveSellerProfile(profiles, { world: 'tx' }, ['world']), buyer: { country: 'US', state: 'TX' }, date: '2026-10-11' });
  assert.equal(none.reason, 'no-rate-table');
});
