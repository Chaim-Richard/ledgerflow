import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTable, realDate, type TableSpec } from '../../scripts/tax-table-validation';
import { checkTaxTables, looksLikeTaxTable } from '../../scripts/validate-tax-tables';

const spec: TableSpec = { file: 'fixture.ts', name: 'RATES', keys: ['state', 'kind'], fractions: ['rate'] };
const row = (changes: Record<string, unknown> = {}): Record<string, unknown> => ({
  state: 'TX', kind: 'standard', rate: 0.0625, validFrom: '2024-01-01',
  source: 'https://comptroller.texas.gov/taxes/', ...changes,
});
const rules = (rows: unknown) => validateTable(spec, rows).map(problem => problem.rule);

test('adjacent inclusive histories, leap days and zero/one endpoints are valid without mutating inputs', () => {
  const rows = Object.freeze([
    Object.freeze(row({ rate: 0, validTo: '2024-02-29' })),
    Object.freeze(row({ rate: 1, validFrom: '2024-03-01', validTo: null })),
  ]);
  assert.deepEqual(validateTable(spec, rows), []);
  assert.equal(rows[0].validTo, '2024-02-29');
  assert.equal(rows[1].rate, 1);
});

test('same-day, duplicate, nested and open-ended overlaps are detected even out of order', () => {
  for (const rows of [
    [row({ validTo: '2024-03-01' }), row({ validFrom: '2024-03-01' })],
    [row(), row()],
    [row({ validFrom: '2024-06-01', validTo: '2024-07-01' }), row({ validTo: '2024-12-31' }), row({ validFrom: '2024-08-01', validTo: '2024-09-01' })],
    [row(), row({ validFrom: '2025-01-01', validTo: '2025-12-31' })],
  ]) assert.ok(rules(rows).includes('overlap'));
});

test('different jurisdictions and tax categories are independent histories', () => {
  assert.deepEqual(validateTable(spec, [row(), row({ state: 'CA' }), row({ kind: 'food' })]), []);
  assert.deepEqual(validateTable({ ...spec, keys: ['kind', 'appliesTo?'] }, [
    row({ kind: 'reduced', appliesTo: 'food' }), row({ kind: 'reduced', appliesTo: 'transport' }),
  ]), []);
  assert.ok(rules([row({ state: undefined })]).includes('identity'));
});

test('calendar validation rejects rollover dates, time suffixes, invalid leap years and backwards ranges', () => {
  for (const value of ['2023-02-29', '2024-02-30', '2024-04-31', '2024-00-01', '2024-13-01', '0000-01-01', '24-01-01', '2024-01-01T00:00:00Z', null, 2024]) {
    assert.equal(realDate(value), false, String(value));
    assert.ok(rules([row({ validFrom: value })]).includes('date'));
  }
  assert.equal(realDate('2000-02-29'), true);
  assert.equal(realDate('1900-02-29'), false);
  assert.ok(rules([row({ validTo: '2023-12-31' })]).includes('date'));
  assert.ok(rules([row({ validTo: '' })]).includes('date'));
});

test('each source needs a usable HTTPS pointer and structured sources need authority and retrieval date', () => {
  assert.deepEqual(validateTable(spec, [row({ source: { authority: 'State revenue department', url: 'https://example.gov/tax', retrieved: '2024-02-29' } })]), []);
  for (const source of ['', undefined, 'javascript:alert(1)', 'http://example.gov', 'https://user:password@example.gov',
    ' https://example.gov', { authority: '', url: 'https://example.gov', retrieved: '2024-01-01' },
    { authority: 'Authority', url: 'https://example.gov', retrieved: '2023-02-29' }]) {
    assert.ok(rules([row({ source })]).includes('source'));
  }
});

