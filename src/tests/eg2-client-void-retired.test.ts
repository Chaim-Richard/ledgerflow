/**
 * EG-2: the client no longer voids payments. postPaymentLedger refuses status 'void' and points at
 * POST /api/v1/payments/:paymentId/void, and nothing is sent to the GL (fetch is stubbed).
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { Workspace } from '../types';

describe('EG-2: client payment void is retired', () => {
  const calls: unknown[] = [];
  const realFetch = globalThis.fetch;
  let LedgerPostService: typeof import('../services/LedgerPostService').LedgerPostService;

  before(async () => {
    globalThis.fetch = (async (url: unknown, init?: unknown) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    ({ LedgerPostService } = await import('../services/LedgerPostService'));
  });
  after(() => { globalThis.fetch = realFetch; });

  test('status void throws with the server route and posts nothing', async () => {
    const ctx = {
      lockDate: null,
      inventory: [],
      workspaces: [{ id: 'w1', uid: 'u1', name: 'W', currency: 'USD' } as Workspace],
      accounts: [
        makeChartAccount({ id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' }),
        makeChartAccount({ id: 'ap', name: 'Accounts Payable', type: 'liability', category: 'Payables' }),
        makeChartAccount({ id: 'cash', name: 'Checking', type: 'asset', category: 'Cash' }),
      ],
      // a prior posting the old branch would have reversed from the client
      transactions: [makeTransaction({ id: 't1', date: '2026-03-12', totalAmountCents: 3000, metadata: { paymentId: 'p1', type: 'standalone-payment' } })],
    };
    await assert.rejects(
      LedgerPostService.postPaymentLedger('p1', { status: 'void', direction: 'received', amountCents: 3000, date: '2026-03-12' }, 'w1', 'u1', undefined, ctx as never),
      (e: Error) => /POST \/api\/v1\/payments\/p1\/void/.test(e.message),
    );
    assert.equal(calls.length, 0, 'no client GL write');
  });
});
