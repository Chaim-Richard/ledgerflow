import test from 'node:test';
import assert from 'node:assert/strict';
import {
  US_POSTAL_REGIONS, parseUsStateAndZip, type UsPostalCode,
} from '../lib/usAddressStateZip';

test('E-16: USPS two-letter abbreviations cover 50 states plus DC and separate territories', () => {
  const states = Object.keys(US_POSTAL_REGIONS);
  assert.equal(states.length, 62); // 50 states + DC + 8 territories + 3 military
  for (const state of ['TX', 'CA', 'NY', 'WA', 'CO', 'DC', 'PR', 'GU', 'VI', 'AA', 'AE', 'AP']) {
    assert.ok(Object.hasOwn(US_POSTAL_REGIONS, state));
  }
});

test('E-16: normal city/state/ZIP block with CRLF preserves leading-zero ZIP', () => {
  const got = parseUsStateAndZip('ACME LLC\r\n15 Summer St, Suite 10\r\nBoston, MA 02110\r\nUSA');
  assert.deepEqual(got, {
    status: 'parsed', state: 'MA', regionKind: 'state',
    zip5: '02110', zip4: null, postalCode: '02110',
    issue: null, readyForTaxCalculation: false,
  });
});

test('E-16: ZIP+4 remains a string and retains leading zeroes', () => {
  const result = parseUsStateAndZip('10 Some Road\nNew York, NY 00501-0007');
  assert.equal(result.status, 'parsed');
  assert.equal(result.zip5, '00501');
  assert.equal(result.zip4, '0007');
  assert.equal(result.postalCode, '00501-0007');
});

test('E-16: handles long and short states in the address last line', () => {
  assert.equal(parseUsStateAndZip('San Francisco, California 94105').state, 'CA');
  assert.equal(parseUsStateAndZip('Albany, New York 12207').state, 'NY');
  assert.equal(parseUsStateAndZip('Charleston, West Virginia 25301').state, 'WV');
  assert.equal(parseUsStateAndZip('Washington, District of Columbia 20001').state, 'DC');
  assert.equal(parseUsStateAndZip('Houston TX 77001').state, 'TX');
  assert.equal(parseUsStateAndZip('Austin, tx 78701').state, 'TX');
  assert.equal(parseUsStateAndZip('Denver, CO 80202, United States').state, 'CO');
});

test('E-16: typed fields without a complete free-text address can be parsed', () => {
  const parsed = parseUsStateAndZip({
    address: '1322 Main Street', city: 'Dallas', state: 'Texas', postalCode: '75201-0012', country: 'US',
  });
  assert.equal(parsed.status, 'parsed');
  assert.equal(parsed.state, 'TX');
  assert.equal(parsed.zip5, '75201');
  assert.equal(parsed.zip4, '0012');
  assert.equal(parsed.readyForTaxCalculation, false);
  assert.equal(parseUsStateAndZip({ state: 'NY', postalCode: '10001' }).status, 'parsed');
});

test('E-16: structured fields must agree with the detected last line', () => {
  assert.equal(parseUsStateAndZip({
    address: 'Houston TX 77001', state: 'CA', postalCode: '77001',
  }).issue, 'conflicting-fields');
  assert.equal(parseUsStateAndZip({
    address: 'Houston TX 77001', state: 'TX', postalCode: '90210',
  }).issue, 'conflicting-fields');
  assert.equal(parseUsStateAndZip({
    address: 'Houston TX 77001', state: 'TX', postalCode: '77001-0001',
  }).issue, 'conflicting-fields');
  assert.equal(parseUsStateAndZip({
    address: 'Houston TX 77001', state: 'TX', postalCode: '77001',
  }).status, 'parsed');
});

test('E-16: two full postal last lines are ambiguous, not arbitrarily last-wins', () => {
  const result = parseUsStateAndZip('Phoenix, AZ 85001\nDenver, CO 80202');
  assert.equal(result.status, 'needs-review');
  assert.equal(result.issue, 'ambiguous-address');
  assert.equal(result.readyForTaxCalculation, false);
});

test('E-16: street abbreviations and ambiguous English words are not states', () => {
  assert.equal(parseUsStateAndZip('123 Main St, 99999').state, null);
  assert.equal(parseUsStateAndZip('E Main St 10001').state, null);
  assert.equal(parseUsStateAndZip('I live in').state, null);
  assert.equal(parseUsStateAndZip('Our shop is in Oregon').state, null);
  assert.equal(parseUsStateAndZip('New York 10001').state, null);
  assert.equal(parseUsStateAndZip('11 Or Lane').state, null);
});

