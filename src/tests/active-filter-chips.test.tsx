import './helpers/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ActiveFilterChips } from '../components/ledger/ActiveFilterChips';
import type { FilterCriteria } from '../types';

function Harness() {
  const [filters, setFilters] = useState<FilterCriteria>({ selectedProjects: ['פרויקט א', 'Project B'], selectedClasses: [], minAmount: 0, startDate: '2024-02-01' });
  const [search, setSearch] = useState('קבלה receipt');
  return <><ActiveFilterChips filters={filters} search={search} onFilters={setFilters} onSearch={setSearch} /><output>{JSON.stringify({ filters, search })}</output></>;
}
test('each active value has a removable chip; zero is active and empty arrays are hidden', () => {
  const view = render(<Harness />);
  try {
    assert.ok(view.getByRole('button', { name: 'Remove Minimum amount: 0 filter' }));
    assert.equal(view.queryByRole('button', { name: /Class/ }), null);
    fireEvent.click(view.getByRole('button', { name: 'Remove Project: פרויקט א filter' }));
    assert.ok(view.getByRole('button', { name: 'Remove Project: Project B filter' }));
    assert.ok(!view.getByRole('status').textContent?.includes('פרויקט א'));
    fireEvent.click(view.getByRole('button', { name: 'Remove List search: קבלה receipt filter' }));
    assert.ok(view.getByRole('button', { name: 'Remove From: 2024-02-01 filter' }));
    const state = JSON.parse(view.getByRole('status').textContent || '{}') as { filters: FilterCriteria; search: string };
    assert.equal(state.search, ''); assert.deepEqual(state.filters.selectedProjects, ['Project B']); assert.equal(state.filters.minAmount, 0);
  } finally { cleanup(); }
});
test('Clear All removes both local search and all applied filters without empty chips', () => {
  const view = render(<Harness />);
  try { fireEvent.click(view.getByRole('button', { name: 'Clear All' })); assert.equal(view.queryByRole('region', { name: 'Active filters' }), null); assert.deepEqual(JSON.parse(view.getByRole('status').textContent || '{}'), { filters: {}, search: '' }); }
  finally { cleanup(); }
});
