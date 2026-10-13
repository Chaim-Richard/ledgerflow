/**
 * A-55: US exemption certificate types and the T-05 type field. Hand-checked: the vocabulary names
 * the six claim kinds plus the two multistate forms, each with an official source and a date; the
 * SST member list is the 24 full member states and contains none of the five no-sales-tax states;
 * a state's acceptance answer is only what this file can honestly say (SST member, the MTC pointer,
 * or no state form of its own); and the customer certificate keeps a type only from the vocabulary —
 * a junk string is dropped, never guessed at, and the existing T-05 behaviour is unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  US_EXEMPTION_CERTIFICATE_TYPES, SST_MEMBER_STATES, CERTIFICATE_TYPE_IDS,
  certificateAcceptance, exemptionCertificateType, certificateTypeName, exemptionCertificateProblems,
} from '../lib/tax/usExemptionCertificates';
import { taxExemptionOf, exemptionOn } from '../lib/taxExemption';
import { NO_STATE_SALES_TAX } from '../lib/tax/usStateSalesTax';

test('the vocabulary: eight types, each dated with an official source', () => {
  assert.deepEqual(exemptionCertificateProblems(), []);
  assert.equal(US_EXEMPTION_CERTIFICATE_TYPES.length, 8);
  for (const id of ['resale', 'manufacturing', 'nonprofit', 'government', 'agricultural', 'educational', 'sst-multistate', 'mtc-uniform-resale'] as const) {
    const row = exemptionCertificateType(id);
    assert.ok(row, id);
    assert.match(row.source.url, /^https:\/\//, id);
    assert.match(row.validFrom, /^\d{4}-\d{2}-\d{2}$/, id);
    assert.ok(row.whatItClaims.length > 20, `${id} says what it claims in plain words`);
  }
  assert.equal(exemptionCertificateType('RESALE')?.id, 'resale', 'looked up case-insensitively');
  assert.equal(exemptionCertificateType('made-up'), undefined);
  assert.equal(certificateTypeName('resale'), 'Resale');
  assert.equal(certificateTypeName('something else'), 'something else', 'an unknown recorded string is shown as itself, never renamed');
  assert.equal(CERTIFICATE_TYPE_IDS.length, 8);
});

test('the multistate forms: SST members are the 24 full member states, no no-tax state among them', () => {
  assert.equal(SST_MEMBER_STATES.length, 24);
  assert.equal(new Set(SST_MEMBER_STATES).size, 24);
  for (const noTax of NO_STATE_SALES_TAX) assert.ok(!SST_MEMBER_STATES.includes(noTax), noTax);
  assert.match(exemptionCertificateType('mtc-uniform-resale')?.note || '', /MTC/, 'the accepting-states list stays the MTC’s own, never restated here');
  assert.match(exemptionCertificateType('sst-multistate')?.source.url || '', /streamlinedsalestax\.org/);
});

test('acceptance says only what is known: SST member, the MTC pointer, or no state form', () => {
  assert.equal(certificateAcceptance('OH'), 'sst-member');
  assert.equal(certificateAcceptance('oh'), 'sst-member', 'case-insensitive');
  assert.equal(certificateAcceptance('TX'), 'see-mtc-list');
  assert.equal(certificateAcceptance('NY'), 'see-mtc-list');
  for (const noTax of NO_STATE_SALES_TAX) assert.equal(certificateAcceptance(noTax), 'own-form-only', noTax);
});

test('T-05: the certificate keeps a vocabulary type and drops junk; the existing behaviour is unchanged', () => {
  const customer = { metadata: { taxExemption: { number: ' TX-1234 ', expires: '2027-06-30', type: ' Resale ' } } };
  assert.deepEqual(taxExemptionOf(customer), { number: 'TX-1234', expires: '2027-06-30', type: 'resale' });

  const junk = { metadata: { taxExemption: { number: 'TX-1', type: 'trust-me-bro' } } };
  assert.deepEqual(taxExemptionOf(junk), { number: 'TX-1' }, 'a type outside the vocabulary is dropped');

  const legacy = { metadata: { taxExemption: { number: 'TX-2' } } };
  assert.deepEqual(taxExemptionOf(legacy), { number: 'TX-2' }, 'a certificate recorded before the type field is unchanged');

  assert.equal(taxExemptionOf({ metadata: { taxExemption: { number: '  ', type: 'resale' } } }), undefined, 'no number, no certificate');

  // exemptionOn still answers from the number and the date alone — the type never exempts anything
  const exempt = exemptionOn(customer, '2026-10-13');
  assert.equal(exempt?.state, 'exempt');
  assert.equal(exempt?.certificate.type, 'resale');
  assert.equal(exemptionOn(customer, '2027-07-01')?.state, 'expired');
});
