/**
 * A-23 (PLAN IL-5) screen: the yearly withholding report. Hand-checked from the loaded payments:
 * one 2026 vendor row with its certificates and an effective rate, the note about the payment with
 * no certificate number, another year chosen from the picker, and the empty state for a year with
 * nothing withheld.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Form856ReportView from '../components/reporting/Form856ReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const payments = [
  { id: 'p1', date: '2026-03-10', direction: 'made', contactId: 'v1', contactName: 'Alpha Ltd', amountCents: 118_000, vatCents: 18_000, withheldCents: 30_000, withholdingCertificate: 'A-1' },
  { id: 'p2', date: '2026-09-02', direction: 'made', contactId: 'v1', contactName: 'Alpha Ltd', amountCents: 59_000, vatCents: 9_000, withheldCents: 10_000, withholdingCertificate: 'A-2' },
  { id: 'p3', date: '2026-05-05', direction: 'made', contactId: 'v2', contactName: 'Beta Works', amountCents: 236_000, vatCents: 36_000, withheldCents: 10_000 },
  { id: 'p4', date: '2025-12-31', direction: 'made', contactId: 'v3', contactName: 'Old Co', amountCents: 100_000, withheldCents: 30_000, withholdingCertificate: 'Z-1' },
  // a recorded year with no withholding at all: the picker offers it and the screen says so
  { id: 'p5', date: '2024-05-01', direction: 'made', contactId: 'v4', contactName: 'Plain Vendor', amountCents: 50_000 },
];

describe('Form 856 withholding report screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ isGuest: true, user: null });
    useDataNeedsStore.setState({ loaded: { payments: true } as never });
    useLedgerStore.setState({ payments: payments as never, baseCurrency: 'ILS' });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('shows the year’s vendors with withheld figures, rate, certificates and what is missing', () => {
    render(<Form856ReportView />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    assert.equal(rows.length, 2, 'only the two 2026 vendors');
    const alpha = within(table).getAllByRole('row')[1];
    assert.match(alpha.textContent || '', /Alpha Ltd/);
    assert.match(alpha.textContent || '', /26\.67%/);
    assert.match(alpha.textContent || '', /A-1, A-2/);
    assert.match(within(table).getAllByRole('row')[2].textContent || '', /Beta Works/);
    const notes = screen.getAllByRole('listitem').map(li => li.textContent || '');
    assert.ok(notes.some(n => /no certificate number recorded/.test(n)));
    assert.ok(notes.some(n => /Beta Works/.test(n)));
  });

  test('the year picker moves to the recorded year and the empty state says so', () => {
    render(<Form856ReportView />);
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2025' } });
    const table = screen.getByRole('table');
    assert.match(within(table).getAllByRole('row')[1].textContent || '', /Old Co/);
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2024' } });
    assert.equal(screen.queryByRole('table'), null);
    assert.match(screen.getByText(/No vendor payment in 2024 has tax withheld/).textContent || '', /2024/);
  });
});
