import test from 'node:test';
import assert from 'node:assert/strict';
import type { AlgorithmDefinition } from '../lib/algorithms/types';
import { algorithmReportPeriod } from '../lib/algorithmReportPeriod';

const algorithm: Pick<AlgorithmDefinition, 'inputs'> = {
  inputs: [{
    kind: 'dateRange', key: 'range', label: 'Reporting range',
    defaultValue: { start: '2026-01-01', end: '2026-01-31' },
  }],
};

test('C-87: the selected algorithm date range labels the export header', () => {
  const actual = algorithmReportPeriod(algorithm, {
    range: { start: '2025-07-01', end: '2025-09-30' },
  }, '2026-10-26');
  assert.deepEqual(actual.period, { start: '2025-07-01', end: '2025-09-30' });
  assert.equal(actual.label, '2025-07-01 to 2025-09-30');
  assert.equal(actual.asOfDate, '2026-10-26');
});

test('without a date range the export uses the same as-of date as the preview', () => {
  const actual = algorithmReportPeriod(algorithm, { asOfDate: '2026-09-30' }, '2026-10-26');
  assert.deepEqual(actual.period, { start: '1970-01-01', end: '2026-09-30' });
  assert.equal(actual.label, 'Through 2026-09-30');
});