test('rate units reject negative, nonfinite, string, null and out-of-range values', () => {
  for (const rate of [-0.001, 1.01, NaN, Infinity, '0.18', null, undefined]) assert.ok(rules([row({ rate })]).includes('range'));
  const percent: TableSpec = { ...spec, fractions: [], percentages: ['ratePercent'] };
  for (const value of [0, 18, 100]) assert.deepEqual(validateTable(percent, [row({ ratePercent: value })]), []);
  for (const value of [-1, 100.01, Infinity]) assert.ok(validateTable(percent, [row({ ratePercent: value })]).some(p => p.rule === 'range'));
});

test('monetary thresholds use safe integers rather than fraction-rate bounds', () => {
  const amount: TableSpec = { ...spec, fractions: [], amounts: ['rate'] };
  assert.deepEqual(validateTable(amount, [row({ rate: 25000 })]), []);
  for (const rate of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN]) assert.ok(validateTable(amount, [row({ rate })]).some(p => p.rule === 'range'));
});

test('optional taxability rates can be absent, but a reduced treatment requires its rate', () => {
  const optional: TableSpec = { ...spec, fractions: ['rate?'] };
  assert.deepEqual(validateTable(optional, [row({ rate: undefined, treatment: 'unclear' })]), []);
  for (const changes of [{ rate: null }, { rate: undefined, treatment: 'reduced' }]) {
    assert.ok(validateTable(optional, [row(changes)]).some(p => p.rule === 'range'));
  }
  assert.ok(validateTable(spec, []).some(p => p.rule === 'empty'));
  assert.ok(validateTable(spec, undefined).some(p => p.rule === 'shape'));
});

test('annual tables keep independent calendar-year ranges and detect duplicate years', () => {
  const year: TableSpec = { file: 'year.ts', name: 'YEAR', keys: [], mode: 'year' };
  const annual = { year: 2025, source: 'https://www.irs.gov/instructions/iw2w3' };
  assert.deepEqual(validateTable(year, [annual, { ...annual, year: 2026 }]), []);
  assert.ok(validateTable(year, [annual, annual]).some(p => p.rule === 'overlap'));
  assert.ok(validateTable(year, [{ ...annual, year: '2025' }]).some(p => p.rule === 'date'));
});

test('holiday bands retain their own scope, dates and integer caps', () => {
  const holiday: TableSpec = { file: 'holiday.ts', name: 'HOLIDAY', keys: ['state', 'name', 'bandId'], amounts: ['capCents'], mode: 'holiday' };
  const published = { state: 'TX', name: 'Back-to-School', from: '2026-08-07', to: '2026-08-09',
    source: 'https://comptroller.texas.gov/', bands: [{ id: 'clothes', capCents: 10000 }, { id: 'supplies', capCents: 10000 }] };
  assert.deepEqual(validateTable(holiday, [published]), []);
  assert.ok(validateTable(holiday, [published, published]).some(p => p.rule === 'overlap'));
  assert.ok(validateTable(holiday, [{ ...published, bands: [] }]).some(p => p.rule === 'range'));
});

test('reference-format review dates are not invented effective dates', () => {
  const reference: TableSpec = { file: 'format.ts', name: 'FORMAT', keys: ['country'], mode: 'reference' };
  assert.deepEqual(validateTable(reference, { GB: { source: 'https://www.gov.uk/', reviewedOn: '2026-10-11' } }), []);
  assert.ok(validateTable(reference, { GB: { source: 'https://www.gov.uk/', reviewedOn: '2026-02-30' } }).some(p => p.rule === 'date'));
});

test('discovery sees new row exports even when dates or sources were accidentally removed', () => {
  for (const candidate of [[{ rate: 0.18 }], [{ source: 'https://example.gov' }], { AA: { source: 'https://example.gov' } }]) assert.equal(looksLikeTaxTable(candidate), true);
  for (const vocabulary of [['TX', 'CA'], { standard: 'Standard' }, 0.18, () => []]) assert.equal(looksLikeTaxTable(vocabulary), false);
});

test('all current tax modules and structured tables have contracts and valid rows', async () => {
  const result = await checkTaxTables();
  assert.ok(result.tables >= 24);
  assert.deepEqual(result.problems, [], result.problems.map(p => p.table + ':' + p.row + ' ' + p.message).join('\n'));
});
