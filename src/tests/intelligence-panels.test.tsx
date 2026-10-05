import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { ProjectProfitMatrix } from '../components/intelligence/ProjectProfitMatrix';
import { D3LedgerVisualizer } from '../components/intelligence/D3LedgerVisualizer';

globalThis.ResizeObserver = window.ResizeObserver;

afterEach(cleanup);

test('profit matrix shows empty state, then mixed-language project names and original margins', () => {
  const onAction = () => {};
  const view = render(<ProjectProfitMatrix projectStats={[]} onAction={onAction} />);
  assert.ok(view.getByText(/No enterprise segments/));
  view.rerender(<ProjectProfitMatrix projectStats={[{ id: 'p1', name: 'Project ירושלים', profit: 120, margin: 40, expense: 180 }]} onAction={onAction} />);
  assert.ok(view.getByText('Project ירושלים'));
  assert.ok(view.getByText('40.0% Margin'));
  assert.ok(view.getByText('EFFICIENT'));
  assert.equal(view.queryByText(/No enterprise segments/), null);
});

test('D3 visualizer renders its transaction-volume panel with an empty ledger', () => {
  const view = render(<D3LedgerVisualizer data={[]} />);
  assert.ok(view.getByText('Recent Transaction Volume'));
  assert.ok(view.getByText('Hover series peaks to scope ledger context'));
});
