/**
 * A backup can really be restored (L-07): export a workspace, change its books, restore the backup,
 * and the trial balance and the documents are exactly what they were. Old backups (fewer keys)
 * still restore; closed books are never rewritten. Runs when LF_TEST_DATABASE_URL is set.
 */
import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';
import { exportWorkspaceBackup, restoreWorkspaceBackup, RestoreError } from '../server/services/workspaceRestoreService';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Backup and restore (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const s = crypto.randomBytes(4).toString('hex');
  const ws = `ws_backup_${s}`;
  const id = (n: string) => `${ws}_${n}`;
  let db: Firestore;

  const trialBalance = async () => {
    const snap = await db.collection('transactions').where('workspaceId', '==', ws).get();
    const tb: Record<string, number> = {};
    for (const d of snap.docs) {
      const tx = d.data();
      if (tx.status === 'draft' || tx.status === 'void') continue;
      for (const l of tx.lines as { accountId: string; amountCents: number }[]) tb[l.accountId] = (tb[l.accountId] || 0) + l.amountCents;
    }
    return tb;
  };
  const ids = async (coll: string) => (await db.collection(coll).where('workspaceId', '==', ws).get()).docs.map(d => d.id).sort();

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Books', currency: 'USD', members: [] });
    for (const [n, type] of [['bank', 'asset'], ['ar', 'asset'], ['rev', 'income']] as const) {
      await db.collection('chartAccounts').doc(id(n)).set({ workspaceId: ws, name: n, type });
    }
    const entry = (n: string, debit: string, credit: string, cents: number, date: string) => db.collection('transactions').doc(id(n)).set({
      workspaceId: ws, date, description: n, status: 'completed', type: 'actual', lines: [{ accountId: id(debit), amountCents: cents }, { accountId: id(credit), amountCents: -cents }],
    });
    await entry('sale1', 'ar', 'rev', 12000, '2026-08-01');
    await entry('paid1', 'bank', 'ar', 12000, '2026-08-15');
    await entry('sale2', 'ar', 'rev', 5000, '2026-09-01');
    await db.collection('invoices').doc(id('inv1')).set({ workspaceId: ws, number: 'INV-1', amountCents: 12000, status: 'paid', date: '2026-08-01' });
    await db.collection('creditNotes').doc(id('cn1')).set({ workspaceId: ws, number: 'CN-1', amountCents: 1000, date: '2026-09-02' });
    await db.collection('bankLines').doc(id('line1')).set({ workspaceId: ws, date: '2026-08-15', amountCents: 12000, status: 'matched' });
  });

  test('export, change the books, restore: everything is as it was', async () => {
    const before = { tb: await trialBalance(), invoices: await ids('invoices'), creditNotes: await ids('creditNotes'), bankLines: await ids('bankLines') };
    const backup = await exportWorkspaceBackup(db, ws, 'owner-1');
    assert.equal(backup.metadata.transactionCount, 3);
    assert.equal((backup.creditNotes as unknown[]).length, 1, 'credit notes are in the backup');
    assert.match(String(backup.metadata.checksum), /^[0-9a-f]{64}$/);

    // later changes: an entry deleted, a wrong one added, a credit note removed
    await db.collection('transactions').doc(id('sale2')).delete();
    await db.collection('transactions').doc(id('oops')).set({ workspaceId: ws, date: '2026-09-10', status: 'completed', lines: [{ accountId: id('bank'), amountCents: 999 }, { accountId: id('rev'), amountCents: -999 }] });
    await db.collection('creditNotes').doc(id('cn1')).delete();
    assert.notDeepEqual(await trialBalance(), before.tb);

    const { checksum: _checksum, ...metadata } = backup.metadata;
    const result = await restoreWorkspaceBackup(db, ws, JSON.parse(JSON.stringify({ ...backup, metadata })));
    assert.equal(result.counts.transactions, 3);
    assert.deepEqual(await trialBalance(), before.tb);
    assert.deepEqual(await ids('invoices'), before.invoices);
    assert.deepEqual(await ids('creditNotes'), before.creditNotes);
    assert.deepEqual(await ids('bankLines'), before.bankLines);
    assert.deepEqual(await ids('transactions'), [id('paid1'), id('sale1'), id('sale2')].sort());
  });

  test('a backup can\'t rewrite closed books', async () => {
    const backup = await exportWorkspaceBackup(db, ws, 'owner-1');
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-08-31' });
    await assert.rejects(restoreWorkspaceBackup(db, ws, backup), (e: unknown) => e instanceof RestoreError && e.status === 409 && /closed through 2026-08-31/.test(e.message));
    await db.collection('workspaces').doc(ws).update({ lockDate: null });
  });
});
