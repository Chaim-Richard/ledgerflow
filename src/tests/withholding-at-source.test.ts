/**
 * Tax withheld at source on a vendor payment (PLAN IL-5). A bill of 11,800 (10,000 + 18% VAT) paid
 * in full with 5% withheld on the 10,000 before VAT: the bill is settled (11,800), the bank pays
 * 11,300 and 500 is owed to the tax authority.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { isWithholdingAccount, withheldCents, withholdingOn } from '../lib/tax/withholding';

test('the certificate, its expiry, and the amount withheld (before VAT, whole cents)', () => {
  const vendor = { metadata: { withholding: { ratePercent: 5, number: 'W-77', expires: '2026-12-31' } } };
  assert.equal(withholdingOn(vendor, '2026-12-31')?.state, 'good');
  assert.equal(withholdingOn(vendor, '2027-01-01')?.state, 'expired');
  assert.equal(withholdingOn({ metadata: { withholding: { ratePercent: 120 } } }, '2026-10-11'), null);
  assert.equal(withheldCents(1180000, 180000, 5), 50000);
  assert.equal(withheldCents(333, 0, 7.5), 25);
  assert.equal(isWithholdingAccount({ type: 'liability', name: 'Tax withheld at source' }), true);
  assert.equal(isWithholdingAccount({ type: 'liability', name: 'Accounts Payable' }), false);
  assert.equal(isWithholdingAccount({ type: 'liability', subtype: 'withholding', name: 'X', isArchived: true }), false);
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_wht_${crypto.randomBytes(4).toString('hex')}`;
  let db: import('../server/db/pgFirestore').Firestore;
  let createPaymentAtomic: typeof import('../server/services/paymentService').createPaymentAtomic;
  const id = (s: string) => `${ws}_${s}`;
  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    ({ createPaymentAtomic } = await import('../server/services/paymentService'));
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'WHT', currency: 'ILS', members: ['owner-1'] });
    const account = (key: string, name: string, type: string, category = '') => db.collection('chartAccounts').doc(id(key)).set({ workspaceId: ws, uid: 'owner-1', name, type, category });
    await account('bank', 'Bank Leumi', 'asset', 'Cash');
    await account('ap', 'Accounts Payable', 'liability', 'Payables');
    await account('wht', 'Tax withheld at source', 'liability', 'Taxes');
    const bill = (key: string) => db.collection('bills').doc(id(key)).set({ workspaceId: ws, uid: 'owner-1', vendorId: 'v1', vendorName: 'Supplier', number: key, date: '2026-10-01', status: 'unpaid', taxVersion: 2, amountCents: 1180000, taxAmountCents: 180000, amountPaidCents: 0 });
    await bill('b1');
    await bill('b2');
  });
  after(async () => {
    for (const table of ['transactions', 'payments', 'bills', 'chartAccounts', 'auditLogs', 'numberingSeries', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => undefined);
    }
    await db.terminate();
  });

  const pay = (bill: string, withheld: number) => createPaymentAtomic(db, {
    workspaceId: ws, uid: 'owner-1', paymentDate: '2026-10-11', amountCents: 1180000, cashAccountId: id('bank'), vendorId: 'v1', entityName: 'Supplier',
    allocations: [{ documentId: id(bill), documentType: 'bill', amountCents: 1180000 }],
    withheldCents: withheld, withholdingRatePercent: 5, withholdingCertificate: 'W-77',
  });

  test('the bill is settled in full, the bank pays the rest, the withheld tax is owed', async () => {
    const result = await pay('b1', 50000);
    const lines = Object.fromEntries(result.ledgerTransaction.lines.map((l: { accountId: string; amountCents: number }) => [l.accountId, l.amountCents]));
    assert.deepEqual(lines, { [id('bank')]: -1130000, [id('ap')]: 1180000, [id('wht')]: -50000 });
    assert.equal(Object.values(lines).reduce((s, v) => s + Number(v), 0), 0, 'balanced');
    assert.equal((await db.collection('bills').doc(id('b1')).get()).data()?.status, 'paid');
    const payment = (await db.collection('payments').doc(result.paymentId).get()).data();
    assert.deepEqual([payment?.withheldCents, payment?.withholdingRatePercent, payment?.withholdingCertificate], [50000, 5, 'W-77']);
  });

  test('refused: more than the payment, and without a withholding account', async () => {
    await assert.rejects(pay('b2', 1180000), /less than the payment/);
    await db.collection('chartAccounts').doc(id('wht')).update({ isArchived: true });
    await assert.rejects(pay('b2', 50000), /account for tax withheld at source/);
    assert.equal((await db.collection('bills').doc(id('b2')).get()).data()?.status, 'unpaid', 'nothing half-done');
  });
});
