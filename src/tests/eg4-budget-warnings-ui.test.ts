/**
 * EG-4 review (4366282437): the browser shows each budget warning's words when a posting is saved over a budget,
 * on both posting paths (POST /transactions/bulk and /documents/:type/:id/post, postingKit.ts); a single entry
 * (entryActions.ts) uses the same showBudgetWarnings.
 */
import './helpers/dom';
import test, { afterEach, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { toast } from 'sonner';
import { budgetWarningMessages, showBudgetWarnings } from '../lib/budgetWarnings';
import { postTxsServerApi } from '../services/ledgerPost/postingKit';

const MESSAGE = 'Over the budget for Rent (2026-10-01 to 2026-10-31): budget $1,000.00, spent $900.00, this $200.00 → $1,100.00, $100.00 over';
const answer = { status: 'ok', count: 1, transactions: [], budgetWarnings: [{ message: MESSAGE, overCents: 10_000 }] };

describe('EG-4: budget warnings shown in the browser', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; mock.restoreAll(); });
  const answering = (body: unknown) => {
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => { urls.push(String(input)); return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
    return urls;
  };

  test('the messages, and nothing for an answer without them', () => {
    assert.deepEqual(budgetWarningMessages(answer), [MESSAGE]);
    assert.deepEqual(budgetWarningMessages({ status: 'ok' }), []);
    assert.deepEqual(budgetWarningMessages({ budgetWarnings: [{}, null, { message: '' }] }), []);
    const warned = mock.method(toast, 'warning', () => 'id');
    showBudgetWarnings({ status: 'ok' });
    assert.equal(warned.mock.callCount(), 0);
  });

  test('a journal posted through /transactions/bulk: one warning toast with the words', async () => {
    const warned = mock.method(toast, 'warning', () => 'id');
    const urls = answering(answer);
    await postTxsServerApi([{ id: 'j1', workspaceId: 'w1', date: '2026-10-20', description: 'Rent', lines: [] } as never], 'w1');
    assert.match(urls[0], /\/transactions\/bulk$/);
    assert.deepEqual(warned.mock.calls.map(c => c.arguments[0]), [MESSAGE]);
  });

  test('a bill posted through /documents/bills/:id/post: one warning toast with the words', async () => {
    const warned = mock.method(toast, 'warning', () => 'id');
    const urls = answering(answer);
    await postTxsServerApi([], 'w1', { collection: 'bills', docId: 'b1', action: 'create', data: { id: 'b1' } });
    assert.match(urls[0], /\/documents\/bills\/b1\/post$/);
    assert.deepEqual(warned.mock.calls.map(c => c.arguments[0]), [MESSAGE]);
  });
});
