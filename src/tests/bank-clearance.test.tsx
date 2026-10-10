/**
 * Bank clearance summary (CB-24): each entry on the bank account and the day its statement line
 * cleared it; outstanding at the end (not cleared, or cleared only after it); the balance the bank
 * should show; undone entries left out; on screen.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { bankClearance } from '../lib/bankClearance';
import BankClearanceReportView from '../components/reporting/BankClearanceReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount } from './fixtures';
import { getSupabase } from '../lib/db/client';
import type { BankStatementLine, Transaction } from '../types';

const entry = (id: string, date: string, cents: number, extra: Partial<Transaction> = {}) => ({
  id, date, description: id, status: 'completed', type: 'actual', lines: [{ accountId: 'bank', amountCents: cents }, { accountId: 'other', amountCents: -cents }], ...extra,
}) as unknown as Transaction;
const transactions = [
  entry('opening', '2026-08-31', 100_000, { status: 'reconciled' } as never),
  entry('deposit', '2026-09-05', 50_000),
  entry('cheque', '2026-09-20', -30_000),
  entry('late-deposit', '2026-09-29', 20_000),
  entry('undone', '2026-09-10', -99_000, { reversalEventId: 'x' } as never),
];
const line = (id: string, date: string, matched: string) => ({ id, uid: 'u', workspaceId: 'w', date, description: id, amountCents: 0, status: 'matched', matchedTransactionId: matched }) as BankStatementLine;
const bankLines = [line('l1', '2026-09-06', 'deposit'), line('l2', '2026-10-02', 'late-deposit')];

describe('Bank clearance summary', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('cleared on its statement line\'s day; outstanding at the end; what the bank should show', () => {
    const s = bankClearance('bank', transactions, bankLines, '2026-09-01', '2026-09-30');
    assert.deepEqual(s.rows.map(r => [r.id, r.amountCents, r.clearedOn]), [['deposit', 50_000, '2026-09-06'], ['cheque', -30_000, null], ['late-deposit', 20_000, '2026-10-02']]);
    assert.deepEqual([s.bookBalanceCents, s.outstandingInCents, s.outstandingOutCents, s.bankBalanceCents], [140_000, 20_000, 30_000, 150_000], 'the late deposit cleared after the end, the cheque not at all');
    assert.equal(bankClearance('bank', transactions, bankLines, '2026-10-01', '2026-10-31').outstandingInCents, 0);
  });

  test('on screen: the summary and each entry with its clearing day', () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts: [makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', category: 'Bank' })], transactions, bankLines } as never);
    markComponentCollectionsLoaded('accounts', 'transactions', 'bankLines');
    render(<BankClearanceReportView />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-30' } });
    assert.match(document.body.textContent || '', /The bank should show on .*\$1,500\.00/);
    assert.match(screen.getByRole('button', { name: /^cheque/ }).closest('tr')!.textContent || '', /\$300\.00Outstanding/);
  });
});
