import './helpers/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { TransactionTotalsRow } from '../components/ledger/TransactionTotalsRow';
import { formatCurrency } from '../lib/utils';

test('the totals row presents supplied filtered amounts, including an empty result and truncation', () => {
  const view = render(<TransactionTotalsRow inflowCents={12345} outflowCents={5000} count={3} incomplete={false} />);
  try {
    assert.ok(view.getByRole('region', { name: 'Filtered transaction totals' }));
    assert.ok(view.getByText(formatCurrency(12345))); assert.ok(view.getByText(formatCurrency(5000)));
    assert.equal(view.queryByRole('status'), null);
    view.rerender(<TransactionTotalsRow inflowCents={0} outflowCents={0} count={0} incomplete />);
    assert.equal(view.getAllByText(formatCurrency(0)).length, 2);
    assert.match(view.getByRole('status').textContent || '', /loaded matching records.*incomplete/);
  } finally { cleanup(); }
});
