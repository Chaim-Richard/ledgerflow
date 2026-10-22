/**
 * A new invoice or bill saved as a draft is saved (found 6 Oct while building K-04): a draft posts
 * nothing to the books, and the posting step used to return before sending the document itself,
 * so "Save Draft" on a new invoice or bill, or a draft invoice made from an estimate, was lost.
 * Now the document goes to the server with no entries; a draft that had entries still reverses them.
 * L94-STEP2: invoices and bills go to POST /api/v1/documents/:type/:id/post with the document only — the server
 * builds the entries (and a draft's reversal; l94-step2-document-post.test.ts), so no lines are sent at all.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { Workspace } from '../types';

type Sent = { url: string; workspaceId?: string; action?: string; data?: Record<string, unknown>; transactions?: unknown };

describe('Saving drafts', () => {
  const sent: Sent[] = [];
  const realFetch = globalThis.fetch;
  let LedgerPostService: typeof import('../services/LedgerPostService').LedgerPostService;

  before(async () => {
    globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
      sent.push({ url: String(url), ...JSON.parse(String(init?.body || '{}')) });
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    ({ LedgerPostService } = await import('../services/LedgerPostService'));
  });
  after(() => { globalThis.fetch = realFetch; });

  const context = (transactions = [] as ReturnType<typeof makeTransaction>[]) => ({
    lockDate: null,
    transactions,
    inventory: [],
    workspaces: [{ id: 'w1', uid: 'u1', name: 'W', currency: 'USD' } as Workspace],
    accounts: [
      makeChartAccount({ id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' }),
      makeChartAccount({ id: 'ap', name: 'Accounts Payable', type: 'liability', category: 'Payables' }),
      makeChartAccount({ id: 'cash', name: 'Checking', type: 'asset', category: 'Cash' }),
      makeChartAccount({ id: 'rev', name: 'Sales', type: 'income', category: 'Revenue' }),
      makeChartAccount({ id: 'exp', name: 'Supplies', type: 'expense' }),
    ],
  });

  test('a new draft invoice is sent to be saved, with no entries', async () => {
    sent.length = 0;
    const data = { number: 'INV-9', customerId: 'c1', date: '2026-10-01', amountCents: 5000, status: 'draft' as const };
    await LedgerPostService.postInvoiceLedger('inv9', data, 'w1', 'u1', { collection: 'invoices', docId: 'inv9', action: 'create', data }, context());
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, '/api/v1/documents/invoices/inv9/post');
    assert.equal(sent[0].transactions, undefined, 'no entries are sent');
    assert.deepEqual([sent[0].workspaceId, sent[0].action, sent[0].data?.status], ['w1', 'create', 'draft']);
  });

  test('a new draft bill is sent to be saved, with no entries', async () => {
    sent.length = 0;
    const data = { number: 'B-9', vendorId: 'v1', date: '2026-10-01', amountCents: 5000, status: 'draft' as const };
    await LedgerPostService.postBillLedger('bill9', data, 'w1', 'u1', { collection: 'bills', docId: 'bill9', action: 'create', data }, context());
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, '/api/v1/documents/bills/bill9/post');
    assert.equal(sent[0].transactions, undefined, 'no entries are sent');
  });

  test('turning an issued invoice back to a draft sends the document once; the server reverses its entry', async () => {
    sent.length = 0;
    const posted = makeTransaction({ id: 't1', metadata: { invoiceId: 'inv9' }, status: 'completed' });
    const data = { number: 'INV-9', customerId: 'c1', date: '2026-10-01', amountCents: 5000, status: 'draft' as const };
    await LedgerPostService.postInvoiceLedger('inv9', data, 'w1', 'u1', { collection: 'invoices', docId: 'inv9', action: 'update', data }, context([posted]));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, '/api/v1/documents/invoices/inv9/post');
    assert.equal(sent[0].transactions, undefined, 'the reversal is built on the server');
    assert.deepEqual([sent[0].action, sent[0].data?.status], ['update', 'draft']);
  });

  test('nothing is sent when there is nothing to save and nothing to reverse', async () => {
    sent.length = 0;
    await LedgerPostService.postInvoiceLedger('inv9', { number: 'INV-9', date: '2026-10-01', amountCents: 5000, status: 'draft' }, 'w1', 'u1', undefined, context());
    assert.equal(sent.length, 0);
  });
});
