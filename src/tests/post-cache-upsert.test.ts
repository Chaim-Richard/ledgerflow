import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { postTxsServerApi } from '../services/ledgerPost/postingKit';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { Transaction } from '../types';

// BUG-05: a save sent twice (retry, replay) shows once in the local list.
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('posting the same entry twice leaves one copy in the store', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })) as typeof fetch;
  useLedgerStore.setState({ transactions: [{ id: 'old', date: '2026-01-01', lines: [] } as unknown as Transaction] });
  const entry = { id: 'e1', date: '2026-05-01', description: 'Sale', lines: [{ accountId: 'a', amountCents: 100 }, { accountId: 'b', amountCents: -100 }] };
  await postTxsServerApi([entry] as never, 'w1');
  await postTxsServerApi([entry] as never, 'w1');
  const ids = useLedgerStore.getState().transactions.map(t => t.id);
  assert.deepEqual(ids.filter(id => id === 'e1').length, 1);
  assert.ok(ids.includes('old'));
});
