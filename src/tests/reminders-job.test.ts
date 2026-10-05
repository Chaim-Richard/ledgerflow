/**
 * The daily payment reminder job (src/server/services/reminderService.ts): only workspaces that
 * turned reminders on, by the workspace's date, the next step only, once a day, customers marked
 * "no reminders" skipped. Needs LF_TEST_DATABASE_URL.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { setMailTransportForTests } from '../server/services/mailer';
import type { MailMessage } from '../server/services/mailer';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Daily payment reminders', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_rem_${crypto.randomBytes(4).toString('hex')}`;
  const off = `${ws}_off`;
  const id = (name: string) => `${ws}_${name}`;
  let db: Firestore;
  let runReminders: typeof import('../server/services/reminderService').runReminders;
  const outbox: MailMessage[] = [];

  before(async () => {
    process.env.DATABASE_URL = url;
    setMailTransportForTests(async m => { outbox.push(m); return { delivered: true, provider: 'test', messageId: `r${outbox.length}-${ws}` }; });
    ({ runReminders } = await import('../server/services/reminderService'));
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'o', name: 'Remind Co', currency: 'USD', timezone: 'America/Los_Angeles', reminderSettings: { enabled: true, daysAfterDue: [3, 14] } });
    await db.collection('workspaces').doc(off).set({ uid: 'o', name: 'Quiet Co', reminderSettings: { enabled: false, daysAfterDue: [3] } });
    await db.collection('customers').doc(id('c1')).set({ workspaceId: ws, name: 'Acme', email: 'ap@acme-rem.test' });
    await db.collection('customers').doc(id('c2')).set({ workspaceId: ws, name: 'Quiet', email: 'ap@quiet-rem.test', noReminders: true });
    await db.collection('customers').doc(id('c3')).set({ workspaceId: ws, name: 'Paper Ltd', email: 'ap@paper-rem.test', deliveryMethod: 'post' });
    const inv = (wsId: string, name: string, fields: Record<string, unknown>) =>
      db.collection('invoices').doc(`${wsId}_${name}`).set({ workspaceId: wsId, customerId: id('c1'), number: name, amountCents: 5000, status: 'sent', dueDate: '2026-09-20', ...fields });
    await inv(ws, 'late5', {});                                     // 5 days late in LA: first reminder
    await inv(ws, 'late2', { dueDate: '2026-09-23' });              // 2 days: not yet
    await inv(ws, 'quiet', { customerId: id('c2') });                // customer said no
    await inv(ws, 'paid', { status: 'paid', amountPaidCents: 5000 });
    await inv(ws, 'paper', { customerId: id('c3') });               // gets posted copies, not emails (Y-27)
    await inv(off, 'other', { customerId: id('c1') });               // workspace has reminders off
  });

  after(async () => {
    setMailTransportForTests(null);
    await db.pool.query(`delete from public."emailEvents" where data->>'recipient' like '%-rem.test'`);
    for (const table of ['invoices', 'customers', 'notifications', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, off]]);
    }
    await db.terminate();
  });

  test('sends the first reminder to the right invoice only, once a day', async () => {
    const now = new Date('2026-09-26T03:00:00Z'); // 25 Sept 20:00 in Los Angeles
    const first = await runReminders(db, now, 'https://app.test');
    assert.deepEqual(first, { sent: 1, failed: 0 });
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, 'ap@acme-rem.test');
    assert.match(outbox[0].subject, /late5/);
    const meta = (await db.collection('invoices').doc(id('late5')).get()).data()?.metadata;
    assert.equal(meta?.remindersSent, 1);
    assert.deepEqual(await runReminders(db, now, 'https://app.test'), { sent: 0, failed: 0 }, 'not twice the same day');
  });

  test('the second reminder waits for its day', async () => {
    // 30 Sept: late2 is 7 days late (its first reminder); late5 is 10 days late (second is at 14)
    assert.equal((await runReminders(db, new Date('2026-09-30T18:00:00Z'), 'https://app.test')).sent, 1);
    assert.equal((await db.collection('invoices').doc(id('late5')).get()).data()?.metadata?.remindersSent, 1);
    // 4 Oct: late5 is 14 days late (second reminder); late2 is 11 (its second is at 14)
    assert.equal((await runReminders(db, new Date('2026-10-04T18:00:00Z'), 'https://app.test')).sent, 1);
    assert.equal((await db.collection('invoices').doc(id('late5')).get()).data()?.metadata?.remindersSent, 2);
    assert.equal(outbox.length, 3);
  });

  test('a customer who gets paper: one note in the bell per reminder day, not one every day (L-191)', async () => {
    const notes = async () => (await db.collection('notifications').where('workspaceId', '==', ws).get()).docs
      .map(d => d.data()).filter(n => n.recordId === id('paper')).map(n => n.eventKey).sort();
    // the job ran on 26 Sept twice, 30 Sept and 4 Oct: reminder 1 (3 days late) and 2 (14 days), once each
    const both = [`invoice.paper_copy:${id('paper')}:1`, `invoice.paper_copy:${id('paper')}:2`];
    assert.deepEqual(await notes(), both);
    assert.ok(!outbox.some(m => m.to === 'ap@paper-rem.test'), 'never emailed');
    await runReminders(db, new Date('2026-10-05T18:00:00Z'), 'https://app.test');
    await runReminders(db, new Date('2026-10-06T18:00:00Z'), 'https://app.test');
    assert.deepEqual(await notes(), both, 'no new note on the following days');
  });
});
