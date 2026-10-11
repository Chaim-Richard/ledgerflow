/** Tax profiles (PLAN §6): on the books and on label values, inherited from parents, registrations per level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeAncestry, registrationKey, registrationsOn, resolveSellerProfile, type TaxProfiles } from '../lib/tax/profile';

const profiles: TaxProfiles = {
  books: { name: 'Holding Ltd', place: { country: 'IL', city: 'Tel Aviv' }, basis: 'accrual',
    registrations: [{ kind: 'vat', number: '514000000', place: { country: 'IL' }, filing: 'bimonthly' }] },
  labels: {
    'world:us': { name: 'Acme US', place: { country: 'US' } },
    'world:us/texas': { name: 'Acme Texas LLC', place: { country: 'US', state: 'TX', city: 'Austin' },
      registrations: [
        { kind: 'sales_tax', number: '32000000001', place: { country: 'US', state: 'TX' }, filing: 'quarterly', validFrom: '2026-01-01' },
        { kind: 'employer', number: '12-3456789', place: { country: 'US' } },
      ] },
    'location:eilat': { place: { country: 'IL', city: 'Eilat', district: 'Eilat' } },
  },
};

test('parents of a label value, nearest first', () => {
  assert.deepEqual(nodeAncestry('us/texas/austin'), ['us/texas/austin', 'us/texas', 'us']);
});

test('a line for the Texas LLC takes its place and registrations; a child value inherits them', () => {
  const tx = resolveSellerProfile(profiles, { world: 'us/texas/austin-store' }, ['world', 'location']);
  assert.equal(tx.name, 'Acme Texas LLC');
  assert.deepEqual(tx.place, { country: 'US', state: 'TX', city: 'Austin' });
  assert.deepEqual(tx.from, ['world:us/texas', 'world:us', 'books']);
  assert.equal(tx.basis, 'accrual', 'from the books');
  assert.deepEqual(tx.registrations?.map(r => r.kind), ['sales_tax', 'employer'], 'its own, not the Israeli VAT number');
});

test('no label with a profile: the books; the first label in order wins', () => {
  assert.equal(resolveSellerProfile(profiles, { project: 'p1' }, ['world', 'location']).name, 'Holding Ltd');
  const eilat = resolveSellerProfile(profiles, { location: 'eilat' }, ['world', 'location']);
  assert.deepEqual(eilat.place, { country: 'IL', city: 'Eilat', district: 'Eilat' });
  assert.equal(eilat.registrations?.[0].number, '514000000', 'inherits the books\' VAT number');
  assert.equal(resolveSellerProfile(profiles, { world: 'us/texas', location: 'eilat' }, ['world', 'location']).name, 'Acme Texas LLC');
  assert.deepEqual(resolveSellerProfile(null, {}, []).from, []);
});

test('registrations in force on a date, and their keys', () => {
  const tx = resolveSellerProfile(profiles, { world: 'us/texas' }, ['world']);
  assert.equal(registrationsOn(tx, 'sales_tax', '2025-12-31').length, 0);
  assert.equal(registrationKey(registrationsOn(tx, 'sales_tax', '2026-01-01')[0]), 'sales_tax:US-TX:32000000001');
});
