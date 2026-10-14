import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonthsYMD } from '../lib/fiscalCalendar';
import { RECORD_RETENTION_REVIEW_PERIODS, retentionReview, type RetentionSourceRecord } from '../lib/retentionReview';
import type { DimensionNode } from '../types';
import type { TaxProfiles } from '../lib/tax/profile';

const record = (overrides: Partial<RetentionSourceRecord> = {}): RetentionSourceRecord => ({
  collection: 'invoices', id: 'inv-1', number: 'INV-1', date: '2019-05-01', status: 'paid', ...overrides,
});

const profiles: TaxProfiles = {
  books: { name: 'US books', place: { country: 'US' } },
  labels: { 'world:L1': { name: 'Israel entity', place: { country: 'IL' } } },
};

test('A-144 exposes the owner-specified periods and applies them as calendar years, not deletion rules', () => {
  assert.deepEqual(RECORD_RETENTION_REVIEW_PERIODS.map(period => [period.countryCode, period.years]), [
    ['IL', 7], ['US', 7], ['GB', 6],
  ]);
  const report = retentionReview({
    records: [
      record({ id: 'il', lineDimensions: [{ world: 'L1' }] }),
      record({ id: 'us', date: '2019-05-02' }),
      record({ id: 'uk', date: '2020-05-01', dimensions: { world: 'UK1' }, collection: 'bills' }),
    ],
    profiles: { ...profiles, labels: { ...profiles.labels, 'world:UK1': { place: { country: 'GB' }, name: 'UK subsidiary' } } },
    asOfDate: '2026-05-01',
  });
  const il = report.rows.find(row => row.recordId === 'il');
  const us = report.rows.find(row => row.recordId === 'us');
  const uk = report.rows.find(row => row.recordId === 'uk');
  assert.equal(il?.countryCode, 'IL');
  assert.equal(il?.entity, 'Israel entity');
  assert.equal(il?.reviewDueOn, '2026-05-01');
  assert.equal(il?.reviewState, 'due', 'the due date is inclusive');
  assert.equal(us?.countryCode, 'US');
  assert.equal(us?.reviewDueOn, '2026-05-02');
  assert.equal(us?.reviewState, 'not-due');
  assert.equal(uk?.countryCode, 'GB');
  assert.equal(uk?.periodYears, 6);
  assert.equal(uk?.reviewDueOn, '2026-05-01');
  assert.equal(uk?.reviewState, 'due');
  assert.equal(report.dueCount, 2);
});

test('legacy dimension descriptions and aliases resolve to stable Tax-profile node IDs without duplicate entities', () => {
  const dimensionNodes: DimensionNode[] = [
    { id: 'E1', dimensionId: 'world', description: 'East entity', aliases: ['Former East'] },
  ];
  const taxProfiles: TaxProfiles = {
    books: { name: 'US books', place: { country: 'US' } },
    labels: {
      'world:E1': { name: 'East entity', place: { country: 'IL' } },
      'world:E1/branch': { name: 'East branch', place: { country: 'GB' } },
    },
  };
  const report = retentionReview({
    records: [
      record({ id: 'alias-header', dimensions: { world: 'Former East' } }),
      record({ id: 'description-line', lineDimensions: [{ world: 'East entity' }] }),
      record({ id: 'hierarchical-alias', dimensions: { world: 'Former East/branch' } }),
      record({ id: 'same-entity', lineDimensions: [{ world: 'E1' }, { world: 'Former East' }, { world: 'East entity' }] }),
    ],
    profiles: taxProfiles,
    dimensionNodes,
    asOfDate: '2026-05-01',
  });

  for (const id of ['alias-header', 'description-line', 'same-entity']) {
    const row = report.rows.find(candidate => candidate.recordId === id);
    assert.equal(row?.countryCode, 'IL', id);
    assert.equal(row?.profileSource, 'world:E1', id);
  }
  const hierarchical = report.rows.find(candidate => candidate.recordId === 'hierarchical-alias');
  assert.equal(hierarchical?.countryCode, 'GB');
  assert.equal(hierarchical?.profileSource, 'world:E1/branch');
  assert.equal(report.rows.filter(row => row.recordId === 'same-entity').length, 1, 'equivalent IDs, descriptions and aliases collapse to one entity context');
});

