/** A sale line's tax from the seller entity, the buyer's place, the date and certificates (PLAN §6). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSellerProfile, type TaxProfiles } from '../lib/tax/profile';
import { resolveLineTax } from '../lib/tax/resolveLineTax';

const profiles: TaxProfiles = {
  books: { place: { country: 'IL' }, registrations: [{ kind: 'vat', number: '514000000', place: { country: 'IL' } }] },
  labels: {
    'world:tx': { place: { country: 'US', state: 'TX' }, registrations: [{ kind: 'sales_tax', number: '320001', place: { country: 'US', state: 'TX' }, validFrom: '2026-01-01' }] },
  },
};
const israel = resolveSellerProfile(profiles, {}, ['world']);
const texas = resolveSellerProfile(profiles, { world: 'tx' }, ['world']);
const txTable = { 'US-TX': () => [{ level: 'state' as const, name: 'Texas', rate: 0.0625 }, { level: 'city' as const, name: 'Austin', rate: 0.02 }] };

test('Israel: 17% before 2025, 18% from 1 Jan 2025; Eilat zero; abroad zero; a certificate exempts', () => {
  assert.equal(resolveLineTax({ seller: israel, buyer: { country: 'IL' }, date: '2024-12-31' }).rate, 0.17);
  const now = resolveLineTax({ seller: israel, buyer: { country: 'IL', city: 'Haifa' }, date: '2026-10-11' });
  assert.deepEqual([now.reason, now.rate, now.registration], ['taxed', 0.18, 'vat:IL:514000000']);
  assert.equal(resolveLineTax({ seller: israel, buyer: { country: 'IL', district: 'Eilat' }, date: '2026-10-11' }).reason, 'zero-area');
  assert.equal(resolveLineTax({ seller: israel, buyer: { country: 'DE' }, date: '2026-10-11' }).reason, 'export');
  assert.equal(resolveLineTax({ seller: israel, buyer: { country: 'IL' }, date: '2026-10-11', exempt: true }).reason, 'exempt-certificate');
  assert.equal(resolveLineTax({ seller: israel, date: '2026-10-11' }).rate, 0.18, 'no buyer place: the seller place');
});

test('The Texas entity: taxed in Texas with its permit, from the permit date; not in a state without one; never guessed', () => {
  const austin = resolveLineTax({ seller: texas, buyer: { country: 'US', state: 'TX', city: 'Austin' }, date: '2026-03-01', tables: txTable });
  assert.deepEqual([austin.reason, austin.rate, austin.registration], ['taxed', 0.0825, 'sales_tax:US-TX:320001']);
  assert.equal(resolveLineTax({ seller: texas, buyer: { country: 'US', state: 'TX' }, date: '2025-12-31', tables: txTable }).reason, 'not-registered');
  assert.equal(resolveLineTax({ seller: texas, buyer: { country: 'US', state: 'CA' }, date: '2026-03-01', tables: txTable }).reason, 'not-registered');
  assert.equal(resolveLineTax({ seller: texas, buyer: { country: 'US', state: 'TX' }, date: '2026-03-01' }).reason, 'no-rate-table');
  assert.equal(resolveLineTax({ seller: texas, buyer: { country: 'IL' }, date: '2026-03-01' }).reason, 'export');
});