test('E-16: names ending in state codes do not qualify without ZIP or comma', () => {
  assert.equal(parseUsStateAndZip('St Louis MO').state, null);
  assert.equal(parseUsStateAndZip('Portland, OR').state, 'OR');
  assert.equal(parseUsStateAndZip('Portland, OR').status, 'partial');
  assert.equal(parseUsStateAndZip('Portland OR 97205').state, 'OR');
});

test('E-16: ZIP without state or state without ZIP remains incomplete', () => {
  const first = parseUsStateAndZip('Unknown Town 90210');
  assert.equal(first.status, 'needs-review');
  assert.equal(first.zip5, '90210');
  assert.equal(first.issue, 'no-region');
  const second = parseUsStateAndZip({ state: 'California' });
  assert.equal(second.status, 'partial');
  assert.equal(second.zip5, null);
});

test('E-16: rejects malformed ZIP+4 and unknown explicit state', () => {
  assert.equal(parseUsStateAndZip('Austin TX 78701-12').issue, 'invalid-zip');
  assert.equal(parseUsStateAndZip({ state: 'XX', postalCode: '78701' }).issue, 'invalid-region');
  assert.equal(parseUsStateAndZip({ state: 'CA', postalCode: '1234' }).issue, 'invalid-zip');
  assert.equal(parseUsStateAndZip({ state: 'CA', postalCode: '123456' }).issue, 'invalid-zip');
  assert.equal(parseUsStateAndZip({ state: 'CA', postalCode: '94105 1234' }).issue, 'invalid-zip');
});

test('E-16: foreign explicitly stated country must not turn into a US tax place', () => {
  for (const country of ['CA', 'IL', 'Israel', 'Canada', 'GB']) {
    const x = parseUsStateAndZip({ address: 'Austin TX 78701', country });
    assert.equal(x.status, 'needs-review');
    assert.equal(x.issue, 'foreign-country');
  }
  assert.equal(parseUsStateAndZip('Toronto ON M5H 1A1\nCanada').issue, 'foreign-country');
  assert.equal(parseUsStateAndZip('San Jose CA 95113\nUnited States of America').status, 'parsed');
});

test('E-16: territories and military mail codes are never misrepresented as states', () => {
  const pr = parseUsStateAndZip('San Juan, PR 00901');
  assert.equal(pr.state, 'PR');
  assert.equal(pr.regionKind, 'territory');
  assert.equal(pr.status, 'parsed');
  const military = parseUsStateAndZip('APO, AE 09001');
  assert.equal(military.state, 'AE');
  assert.equal(military.regionKind, 'military');
  assert.equal(military.status, 'needs-review');
  assert.equal(military.issue, 'military-mail');
});

test('E-16: does not guess county, city jurisdiction or tax from the ZIP', () => {
  const result = parseUsStateAndZip('Suburb, CO 80202');
  assert.equal(result.state, 'CO');
  assert.equal(Object.hasOwn(result, 'county'), false);
  assert.equal(Object.hasOwn(result, 'taxRate'), false);
  assert.equal(result.readyForTaxCalculation, false);
});

test('E-16: unknown/empty inputs and whitespace are safe', () => {
  for (const value of [null, undefined, '', '   ', '\r\n']) {
    assert.equal(parseUsStateAndZip(value).status, 'empty');
  }
  assert.equal(parseUsStateAndZip({}).status, 'empty');
  assert.equal(parseUsStateAndZip('12 West Main Street').issue, 'no-region');
  assert.equal(parseUsStateAndZip({ state: 'California', postalCode: '' }).status, 'partial');
});

test('E-16: structured input is never modified, and no raw street appears in result', () => {
  const input = Object.freeze({ address: '32 Private Plaza\nMiami FL 33101', country: 'USA' });
  const first = parseUsStateAndZip(input);
  assert.deepEqual(parseUsStateAndZip(input), first);
  assert.equal(input.address, '32 Private Plaza\nMiami FL 33101');
  assert.equal(JSON.stringify(first).includes('Private Plaza'), false);
  assert.equal(first.status, 'parsed');
});
