/**
 * L94-SHADOW-MORE: the L-94 server shadow check (postingShadowCheck.ts) now also rebuilds credit notes and vendor
 * credits saved through /transactions/bulk, with the same builders the browser uses, and compares. (Payments are not
 * in it: nothing posts them through /transactions/bulk — POST /payments builds their entries on the server.)
 * For each, on the local test database (cents):
 *   credit note CN-1 200.00 for Acme      → Sales DR 20,000 / A/R CR 20,000
 *   vendor credit VC-1 80.00 from Globex  → A/P DR 8,000 / the rebate account CR 8,000
 * and three cases each:
 *   - the browser's own entry → the rebuild matches;
 *   - one line moved to another account of the same kind (still balanced) → the difference is named, line by line;
 *   - an edit (to 300.00, 120.00) after the first entry is in the books → the rebuild reverses the first
 *     entry and posts the new one, as the browser's builder did: e.g. the credit note's Sales lines are
 *     −20,000 (reversal) and +30,000.
 * And the lock: CN-9 first posted on 2026-09-10, the books locked through 2026-09-30, edited to 150.00 on 2026-10-21 →
 * the browser reverses the locked entry today (2026-10-21), not on 09-10; the rebuild uses the same lock and agrees.
 */
import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { postCreditNoteLedger, postVendorCreditLedger } from '../services/ledgerPost/creditPosting';
import type { EntityMutation, LedgerPostContext, PostableTransaction } from '../services/ledgerPost/postingCore';
import { postingFingerprint, shadowCheckDocumentPosting } from './helpers/postingShadowCheck';
import type { ChartAccount, Transaction, Workspace } from '../types';

// the browser and the server both reverse a locked entry on today's date (the workspace's time zone, UTC here)
const TODAY = new Date().toISOString().slice(0, 10);

const url = process.env.LF_TEST_DATABASE_URL;