test('a linked file inherits its source document date and entity, and an orphan stays unclassified', () => {
  const report = retentionReview({
    records: [record({ id: 'src', number: 'B-4', collection: 'bills', date: '2018-01-01', lineDimensions: [{ world: 'L1' }] })],
    attachments: [
      { id: 'file-1', name: 'receipt.pdf', linkedCollection: 'bills', linkedId: 'src' },
      { id: 'file-orphan', name: 'orphan.pdf', linkedCollection: 'invoices', linkedId: 'not-loaded' },
      { id: 'not-supported', name: 'party.pdf', linkedCollection: 'customers', linkedId: 'c1' },
    ],
    profiles,
    asOfDate: '2025-01-01',
  });
  const file = report.rows.find(row => row.recordId === 'file-1');
  const orphan = report.rows.find(row => row.recordId === 'file-orphan');
  assert.equal(file?.recordType, 'Bill attachment');
  assert.equal(file?.recordDate, '2018-01-01');
  assert.equal(file?.countryCode, 'IL');
  assert.equal(file?.reviewState, 'due');
  assert.equal(file?.relatedRecord, 'B-4');
  assert.equal(orphan?.reviewState, 'unclassified');
  assert.match(orphan?.reason || '', /source record/);
  assert.equal(report.rows.some(row => row.recordId === 'not-supported'), false);
});

test('a missing tax-profile country is unknown even when a registration carries a country', () => {
  const noPlace: TaxProfiles = {
    books: {
      registrations: [{ kind: 'vat', number: 'IL-123', place: { country: 'IL' } }],
    },
  };
  const report = retentionReview({
    records: [record()],
    profiles: noPlace,
    asOfDate: '2026-05-01',
  });
  assert.equal(report.rows[0].countryCode, '');
  assert.equal(report.rows[0].reviewState, 'unclassified');
  assert.equal(report.rows[0].reviewDueOn, undefined);
  assert.match(report.rows[0].reason || '', /Country is not recorded/);
});

test('unsupported countries and invalid dates remain unclassified rather than guessed', () => {
  const report = retentionReview({
    records: [
      record({ id: 'ca', date: '2010-01-01' }),
      record({ id: 'missing-date', date: 'not-a-date' }),
    ],
    profiles: { books: { place: { country: 'CA' } } },
    asOfDate: '2026-05-01',
  });
  assert.equal(report.rows.find(row => row.recordId === 'ca')?.reviewState, 'unclassified');
  assert.match(report.rows.find(row => row.recordId === 'ca')?.reason || '', /No A-144 review period/);
  assert.equal(report.rows.find(row => row.recordId === 'missing-date')?.reviewState, 'unclassified');
  assert.match(report.rows.find(row => row.recordId === 'missing-date')?.reason || '', /document date/);
});

test('the UK timetable requires ISO alpha-2 GB rather than treating UK as the TaxPlace country code', () => {
  const report = retentionReview({
    records: [record()],
    profiles: { books: { place: { country: 'UK' } } },
    asOfDate: '2026-05-01',
  });
  assert.equal(report.rows[0].countryCode, 'UK');
  assert.equal(report.rows[0].periodYears, undefined);
  assert.equal(report.rows[0].reviewState, 'unclassified');
});

test('mixed-dimension documents keep each entity context and unassigned lines fall back to Books', () => {
  const report = retentionReview({
    records: [record({
      id: 'mixed',
      lineDimensions: [{ world: 'L1' }, {}, { world: 'L1' }],
    })],
    profiles,
    asOfDate: '2026-05-01',
  });
  assert.deepEqual(report.rows.map(row => [row.entity, row.countryCode]), [['Israel entity', 'IL'], ['US books', 'US']]);
});

test('calendar-year addition clamps leap day to the target month without UTC timestamp arithmetic', () => {
  assert.equal(addMonthsYMD('2024-02-29', 72), '2030-02-28');
  assert.equal(addMonthsYMD('2024-02-29', 96), '2032-02-29');
  assert.throws(() => retentionReview({ records: [], asOfDate: '2026-02-30' }), /valid as-of date/);
});
