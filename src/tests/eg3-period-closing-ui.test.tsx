/**
 * EG-3: the period-closing document on Month-End Close, read-only and printable: the current version's P&L,
 * the transfer to retained earnings (figures only), the balance-sheet totals and the snapshot it agrees with; a
 * superseded version stays listed and can be shown; nothing at all before a year was closed.
 * Figures: income 500,000, expenses 300,000 → net 200,000; RE 0 + 200,000 = 200,000; assets 1,200,000 = claims.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PeriodClosingPanel from '../components/ledger/PeriodClosingPanel';

const realFetch = globalThis.fetch;
const realPrint = window.print;
const answer = (body: unknown, status = 200) => {
  const asked: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    asked.push(String(input));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return asked;
};
const doc = (version: number, status: 'current' | 'superseded', expense: number) => ({
  id: `w1_2025-12-31_v${version}`, workspaceId: 'w1', yearStart: '2025-01-01', yearEnd: '2025-12-31', version, status,
  profitAndLoss: {
    income: { total: 500_000, accounts: [{ accountId: 's', code: '4000', name: 'Sales', cents: 500_000 }] },
    cogs: { total: 0, accounts: [] },
    expense: { total: expense, accounts: [{ accountId: 'r', code: '6000', name: 'Rent', cents: expense }] },
    grossProfit: 500_000, netIncome: 500_000 - expense,
  },
  retainedEarnings: { before: 0, transfer: 500_000 - expense, after: 500_000 - expense, entryPosted: false },
  balanceSheet: { totalAssets: 1_500_000 - expense, totalLiabilities: 0, totalEquity: 1_000_000, retainedEarnings: 500_000 - expense, totalClaims: 1_500_000 - expense, isBalanced: true },
  snapshot: { id: 'w1_2025-12-31', checksum: 'abcdef0123456789abcdef', entryCount: 3 },
  lockDate: '2025-12-31', closedByUid: 'u1', closedBy: 'owner@x.test', closedAt: '2026-01-05T10:00:00Z',
  links: { closeChecklist: { tab: 'month-end-close', month: '2025-12' }, closePackage: { tab: 'month-end-close', month: '2025-12', file: 'Close_Package_2025-12.xlsx' } },
  ...(status === 'superseded' ? { supersededAt: '2026-01-10T00:00:00Z', supersededBy: 'owner@x.test', supersededReason: 'Reopened 2025-12: missed rent' } : {}),
});

describe('Period-closing document', () => {
  afterEach(() => { cleanup(); globalThis.fetch = realFetch; window.print = realPrint; });

  test('the current version: P&L, the transfer as figures, the balance sheet, the snapshot; print and the checklist link', async () => {
    const asked = answer({ status: 'ok', closings: [doc(2, 'current', 350_000), doc(1, 'superseded', 300_000)] });
    let opened = '';
    let printed = 0;
    window.print = () => { printed++; };
    render(<PeriodClosingPanel workspaceId="w1" currency="USD" onOpenMonth={m => { opened = m; }} />);
    assert.ok(await screen.findByText(/version 2:/));
    assert.deepEqual(asked, ['/api/v1/transactions/period-closings?workspaceId=w1']);
    assert.match(screen.getByRole('row', { name: /Net profit/ }).textContent || '', /\$1,500\.00/);
    assert.match(screen.getByRole('row', { name: /Retained earnings at 2025-12-31/ }).textContent || '', /\$1,500\.00/);
    assert.ok(screen.getByText(/figures only, no entry posted/));
    assert.match(screen.getByRole('row', { name: /Total assets/ }).textContent || '', /\$11,500\.00/);
    assert.ok(screen.getByText(/The balance sheet balances\./));
    assert.ok(screen.getByText(/Agrees with balance snapshot w1_2025-12-31 \(3 entries, checksum abcdef0123456789…\)/));
    assert.equal(screen.queryAllByRole('textbox').length, 0, 'read-only');
    fireEvent.click(screen.getByRole('button', { name: /Print/ }));
    fireEvent.click(screen.getByRole('button', { name: /Open the close checklist and close package for 2025-12/ }));
    assert.deepEqual([printed, opened], [1, '2025-12']);
  });

  test('a superseded version stays listed and shows its own figures', async () => {
    answer({ status: 'ok', closings: [doc(2, 'current', 350_000), doc(1, 'superseded', 300_000)] });
    render(<PeriodClosingPanel workspaceId="w1" currency="USD" />);
    const select = await screen.findByRole('combobox', { name: /Document/ });
    fireEvent.change(select, { target: { value: 'w1_2025-12-31_v1' } });
    assert.ok(await screen.findByText(/Superseded on 2026-01-10 by owner@x\.test: Reopened 2025-12: missed rent\./));
    assert.match(screen.getByRole('row', { name: /Net profit/ }).textContent || '', /\$2,000\.00/);
  });

  test('no year closed yet: nothing shown; an error is said', async () => {
    answer({ status: 'ok', closings: [] });
    const { container } = render(<PeriodClosingPanel workspaceId="w1" />);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(container.textContent, '');
    cleanup();
    answer({ error: 'Forbidden' }, 403);
    render(<PeriodClosingPanel workspaceId="w1" />);
    assert.ok(await screen.findByText('Forbidden'));
  });
});
