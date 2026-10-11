/**
 * The workspace's money display setting (C-25): owners may save `moneyDisplay` ({ locale, negativeStyle });
 * the database refuses any other shape, however it is written. Display only: no amount is touched.
 * Runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';
import { moneyText } from '../lib/moneyFormat';

describe('Display only', () => {
  test('accounting negatives and a locale change the text, never the amount', () => {
    assert.equal(moneyText(-123456, 'USD', 2, { locale: 'en-US', negativeStyle: 'accounting' }), '($1,234.56)');
    assert.equal(moneyText(-123456, 'USD', 2, { locale: 'en-US' }), '-$1,234.56');
    assert.equal(moneyText(123456, 'USD', 2, { locale: 'not a locale!' }), moneyText(123456, 'USD', 2), 'a bad locale falls back to the default');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Saving the setting (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_money_${crypto.randomBytes(4).toString('hex')}`;
  let db: Firestore;
  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Money', currency: 'USD', members: ['owner-1'] });
  });
  after(async () => {
    await db.pool.query('delete from public.workspaces where id = $1', [ws]);
    await db.terminate();
  });

  test('a locale and a negative style are kept', async () => {
    await db.collection('workspaces').doc(ws).update({ moneyDisplay: { locale: 'he-IL', negativeStyle: 'accounting' } });
    assert.deepEqual((await db.collection('workspaces').doc(ws).get()).data()?.moneyDisplay, { locale: 'he-IL', negativeStyle: 'accounting' });
  });

  for (const [what, value] of [
    ['an unknown negative style', { negativeStyle: 'red' }],
    ['a locale with other characters', { locale: "en-US'; drop" }],
    ['an extra field', { locale: 'en-US', fontSize: 40 }],
    ['not an object', 'accounting'],
  ] as const) {
    test(`refused: ${what}`, async () => {
      await assert.rejects(db.collection('workspaces').doc(ws).update({ moneyDisplay: value }));
      assert.deepEqual((await db.collection('workspaces').doc(ws).get()).data()?.moneyDisplay, { locale: 'he-IL', negativeStyle: 'accounting' });
    });
  }
});
