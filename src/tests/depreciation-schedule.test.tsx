/**
 * Depreciation schedule (X-02): month by month by the asset's own method from the month after the
 * purchase, adding up to cost − salvage exactly; by year on screen with what the month-end run
 * already posted.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { depreciationSchedule, depreciationThrough, scheduleByYear } from '../lib/depreciationEngine';
import FixedAssetsView from '../components/assets/FixedAssetsView';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { FixedAsset } from '../types';

const van: FixedAsset = {
  id: 'van', uid: 'u', workspaceId: 'component-workspace', name: 'Delivery van', purchaseDate: '2026-01-15', purchasePriceCents: 1_200_000,
  salvageValueCents: 0, usefulLifeYears: 5, depreciationMethod: 'straight-line', accumulatedDepreciationCents: 160_000, depreciatedThrough: '2026-09',
  status: 'active', createdAt: '2026-01-15',
};

describe('Depreciation schedule', () => {
  afterEach(() => cleanup());

  test('straight line: 60 months of 200.00 from February 2026; the first 8 posted', () => {
    const months = depreciationSchedule(van);
    assert.equal(months.length, 60);
    assert.deepEqual([months[0].month, months[59].month], ['2026-02', '2031-01']);
    assert.ok(months.every(m => m.amountCents === 20_000));
    assert.deepEqual(months.filter(m => m.posted).map(m => m.month), ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    assert.equal(months[59].bookValueCents, 0);
    // the schedule and what the month-end run posts agree
    assert.equal(months.find(m => m.month === '2026-10')!.accumulatedCents, depreciationThrough(van, '2026-10'));
  });

  test('by year: 2026 has 11 months, 2031 one; declining balance still adds up to cost − salvage', () => {
    const years = scheduleByYear(depreciationSchedule(van));
    assert.deepEqual(years.map(y => [y.year, y.months, y.amountCents, y.bookValueCents]).slice(0, 2), [['2026', 11, 220_000, 980_000], ['2027', 12, 240_000, 740_000]]);
    assert.deepEqual(years.at(-1), { year: '2031', amountCents: 20_000, accumulatedCents: 1_200_000, bookValueCents: 0, months: 1, posted: false });
    const ddb = depreciationSchedule({ ...van, depreciationMethod: 'declining-balance', salvageValueCents: 100_000 });
    assert.equal(ddb.at(-1)!.accumulatedCents, 1_100_000);
    assert.ok(ddb[0].amountCents > ddb[30].amountCents, 'more at the start');
  });

  test('on the register: Schedule opens the yearly table for that asset', () => {
    setComponentWorkspace('viewer');
    useLedgerStore.setState({ assets: [van], accounts: [] } as never);
    markComponentCollectionsLoaded('assets');
    render(<FixedAssetsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Schedule of Delivery van' }));
    const table = screen.getByRole('table', { name: 'Depreciation schedule of Delivery van by year' });
    const first = within(table).getByRole('row', { name: /2026 \(11 mo\)/ });
    assert.equal(first.textContent, '2026 (11 mo)$2,200.00$2,200.00$9,800.00not yet');
    assert.equal(within(table).getAllByRole('row').length, 7, 'header and 6 years');
  });
});
