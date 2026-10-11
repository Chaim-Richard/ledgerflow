/**
 * Petty cash (A-3, K-31, AI #3): the cash box maths and the three balanced entries it posts.
 *
 * Every number below is worked out by hand. The box is topped up with $200.00 (20,000¢); $35.47
 * (3,547¢) of stamps is spent from it, leaving $164.53 (16,453¢) by the books. A count that finds
 * $163.50 (16,350¢) is $1.03 (103¢) short — the difference goes to the over/short expense; a count
 * that finds $165.00 (16,500¢) is 47¢ over; a count that finds exactly 16,453¢ posts nothing.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  PETTY_CASH_KEY,
  boxSentence,
  countProblem,
  createPettyCashCountEntry,
  createPettyCashSpendEntry,
  createPettyCashTopUpEntry,
  overShortChoices,
  pettyCashBalanceCents,
  pettyCashBoxChoices,
  pettyCashCategoryChoices,
  pettyCashMovements,
  spendProblem,
  topUpProblem,
} from '../lib/pettyCash';
import { makeChartAccount, makeTransaction } from './fixtures';
import { lineAmount } from '../lib/txFilters';
import type { Firestore } from '../server/db/pgFirestore';
import type { ChartAccount, Transaction } from '../types';

const money = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(2)}`;

const box: ChartAccount = makeChartAccount({ id: 'box', code: '1015', name: 'Petty cash box', type: 'asset', category: 'Cash' });
const bank: ChartAccount = makeChartAccount({ id: 'bank', code: '1010', name: 'Business Checking', type: 'asset', category: 'Cash' });
const supplies: ChartAccount = makeChartAccount({ id: 'supplies', code: '6200', name: 'Office supplies', type: 'expense', category: 'Operating Expenses' });
const overShort: ChartAccount = makeChartAccount({ id: 'overshort', code: '6900', name: 'Cash over and short', type: 'expense', category: 'Operating Expenses' });
const sales: ChartAccount = makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'revenue', category: 'Revenue' });

const accounts = [box, bank, supplies, overShort, sales];
const context = { workspaceId: 'ws-1', uid: 'test-user', currency: 'USD' };

const topUpEntry = () => createPettyCashTopUpEntry({
  ...context, box, bank,
  draft: { boxAccountId: 'box', bankAccountId: 'bank', amountCents: 20_000, date: '2026-03-02' },
});
const spendEntry = () => createPettyCashSpendEntry({
  ...context, box, category: supplies,
  draft: { boxAccountId: 'box', categoryAccountId: 'supplies', amountCents: 3_547, date: '2026-03-05', note: 'stamps', receipt: 'PC-0042' },
});

const asTransaction = (id: string, entry: Partial<Transaction>, status: Transaction['status'] = 'completed'): Transaction =>
  makeTransaction({ ...entry, id, workspaceId: 'ws-1', status } as Partial<Transaction>);

describe('petty cash choices and refusals', () => {
  test('the pickers offer the workspace’s own accounts, never a new one', () => {
    assert.deepEqual(pettyCashBoxChoices(accounts).map(a => a.id), ['bank', 'box'], 'cash-type accounts, sorted by name');
    assert.deepEqual(pettyCashCategoryChoices(accounts).map(a => a.id), ['overshort', 'supplies']);
    assert.deepEqual(overShortChoices(accounts).map(a => a.id), ['overshort', 'supplies']);
    assert.equal(pettyCashBoxChoices([supplies, sales]).length, 0, 'a workspace with no cash account offers no box');
  });

  test('spending is refused in plain words when something is missing or wrong', () => {
    const draft = { boxAccountId: 'box', categoryAccountId: 'supplies', amountCents: 3_547, date: '2026-03-05' };
    assert.equal(spendProblem(draft, accounts), null);
    assert.match(spendProblem({ ...draft, boxAccountId: '' }, accounts) || '', /Choose the petty cash account/);
    assert.match(spendProblem({ ...draft, boxAccountId: 'supplies' }, accounts) || '', /is not a bank or cash account/);
    assert.match(spendProblem({ ...draft, amountCents: 0 }, accounts) || '', /positive amount/);
    assert.match(spendProblem({ ...draft, amountCents: 35.47 }, accounts) || '', /positive amount/, 'cents are whole numbers');
    assert.match(spendProblem({ ...draft, categoryAccountId: '' }, accounts) || '', /Choose the expense account/);
    assert.match(spendProblem({ ...draft, categoryAccountId: 'sales' }, accounts) || '', /is not an expense account/);
    assert.match(spendProblem({ ...draft, date: 'yesterday' }, accounts) || '', /date of the spending/);
  });

  test('a top-up is refused when the bank is missing, not cash, or the box itself', () => {
    const draft = { boxAccountId: 'box', bankAccountId: 'bank', amountCents: 20_000, date: '2026-03-02' };
    assert.equal(topUpProblem(draft, accounts), null);
    assert.match(topUpProblem({ ...draft, bankAccountId: '' }, accounts) || '', /Choose the bank account/);
    assert.match(topUpProblem({ ...draft, bankAccountId: 'sales' }, accounts) || '', /is not a bank or cash account/);
    assert.match(topUpProblem({ ...draft, bankAccountId: 'box' }, accounts) || '', /different account than the box itself/);
    assert.match(topUpProblem({ ...draft, amountCents: -5 }, accounts) || '', /positive amount/);
    assert.match(topUpProblem({ ...draft, date: '' }, accounts) || '', /date of the top-up/);
  });

  test('a count is refused when the counted cash or the over/short account is wrong', () => {
    const draft = { boxAccountId: 'box', overShortAccountId: 'overshort', countedCents: 16_350, date: '2026-03-31' };
    assert.equal(countProblem(draft, accounts), null);
    assert.equal(countProblem({ ...draft, countedCents: 0 }, accounts), null, 'an empty box can be counted');
    assert.match(countProblem({ ...draft, countedCents: -1 }, accounts) || '', /cannot be negative/);
    assert.match(countProblem({ ...draft, countedCents: 163.5 }, accounts) || '', /cannot be negative|date/, 'cents are whole numbers');
    assert.match(countProblem({ ...draft, overShortAccountId: '' }, accounts) || '', /Choose the over\/short account/);
    assert.match(countProblem({ ...draft, overShortAccountId: 'sales' }, accounts) || '', /is not an expense account/);
    assert.match(countProblem({ ...draft, date: 'today' }, accounts) || '', /date of the count/);
  });
});

describe('petty cash entries', () => {
  test('topping up is a transfer: the box debited, the bank credited, one balanced entry', () => {
    const entry = topUpEntry();
    assert.equal(entry.totalAmountCents, 20_000);
    assert.equal(entry.date, '2026-03-02');
    assert.equal(entry.description, 'Petty cash top-up from Business Checking');
    assert.deepEqual(entry.lines?.map(l => [l.accountId, l.amountCents]), [['box', 20_000], ['bank', -20_000]]);
    assert.equal(entry.lines?.reduce((sum, l) => sum + l.amountCents, 0), 0, 'balanced');
    assert.equal(entry.isTransfer, true, 'money between two of the workspace’s own cash accounts is a transfer');
    assert.deepEqual(entry.transferDetails, { fromAccountId: 'bank', toAccountId: 'box' });
    assert.ok(entry.lines?.every(l => l.isTransfer), 'both lines carry the transfer flag');
    assert.equal(entry.metadata?.[PETTY_CASH_KEY], 'top-up');
  });

  test('spending debits the category and credits the box; the note teaches the category, not the box', () => {
    const entry = spendEntry();
    assert.equal(entry.totalAmountCents, 3_547);
    assert.equal(entry.description, 'Petty cash: stamps');
    assert.equal(entry.reference, 'PC-0042', 'the receipt number rides on the reference');
    assert.deepEqual(entry.lines?.map(l => [l.accountId, l.amountCents]), [['supplies', 3_547], ['box', -3_547]]);
    assert.equal(entry.lines?.reduce((sum, l) => sum + l.amountCents, 0), 0, 'balanced');
    assert.equal(entry.lines?.find(l => l.accountId === 'supplies')?.description, 'Petty cash: stamps');
    assert.equal(entry.lines?.find(l => l.accountId === 'box')?.description, undefined, 'the box line stays plain');
    assert.equal(entry.metadata?.[PETTY_CASH_KEY], 'spend');
    const noNote = createPettyCashSpendEntry({
      ...context, box, category: supplies,
      draft: { boxAccountId: 'box', categoryAccountId: 'supplies', amountCents: 1_200, date: '2026-03-06' },
    });
    assert.equal(noNote.description, 'Petty cash — Office supplies');
    assert.equal(noNote.reference, undefined, 'no receipt, no reference');
  });

  test('a count that comes up short debits the over/short expense and credits the box', () => {
    const entry = createPettyCashCountEntry({
      ...context, box, overShort, bookCents: 16_453, money,
      draft: { boxAccountId: 'box', overShortAccountId: 'overshort', countedCents: 16_350, date: '2026-03-31' },
    });
    assert.ok(entry, 'a difference posts');
    assert.equal(entry!.totalAmountCents, 103);
    assert.equal(entry!.description, 'Petty cash count: $163.50 counted, $164.53 in the books — $1.03 short');
    assert.deepEqual(entry!.lines?.map(l => [l.accountId, l.amountCents]), [['overshort', 103], ['box', -103]]);
    assert.equal(entry!.lines?.reduce((sum, l) => sum + l.amountCents, 0), 0, 'balanced');
    assert.deepEqual(entry!.metadata, { [PETTY_CASH_KEY]: 'count', countedCents: 16_350, bookCents: 16_453 });
  });

  test('a count that finds extra cash credits the over/short account instead', () => {
    const entry = createPettyCashCountEntry({
      ...context, box, overShort, bookCents: 16_453, money,
      draft: { boxAccountId: 'box', overShortAccountId: 'overshort', countedCents: 16_500, date: '2026-03-31' },
    });
    assert.equal(entry!.totalAmountCents, 47);
    assert.match(entry!.description || '', /\$0\.47 over$/);
    assert.deepEqual(entry!.lines?.map(l => [l.accountId, l.amountCents]), [['overshort', -47], ['box', 47]]);
  });

  test('counting exactly the book balance posts nothing', () => {
    const entry = createPettyCashCountEntry({
      ...context, box, overShort, bookCents: 16_453, money,
      draft: { boxAccountId: 'box', overShortAccountId: 'overshort', countedCents: 16_453, date: '2026-03-31' },
    });
    assert.equal(entry, null);
  });
});

describe('what the ledger says is in the box', () => {
  test('the balance is the posted lines on the box account; drafts and voids move nothing', () => {
    const posted = [asTransaction('t-up', topUpEntry()), asTransaction('t-spend', spendEntry())];
    assert.equal(pettyCashBalanceCents('box', []), 0);
    assert.equal(pettyCashBalanceCents('box', [posted[0]]), 20_000);
    assert.equal(pettyCashBalanceCents('box', posted), 16_453, '20,000 in, 3,547 out');
    assert.equal(pettyCashBalanceCents('box', [...posted, asTransaction('t-draft', spendEntry(), 'draft')]), 16_453, 'a draft moves nothing');
    assert.equal(pettyCashBalanceCents('box', [...posted, asTransaction('t-void', spendEntry(), 'void')]), 16_453, 'a void moves nothing');
    assert.equal(pettyCashBalanceCents('bank', posted), -20_000, 'the bank side of the top-up');
    assert.equal(boxSentence(box, 16_453, money), '$164.53 in Petty cash box, by the books.');
  });

  test('the count settles the box to what was actually counted', () => {
    const counted = createPettyCashCountEntry({
      ...context, box, overShort, bookCents: 16_453, money,
      draft: { boxAccountId: 'box', overShortAccountId: 'overshort', countedCents: 16_350, date: '2026-03-31' },
    });
    const posted = [asTransaction('t-up', topUpEntry()), asTransaction('t-spend', spendEntry()), asTransaction('t-count', counted!)];
    assert.equal(pettyCashBalanceCents('box', posted), 16_350, 'after the count the books match the drawer');
  });

  test('movements list the box’s own entries newest first with what each moved', () => {
    const counted = createPettyCashCountEntry({
      ...context, box, overShort, bookCents: 16_453, money,
      draft: { boxAccountId: 'box', overShortAccountId: 'overshort', countedCents: 16_350, date: '2026-03-31' },
    });
    const other = asTransaction('t-other', {
      date: '2026-03-10', description: 'Sales banked', totalAmountCents: 5_000,
      lines: [
        { id: 'l1', accountId: 'bank', amountCents: 5_000, exchangeRate: 1 },
        { id: 'l2', accountId: 'sales', amountCents: -5_000, exchangeRate: 1 },
      ],
    });
    const movements = pettyCashMovements('box', [asTransaction('t-up', topUpEntry()), other, asTransaction('t-spend', spendEntry()), asTransaction('t-count', counted!)]);
    assert.deepEqual(movements.map(m => [m.transaction.id, m.amountCents, m.kind]), [
      ['t-count', -103, 'count'],
      ['t-spend', -3_547, 'spend'],
      ['t-up', 20_000, 'top-up'],
    ], 'the entry that never touched the box is not a movement of the box');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

/**
 * The posting half of A-3 against a real database: the three entries go through the ordinary
 * route (so role and period-lock checks apply) and the box balance can be read straight back.
 * Runs when LF_TEST_DATABASE_URL is set.
 */
