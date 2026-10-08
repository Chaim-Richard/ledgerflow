/**
 * Needs attention (DA-02): one row per kind of thing to do, worked out from the books, so a row is
 * there only while its cause is: bank lines to review, invoices waiting for approval, serious Data
 * Health problems, entries missing a required label, duplicate bills, and last month not closed
 * (from the workspace's reminder day). Each says why and who, and opens its screen.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { needsAttention } from '../lib/needsAttention';
import NeedsAttentionCard from '../components/dashboard/NeedsAttentionCard';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { stubFetch } from './helpers/dom';
import type { CheckFinding } from '../lib/dataChecks';
import { getSupabase } from '../lib/db/client';

const finding = (checkId: string, severity: CheckFinding['severity'] = 'high'): CheckFinding => ({ id: `${checkId}-${Math.random()}`, checkId, severity, title: '', description: '' });
const approval = { enabled: true, thresholdCents: 1000 };

describe('The queue', () => {
  test('each kind of thing to do once, with how many, why, who and where', () => {
    const rows = needsAttention({
      today: '2026-10-12', workspace: { invoiceApproval: approval, lockDate: '2026-08-31' } as never,
      bankLines: [{ status: 'pending' }, { status: 'pending' }, { status: 'matched' }],
      invoices: [{ amountCents: 5000, status: 'pending' }, { amountCents: 500, status: 'pending' }] as never,
      findings: [finding('unbalanced'), finding('missing-label'), finding('missing-label'), finding('duplicate-bill'), finding('future-dated', 'medium')],
    });
    assert.deepEqual(rows.map(r => [r.id, r.text, r.page.tab]), [
      ['bank-lines', '2 bank lines to review', 'reconciliation'],
      ['approvals', '1 invoice waiting for approval', 'sales'],
      ['serious', '1 serious problem in the books', 'data-health'],
      ['missing-label', '2 entries missing a required label', 'data-health'],
      ['duplicate-bill', '1 possible duplicate bill', 'data-health'],
      ['close', 'September 2026 is not closed', 'month-end-close'],
    ]);
    assert.ok(rows.every(r => r.why && r.who));
  });

  test('questions about entries: waiting for the owner, and answers to read', () => {
    const rows = needsAttention({ today: '2026-10-05', workspace: { lockDate: '2026-09-30' } as never, questions: [{ status: 'open' }, { status: 'open' }, { status: 'answered' }, { status: 'closed' }] });
    assert.deepEqual(rows.map(r => [r.text, r.who, r.page.tab]), [
      ['2 questions about entries waiting for an answer', 'the owner', 'client-queries'],
      ['1 answer to read', 'owners, accountants and bookkeepers', 'client-queries'],
    ]);
  });

  test('a row goes when its cause does: nothing waiting is an empty queue', () => {
    assert.deepEqual(needsAttention({ today: '2026-10-12', workspace: { lockDate: '2026-09-30' } as never, bankLines: [{ status: 'matched' }], findings: [finding('future-dated', 'low')] }), []);
  });

  test('last month is due from the workspace\'s reminder day (the 10th by default)', () => {
    const open = { lockDate: '2026-08-31' } as never;
    assert.equal(needsAttention({ today: '2026-10-09', workspace: open }).length, 0);
    assert.equal(needsAttention({ today: '2026-10-10', workspace: open }).length, 1);
    assert.equal(needsAttention({ today: '2026-10-03', workspace: open, closeByDay: 3 })[0].text, 'September 2026 is not closed');
    assert.equal(needsAttention({ today: '2026-01-15', workspace: { lockDate: '2025-11-30' } as never })[0].text, 'December 2025 is not closed');
  });
});

describe('On the Overview', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('shows the rows; one opens its screen', async () => {
    stubFetch(404);
    setComponentWorkspace('owner');
    useAuthStore.setState(s => ({ workspaces: s.workspaces.map(w => ({ ...w, lockDate: new Date().toISOString().slice(0, 7) + '-01' })) }));
    markComponentCollectionsLoaded('bankLines', 'bills', 'inventory', 'invoices', 'recurring');
    useLedgerStore.setState({ bankLines: [{ id: 'l1', status: 'pending', date: '2026-10-01', amountCents: 100, description: 'x' }] as never, invoices: [], bills: [], transactions: [], accounts: [], recurring: [], inventory: [] });
    render(<NeedsAttentionCard />);
    assert.ok(screen.getByRole('heading', { name: 'Needs attention' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /1 bank line to review/ })); });
    assert.equal(useUIStore.getState().activeTab, 'reconciliation');
  });

  test('nothing waiting says so in one line', () => {
    stubFetch(404);
    setComponentWorkspace('owner');
    useAuthStore.setState(s => ({ workspaces: s.workspaces.map(w => ({ ...w, lockDate: '2099-12-31' })) }));
    markComponentCollectionsLoaded('bankLines', 'bills', 'inventory', 'invoices', 'recurring');
    useLedgerStore.setState({ bankLines: [], invoices: [], bills: [], transactions: [], accounts: [], recurring: [], inventory: [] });
    render(<NeedsAttentionCard />);
    assert.match(document.body.textContent || '', /Nothing waiting/);
  });
});
