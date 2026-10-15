/**
 * A-58 screen: sales tax holidays. Hand-checked from the table: the Texas and Florida windows
 * with their caps and sources, the checker answering within/over the cap on the chosen date, and
 * outside every window the answer says no holiday is in force — never “exempt”.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import SalesTaxHolidaysReportView from '../components/reporting/SalesTaxHolidaysReportView';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

describe('Sales tax holidays screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ isGuest: true, user: null });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('the calendar shows both states with their caps and sources', () => {
    render(<SalesTaxHolidaysReportView today="2026-08-07" />);
    const table = screen.getByRole('table');
    const text = table.textContent || '';
    assert.match(text, /Texas \(TX\)/);
    assert.match(text, /Florida \(FL\)/);
    assert.match(text, /2026-08-07 → 2026-08-09/);
    assert.match(text, /2026-07-20 → 2026-08-20/);
    assert.match(text, /below 100\.00/, 'the Texas exclusive cap, in words');
    assert.match(text, /at or below 100\.00/, 'the Florida inclusive cap, in words');
    const hrefs = within(table).getAllByRole('link').map(link => (link as HTMLAnchorElement).href).join('\n');
    assert.match(hrefs, /comptroller\.texas\.gov/);
    assert.match(hrefs, /floridarevenue\.com/);
  });

  test('the checker answers within and over the cap on the chosen date', () => {
    render(<SalesTaxHolidaysReportView today="2026-08-07" />);
    assert.match(screen.getByTestId('holiday-in-force').textContent || '', /2026-08-07 to 2026-08-09/);
    const answer = screen.getByTestId('holiday-answer');
    assert.match(answer.textContent || '', /Within the cap/, '$45.00 is below the Texas $100 cap');
    fireEvent.change(screen.getByLabelText('Checker price'), { target: { value: '120' } });
    assert.match(screen.getByTestId('holiday-answer').textContent || '', /Over the cap/);
    assert.match(screen.getByTestId('holiday-answer').textContent || '', /whole item is taxable/);
    fireEvent.change(screen.getByLabelText('Holiday checker date'), { target: { value: '2026-12-01' } });
    assert.match(screen.getByTestId('holiday-answer').textContent || '', /No sales tax holiday/);
    assert.ok(screen.getByText(/never assumed absent/));
  });

  test('a guest can read and export the calendar', () => {
    render(<SalesTaxHolidaysReportView today="2026-08-07" />);
    const exportButton = screen.getByRole('button', { name: /Export CSV/ });
    assert.ok(!(exportButton as HTMLButtonElement).disabled);
    assert.ok(within(screen.getByRole('table')).getAllByRole('row').length >= 6, 'every row × its bands are listed');
  });
});
