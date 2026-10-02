/** Transaction list filters in the address (I-17). */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { listStateFromParams, listStateToParams } from '../lib/listPermalink';

describe('List filters in the address', () => {
  test('round trip; report parameters are kept', () => {
    const params = listStateToParams({ search: 'aws', from: '2026-09-01', to: '2026-09-30' }, new URLSearchParams('report=pnl&y=2026'));
    assert.equal(params.toString(), 'report=pnl&y=2026&search=aws&from=2026-09-01&to=2026-09-30');
    assert.deepEqual(listStateFromParams(params), { search: 'aws', from: '2026-09-01', to: '2026-09-30' });
  });

  test('empty values and bad dates are dropped', () => {
    const params = listStateToParams({ search: '  ', from: 'yesterday', to: '' }, new URLSearchParams('search=old&from=2026-01-01'));
    assert.equal(params.toString(), '');
    assert.deepEqual(listStateFromParams(new URLSearchParams('from=2026-13-xx&search=x')), { search: 'x', from: undefined, to: undefined });
  });
});
