/**
 * Thank-you email after a payment (BE-02): only when the workspace turned it on, to the
 * customer's address, with the payment amount, logged; never for bills, bounced addresses or a
 * customer with no email. Needs LF_TEST_DATABASE_URL.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';
import type { MailMessage } from '../server/services/mailer';
import { normalizeReminderSettings } from '../lib/reminders';

const url = process.env.LF_TEST_DATABASE_URL;

test('the setting is off unless turned on', () => {
  assert.equal(normalizeReminderSettings(null).thankYou, false);
  assert.equal(normalizeReminderSettings({ thankYou: true }).thankYou, true);
});

describe('Thank-you emails (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_thanks_${crypto.randomBytes(4).toString('hex')}`;
  const id = (n: string) => `${ws}_${n}`;
  const outbox: MailMessage[] = [];
  let db: Firestore;
  let thankForPayment: typeof import('../server/services/documentEmailService').thankForPayment;
  let setTransport: typeof import('../server/services/mailer').setMailTransportForTests;

  before(async () => {
    process.env.DATABASE_URL = url;
    ({ thankForPayment } = await import('../server/services/documentEmailService'));
    ({ setMailTransportForTests: setTransport } = await import('../server/services/mailer'));
    setTransport(async m => { outbox.push(m); return { delivered: true, provider: 'test', messageId: `m${outbox.length}` }; });
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner', name: 'Thanks Co', currency: 'USD', members: ['owner'], reminderSettings: { enabled: false, daysAfterDue: [3], thankYou: true } });
    await db.collection('customers').doc(id('c1')).set({ workspaceId: ws, name: 'Acme', email: 'AP@acme.test' });
    await db.collection('customers').doc(id('c2')).set({ workspaceId: ws, name: 'No Mail' });
    await db.collection('invoices').doc(id('i1')).set({ workspaceId: ws, customerId: id('c1'), customerName: 'Acme', number: 'INV-7', amountCents: 10000, amountPaidCents: 4000, status: 'partially_paid', currency: 'USD' });
    await db.collection('invoices').doc(id('i2')).set({ workspaceId: ws, customerId: id('c2'), customerName: 'No Mail', number: 'INV-8', amountCents: 500, status: 'sent' });
  });

  after(async () => {
    setTransport(null);
    for (const table of ['invoices', 'customers', 'emailEvents', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('a payment on INV-7 thanks Acme for $40.00 and logs it; no email address or a bill: nothing', async () => {
    const result = await thankForPayment(db as never, { workspaceId: ws, allocations: [
      { documentId: id('i1'), documentType: 'invoice', amountCents: 4000 },
      { documentId: id('i2'), documentType: 'invoice', amountCents: 500 },
      { documentId: id('b1'), documentType: 'bill', amountCents: 999 },
    ] });
    assert.deepEqual(result.map(r => r.result), ['sent', 'no email']);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, 'ap@acme.test');
    assert.equal(outbox[0].subject, 'Thank you for your payment');
    assert.match(outbox[0].text || '', /Hello Acme,[\s\S]*payment of \$40\.00 for invoice INV-7/);
    const log = await db.collection('emailEvents').where('workspaceId', '==', ws).get();
    assert.deepEqual(log.docs.map(d => [d.data().template, d.data().event, d.data().documentId]), [['receipt', 'sent', id('i1')]]);
  });

  test('turned off, or the address bounced before: no email', async () => {
    await db.collection('workspaces').doc(ws).set({ reminderSettings: { enabled: false, daysAfterDue: [3], thankYou: false } }, { merge: true });
    const off = await thankForPayment(db as never, { workspaceId: ws, allocations: [{ documentId: id('i1'), documentType: 'invoice', amountCents: 100 }] });
    assert.deepEqual(off.map(r => r.result), ['off']);
    await db.collection('workspaces').doc(ws).set({ reminderSettings: { enabled: false, daysAfterDue: [3], thankYou: true } }, { merge: true });
    await db.collection('emailEvents').doc(id('bounce')).set({ workspaceId: ws, recipient: 'ap@acme.test', event: 'bounced', timestamp: new Date().toISOString() });
    const bounced = await thankForPayment(db as never, { workspaceId: ws, allocations: [{ documentId: id('i1'), documentType: 'invoice', amountCents: 100 }] });
    assert.deepEqual(bounced.map(r => r.result), ['suppressed']);
    assert.equal(outbox.length, 1, 'still only the first email');
  });
});