describe('Petty cash against a real database', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const wsId = `ws_petty_${crypto.randomBytes(4).toString('hex')}`;
  // the accounts as this workspace holds them (the entries must name its own accounts)
  const dbBox = { ...box, id: `${wsId}_box` };
  const dbBank = { ...bank, id: `${wsId}_bank` };
  const dbSupplies = { ...supplies, id: `${wsId}_supplies` };
  const dbOverShort = { ...overShort, id: `${wsId}_overshort` };
  let server: Server;
  let base = '';
  let db: Firestore;

  const post = async (uid: string, transaction: Partial<Transaction>) => {
    const res = await fetch(`${base}/api/v1/transactions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-uid': uid, 'x-operation-id': String(transaction.id || '') },
      body: JSON.stringify({ transaction: { ...transaction, workspaceId: wsId, id: transaction.id || `tx_${crypto.randomBytes(4).toString('hex')}` } }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> };
  };
  const ledger = async (): Promise<Transaction[]> => (await db.collection('transactions').where('workspaceId', '==', wsId).get()).docs.map(d => d.data() as unknown as Transaction);

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(wsId).set({
      uid: 'owner-1', name: 'Petty cash', currency: 'USD', members: ['owner-1', 'book-1', 'view-1'],
      roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' },
    });
    await db.collection('chartAccounts').doc(dbBox.id).set({ workspaceId: wsId, code: '1015', name: 'Petty cash box', type: 'asset', category: 'Cash' });
    await db.collection('chartAccounts').doc(dbBank.id).set({ workspaceId: wsId, code: '1010', name: 'Business Checking', type: 'asset', category: 'Cash' });
    await db.collection('chartAccounts').doc(dbSupplies.id).set({ workspaceId: wsId, code: '6200', name: 'Office supplies', type: 'expense', category: 'Operating Expenses' });
    await db.collection('chartAccounts').doc(dbOverShort.id).set({ workspaceId: wsId, code: '6900', name: 'Cash over and short', type: 'expense', category: 'Operating Expenses' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: `${req.header('x-test-uid')}@test.local` }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'chartAccounts', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [wsId]);
    }
    await db.terminate();
  });

  test('a top-up is one balanced entry a viewer cannot post, and the box reads it back', async () => {
    const entry = () => createPettyCashTopUpEntry({
      workspaceId: wsId, uid: 'owner-1', currency: 'USD', box: dbBox, bank: dbBank,
      draft: { boxAccountId: dbBox.id, bankAccountId: dbBank.id, amountCents: 20_000, date: '2026-03-02' },
    });
    assert.equal((await post('view-1', entry())).status, 403, 'a viewer cannot post');
    const res = await post('book-1', entry());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const posted = await ledger();
    assert.equal(posted.length, 1);
    assert.equal(pettyCashBalanceCents(dbBox.id, posted), 20_000);
    assert.equal(pettyCashBalanceCents(dbBank.id, posted), -20_000, 'the bank paid for it');
  });

  test('spending from the box is split against the category and the balance follows', async () => {
    const res = await post('owner-1', createPettyCashSpendEntry({
      workspaceId: wsId, uid: 'owner-1', currency: 'USD', box: dbBox, category: dbSupplies,
      draft: { boxAccountId: dbBox.id, categoryAccountId: dbSupplies.id, amountCents: 3_547, date: '2026-03-05', note: 'stamps', receipt: 'PC-0042' },
    }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const posted = await ledger();
    const spendTx = posted.find(t => t.description === 'Petty cash: stamps');
    assert.ok(spendTx, 'the spend entry is in the ledger');
    const byAccount = (id: string) => (spendTx!.lines || []).filter(l => l.accountId === id).reduce((sum, l) => sum + lineAmount(l, spendTx!), 0);
    assert.equal(byAccount(dbSupplies.id), 3_547, 'the spending goes to the category');
    assert.equal(byAccount(dbBox.id), -3_547, 'the box pays for it');
    assert.equal(spendTx!.lines.reduce((sum, l) => sum + lineAmount(l, spendTx!), 0), 0, 'balanced');
    assert.equal(spendTx!.reference, 'PC-0042', 'the receipt number is kept');
    assert.equal(pettyCashBalanceCents(dbBox.id, posted), 16_453);
  });

  test('a count cannot be back-dated into a closed month; open again, it settles the box', async () => {
    const countEntry = () => createPettyCashCountEntry({
      workspaceId: wsId, uid: 'owner-1', currency: 'USD', box: dbBox, overShort: dbOverShort, bookCents: 16_453, money,
      draft: { boxAccountId: dbBox.id, overShortAccountId: dbOverShort.id, countedCents: 16_350, date: '2026-03-31' },
    })!;
    await db.collection('workspaces').doc(wsId).update({ lockDate: '2026-03-31' });
    const refused = await post('book-1', countEntry());
    assert.equal(refused.status, 400, JSON.stringify(refused.body));
    assert.equal(refused.body.code, 'PERIOD_LOCKED', 'the period lock is what refused it');
    await db.collection('workspaces').doc(wsId).update({ lockDate: null });
    const allowed = await post('book-1', countEntry());
    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
    const posted = await ledger();
    assert.equal(pettyCashBalanceCents(dbBox.id, posted), 16_350, 'after the count the books match the drawer');
    const countTx = posted.find(t => t.metadata?.[PETTY_CASH_KEY] === 'count');
    assert.ok(countTx, 'the count entry is in the ledger');
    const onOverShort = (countTx!.lines || []).filter(l => l.accountId === dbOverShort.id).reduce((sum, l) => sum + lineAmount(l, countTx!), 0);
    assert.equal(onOverShort, 103, 'the missing $1.03 is an expense, not vanished money');
  });
});