describe('L-94 shadow check: credit notes and vendor credits', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_l94m_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-l94m';
  const a = (s: string) => `${ws}_${s}`;
  let db: import('../server/db/pgFirestore').Firestore;
  const accounts = [
    { id: a('ar'), name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
    { id: a('bank'), name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
    { id: a('petty'), name: 'Petty cash', type: 'asset', category: 'Cash', code: '1010' },
    { id: a('ap'), name: 'Accounts Payable', type: 'liability', category: 'Payables', code: '2000' },
    { id: a('sales'), name: 'Sales', type: 'income', code: '4000' },
    { id: a('other'), name: 'Other income', type: 'income', code: '4900' },
    { id: a('supplies'), name: 'Supplies', type: 'expense', code: '6000' },
    { id: a('misc'), name: 'Miscellaneous expense', type: 'expense', code: '6900' },
  ].map(x => ({ ...x, workspaceId: ws })) as unknown as ChartAccount[];
  const workspace = {
    id: ws, uid: OWNER, name: 'L-94 more', currency: 'USD', timezone: 'UTC',
    defaultAccountMappings: { ar: a('ar'), ap: a('ap'), revenue: a('sales'), expense: a('supplies'), cash: a('bank') },
  } as unknown as Workspace;

  type Kind = 'creditNotes' | 'vendorCredits';
  const KINDS: Array<{
    kind: Kind; key: string; post: (id: string, data: never, ws: string, uid: string, m: EntityMutation, c: LedgerPostContext) => Promise<unknown>;
    doc: (id: string, cents: number) => Record<string, unknown>; first: number; edited: number;
  }> = [
    {
      kind: 'creditNotes', key: 'creditNoteId', post: postCreditNoteLedger as never, first: 20_000, edited: 30_000,
      doc: (id, cents) => ({ id, workspaceId: ws, number: 'CN-1', customerId: 'c1', customerName: 'Acme', date: '2026-10-21', status: 'open', currency: 'USD', amountCents: cents }),
    },
    {
      kind: 'vendorCredits', key: 'vendorCreditId', post: postVendorCreditLedger as never, first: 8_000, edited: 12_000,
      doc: (id, cents) => ({ id, workspaceId: ws, number: 'VC-1', vendorId: 'v1', vendorName: 'Globex', date: '2026-10-21', status: 'open', currency: 'USD', amountCents: cents }),
    },
  ];
  /** the other account of the same kind a tampered line is moved to */
  const SWAP: Record<string, string> = { [a('sales')]: a('other'), [a('other')]: a('sales'), [a('supplies')]: a('misc'), [a('misc')]: a('supplies'), [a('bank')]: a('petty'), [a('petty')]: a('bank') };

  const entries = async (key: string, docId: string) => (await db.collection('transactions').where('workspaceId', '==', ws).where(`metadata.${key}`, '==', docId).get()).docs.map(d => ({ ...d.data(), id: d.id }) as Transaction);
  /** what the browser's builder would send for this save, given what is in the books now */
  const build = async (k: typeof KINDS[number], data: Record<string, unknown>, mutation: EntityMutation, lockDate: string | null = null): Promise<PostableTransaction[]> => {
    const context: LedgerPostContext = { accounts, workspaces: [workspace], transactions: await entries(k.key, String(data.id)), inventory: [], lockDate, uid: OWNER, today: TODAY, capture: [] };
    await k.post(String(data.id), data as never, ws, OWNER, mutation, context);
    return context.capture!.flatMap(c => c.txs).map(tx => ({ ...tx, id: tx.id || crypto.randomUUID() }));
  };
  /** the save as the bulk route commits it: the document, then the entries */
  const save = async (k: Kind, data: Record<string, unknown>, txs: PostableTransaction[]) => {
    await db.collection(k).doc(String(data.id)).set(data);
    for (const tx of txs) await db.collection('transactions').doc(tx.id!).set(tx as unknown as Record<string, unknown>);
  };
  const check = (mutation: EntityMutation, posted: PostableTransaction[]) => shadowCheckDocumentPosting(db as never, { workspaceId: ws, uid: OWNER, mutation, posted: posted as never });

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as unknown as typeof db;
    await db.collection('workspaces').doc(ws).set({ ...workspace, members: [OWNER], roles: { [OWNER]: 'owner' } } as unknown as Record<string, unknown>);
    for (const acc of accounts) await db.collection('chartAccounts').doc(acc.id).set(acc as unknown as Record<string, unknown>);
  });

  for (const k of KINDS) {
    test(`${k.kind}: the browser's own entry is rebuilt line for line`, async () => {
      const data = k.doc(a(`${k.kind}_1`), k.first);
      const mutation: EntityMutation = { collection: k.kind, docId: String(data.id), action: 'create', data };
      const posted = await build(k, data, mutation);
      assert.ok(posted.length > 0, 'the builder posts an entry');
      assert.equal(posted.flatMap(tx => tx.lines).filter(l => l.amountCents > 0).reduce((s, l) => s + l.amountCents, 0), k.first);
      await save(k.kind, data, posted);
      const result = await check(mutation, posted);
      assert.ok(result.checked, JSON.stringify(result));
      assert.equal(result.matched, true, JSON.stringify(result));
    });

    test(`${k.kind}: a line moved to another account (still balanced) is named`, async () => {
      const data = k.doc(a(`${k.kind}_2`), k.first);
      const mutation: EntityMutation = { collection: k.kind, docId: String(data.id), action: 'create', data };
      const honest = await build(k, data, mutation);
      const moved = honest.flatMap(tx => tx.lines).find(l => SWAP[l.accountId]);
      assert.ok(moved, 'one line can be moved to an account of the same kind');
      const posted = honest.map(tx => ({ ...tx, lines: tx.lines.map(l => (l === moved ? { ...l, accountId: SWAP[l.accountId] } : l)) }));
      assert.equal(posted.flatMap(tx => tx.lines).reduce((s, l) => s + l.amountCents, 0), 0, 'the tampered entry still balances');
      await save(k.kind, data, posted);
      const result = await check(mutation, posted);
      assert.ok(result.checked && !result.matched);
      assert.deepEqual(result.expected.filter(r => !result.sent.includes(r)), [`2026-10-21|${moved!.accountId}|${moved!.amountCents}|[]`]);
      assert.deepEqual(result.sent.filter(r => !result.expected.includes(r)), [`2026-10-21|${SWAP[moved!.accountId]}|${moved!.amountCents}|[]`]);
    });

    test(`${k.kind}: an edit from ${k.first} to ${k.edited} reverses the first entry and posts the new one, as the browser did`, async () => {
      const first = k.doc(a(`${k.kind}_3`), k.first);
      await save(k.kind, first, await build(k, first, { collection: k.kind, docId: String(first.id), action: 'create', data: first }));
      const edited = k.doc(String(first.id), k.edited);
      const update: EntityMutation = { collection: k.kind, docId: String(edited.id), action: 'update', data: edited };
      const posted = await build(k, edited, update);
      assert.ok(posted.length >= 2, 'a reversal and the new entry');
      await save(k.kind, edited, posted);
      const result = await check(update, posted);
      assert.ok(result.checked);
      assert.equal(result.matched, true, JSON.stringify(result));
      // the debit side: the first amount turned round, and the new amount
      const debitAccount = posted.at(-1)!.lines.find(l => l.amountCents > 0)!.accountId;
      assert.deepEqual(postingFingerprint(posted).filter(r => r.includes(`|${debitAccount}|`)), [`2026-10-21|${debitAccount}|${-k.first}|[]`, `2026-10-21|${debitAccount}|${k.edited}|[]`].sort());
    });
  }

  test('the credit note\'s own figures: Sales DR 20,000 / A/R CR 20,000', async () => {
    const rows = postingFingerprint(await entries('creditNoteId', a('creditNotes_1')));
    assert.deepEqual(rows, [`2026-10-21|${a('ar')}|-20000|[]`, `2026-10-21|${a('sales')}|20000|[]`].sort());
  });


  test('an edit of a credit note whose first entry is in a locked period: reversed today, as the browser does', async () => {
    const k = KINDS[0];
    const first: Record<string, unknown> = { ...k.doc(a('cn_locked'), 20_000), number: 'CN-9', date: '2026-09-10' };
    await save(k.kind, first, await build(k, first, { collection: k.kind, docId: String(first.id), action: 'create', data: first }));
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-09-30' });
    try {
      const edited: Record<string, unknown> = { ...first, amountCents: 15_000, date: '2026-10-21' };
      const update: EntityMutation = { collection: k.kind, docId: String(edited.id), action: 'update', data: edited };
      const posted = await build(k, edited, update, '2026-09-30');
      assert.deepEqual(postingFingerprint(posted).filter(r => r.includes(`|${a('sales')}|`)), [`${TODAY}|${a('sales')}|-20000|[]`, `2026-10-21|${a('sales')}|15000|[]`].sort(), 'the locked 09-10 entry is reversed today, not on 09-10');
      await save(k.kind, edited, posted);
      const result = await check(update, posted);
      assert.ok(result.checked);
      assert.equal(result.matched, true, JSON.stringify(result));
    } finally {
      await db.collection('workspaces').doc(ws).update({ lockDate: null });
    }
  });
});
