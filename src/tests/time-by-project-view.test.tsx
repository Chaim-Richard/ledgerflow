/**
 * A-179 screen: time by person and project. Two entries in the current month (2:00 approved and
 * 1:30 waiting, both billable, both on the Website project) come back over the stubbed fetch.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import TimeByProjectReportView from '../components/reporting/TimeByProjectReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { getSupabase } from '../lib/db/client';
import { getLocalDateISO } from '../lib/utils';

const month = getLocalDateISO().slice(0, 7);
const entry = (over: Record<string, unknown>) => ({
  id: 'e', kind: 'timeEntry', workspaceId: 'component-workspace', person: 'Noa Levi',
  date: `${month}-03`, minutes: 120, description: 'work', projectId: 'p1',
  billable: true, status: 'approved', createdAt: `${month}-03T10:00:00Z`, ...over,
});

describe('Time by person and project screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('asks the Time API and shows the person-project minutes by hand', async () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({
      projects: [{ id: 'p1', name: 'Website rebuild', workspaceId: 'component-workspace' }],
    } as never);
    const calls = stubFetchWithBodies(200, {
      entries: [entry({ id: 'e1', minutes: 120 }), entry({ id: 'e2', minutes: 90, status: 'submitted' })],
      rates: undefined, canApprove: true,
    });
    render(<TimeByProjectReportView />);
    await waitFor(() => assert.ok(screen.getByRole('rowheader', { name: 'Noa Levi' })));
    assert.ok(calls[0].url.startsWith('/api/v1/workspaces/component-workspace/time'));
    const row = screen.getByRole('rowheader', { name: 'Noa Levi' }).parentElement!;
    assert.match(row.textContent || '', /Website rebuild/);
    assert.match(row.textContent || '', /3:30 h/, '120 + 90 minutes');
    assert.match(row.textContent || '', /1:30 h/, 'the waiting part is inside the total, shown apart');
  });
});
