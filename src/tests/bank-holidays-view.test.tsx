/**
 * A-137 screen: bank holidays and due dates. The Israeli calendar is the default; its 2026 list
 * (the Bank of Israel's own, pinned in the lib test) is on screen, and the due-date check answers
 * in words for the date it opens on.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BankHolidaysReportView from '../components/reporting/BankHolidaysReportView';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';

describe('Bank holidays screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('shows the Bank of Israel closures and moves a due date off Rosh Hashanah', () => {
    stubFetch(404);
    setComponentWorkspace('owner');
    render(<BankHolidaysReportView />);
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2026' } });
    const passover = screen.getByRole('rowheader', { name: '2026-04-02' }).parentElement!;
    assert.match(passover.textContent || '', /Passover \(Pesach\) 1st day/);
    assert.match(passover.textContent || '', /Closed/);
    assert.ok(screen.getAllByText(/Bank of Israel/).length >= 2, 'the authority is named in the calendar list and the source line');

    fireEvent.change(screen.getByLabelText('Due date to check'), { target: { value: '2026-09-12' } });
    assert.ok(
      screen.getByText(/moves to .*2026-09-14/),
      'Saturday 12 Sep, then Rosh Hashanah on Sunday: the date moves to Monday 14 Sep',
    );
  });
});
