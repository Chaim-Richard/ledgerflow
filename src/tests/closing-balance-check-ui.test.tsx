/**
 * The "Balances since the close" section (CA-06): "still as closed", or the accounts that moved with
 * the balance then and now; nothing at all for a month closed before snapshots were kept.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import ClosingBalanceCheck from '../components/ledger/ClosingBalanceCheck';

const realFetch = globalThis.fetch;
const answer = (body: unknown) => {
  const asked: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    asked.push(String(input));
    return new Response(JSON.stringify({ status: 'success', ...(body as object) }), { status: 200 });
  }) as typeof fetch;
  return asked;
};
const snapshot = { asOfDate: '2026-03-31', takenAt: '2026-04-02T09:00:00Z', entries: 2, accounts: 3 };

describe('Balances since the close', () => {
  afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

  test('unchanged: one line saying so', async () => {
    const asked = answer({ snapshot, entriesNow: 2, changes: [] });
    render(<ClosingBalanceCheck workspaceId="w1" month="2026-03" currency="USD" />);
    assert.ok(await screen.findByText(/Every balance on 2026-03-31 is still what it was when 2026-03 was closed on 2026-04-02 \(3 accounts, 2 entries\)/));
    assert.deepEqual(asked, ['/api/v1/workspaces/w1/periods/2026-03/balance-check']);
  });

  test('changed: the accounts that moved, then, now and the difference', async () => {
    answer({ snapshot, entriesNow: 3, changes: [{ accountId: 'rent', code: '6000', name: 'Rent', atCloseCents: 120000, nowCents: 150000, differenceCents: 30000 }] });
    render(<ClosingBalanceCheck workspaceId="w1" month="2026-03" currency="USD" />);
    assert.ok(await screen.findByText(/1 account has a different balance on 2026-03-31 than when 2026-03 was closed on 2026-04-02 \(2 entries then, 3 now\)/));
    const row = screen.getByRole('row', { name: /Rent/ });
    assert.match(row.textContent || '', /6000 · Rent\$1,200\.00\$1,500\.00\$300\.00/);
  });

  test('closed before snapshots were kept: nothing shown', async () => {
    const asked = answer({ snapshot: null, changes: [] });
    const { container } = render(<ClosingBalanceCheck workspaceId="w1" month="2026-01" />);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(asked.length, 1);
    assert.equal(container.textContent, '');
  });
});
