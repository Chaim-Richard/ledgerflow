/**
 * Emails to customers: templates (src/lib/emailTemplates.ts), the mail sender's plain-text part
 * (src/server/services/mailer.ts), provider bounce/complaint reports, reminders schedule
 * (src/lib/reminders.ts), and sending an invoice through the server with its send log
 * (database part with LF_TEST_DATABASE_URL).
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { DEFAULT_TEMPLATES, renderEmail, resolveTemplate, unknownPlaceholders } from '../lib/emailTemplates';
import { pdfText } from './helpers/pdfText';
import { htmlToText, setMailTransportForTests } from '../server/services/mailer';
import type { MailMessage } from '../server/services/mailer';
import { parseProviderReports } from '../server/routes/emailRoutes';
import { normalizeReminderSettings, remindersDue } from '../lib/reminders';
import type { Firestore } from '../server/db/pgFirestore';

describe('Email templates', () => {
  test('the workspace text wins; empty fields fall back to the default', () => {
    assert.deepEqual(resolveTemplate('invoice', { invoice: { subject: 'Your bill {{number}}', body: '  ' } }), { subject: 'Your bill {{number}}', body: DEFAULT_TEMPLATES.invoice.body });
    assert.deepEqual(resolveTemplate('reminder', null), DEFAULT_TEMPLATES.reminder);
  });

  test('placeholders are filled; markup in the text or the values is escaped; the link is a button', () => {
    const out = renderEmail({ subject: 'Invoice {{number}}\nfrom {{company}}', body: 'Hi {{customer}},\n\nPay here: {{link}}\n\n<b>{{unknown}}</b>' },
      { number: 'INV-1', company: 'A&B', customer: '<script>x</script>', link: 'https://x.test/i/abc' });
    assert.equal(out.subject, 'Invoice INV-1 from A&B', 'no line breaks in a subject');
    assert.equal(out.text, 'Hi <script>x</script>,\n\nPay here: https://x.test/i/abc\n\n<b>{{unknown}}</b>');
    assert.ok(!out.html.includes('<script>') && out.html.includes('&lt;script&gt;'));
    assert.ok(out.html.includes('&lt;b&gt;'));
    assert.match(out.html, /<a href="https:\/\/x\.test\/i\/abc"[^>]*>View invoice<\/a>/);
    assert.deepEqual(unknownPlaceholders('{{customer}} {{Nope}} {{ amount }}'), ['nope']);
  });

  test('plain text from HTML keeps paragraphs and link targets', () => {
    assert.equal(htmlToText('<p>Hello &amp; welcome</p><p>Pay <a href="https://x.test">here</a></p>'), 'Hello & welcome\nPay here (https://x.test)');
  });
});

describe('Provider reports', () => {
  test('Resend, Postmark and SendGrid bounces and complaints are understood', () => {
    assert.deepEqual(parseProviderReports({ type: 'email.bounced', data: { to: ['A@X.test'], email_id: 'r1' } }), [{ event: 'bounced', recipient: 'a@x.test', messageId: 'r1' }]);
    assert.deepEqual(parseProviderReports({ RecordType: 'SpamComplaint', Email: 'b@x.test', MessageID: 'p1' }), [{ event: 'complaint', recipient: 'b@x.test', messageId: 'p1' }]);
    assert.deepEqual(parseProviderReports([{ event: 'bounce', email: 'c@x.test', sg_message_id: 's1.filter' }, { event: 'open', email: 'c@x.test' }]), [{ event: 'bounced', recipient: 'c@x.test', messageId: 's1' }]);
    assert.deepEqual(parseProviderReports({ hello: 'world' }), []);
  });
});

describe('Reminder schedule', () => {
  const settings = normalizeReminderSettings({ enabled: true, daysAfterDue: [30, 3, 14, 3, 0, 400] });
  test('settings are cleaned: sorted, unique, 1–365', () => {
    assert.deepEqual(settings.daysAfterDue, [3, 14, 30]);
    assert.equal(normalizeReminderSettings(null).enabled, false);
  });

  test('each open overdue invoice gets the next reminder it is due for, once a day', () => {
    const inv = (id: string, fields: Record<string, unknown>) => ({ id, status: 'sent', dueDate: '2026-03-01', amountCents: 1000, customerId: 'c1', ...fields });
    const due = remindersDue([
      inv('a', {}), // 10 days: first reminder
      inv('b', { metadata: { remindersSent: 1 } }), // second is at 14 days: not yet
      inv('c', { dueDate: '2026-02-01', metadata: { remindersSent: 1 } }), // 38 days: second
      inv('d', { dueDate: '2026-01-01', metadata: { remindersSent: 3 } }), // all sent
      inv('e', { status: 'paid' }),
      inv('f', { amountPaidCents: 1000 }), // nothing due
      inv('g', { metadata: { noReminders: true } }),
      inv('h', { customerId: 'quiet' }),
      inv('i', { metadata: { lastReminderAt: '2026-03-11T06:10:00Z' } }), // already today
      inv('j', { status: 'draft' }),
    ], settings, '2026-03-11', new Set(['quiet']));
    assert.deepEqual(due, [{ invoiceId: 'a', step: 1, daysOverdue: 10 }, { invoiceId: 'c', step: 2, daysOverdue: 38 }]);
    assert.deepEqual(remindersDue([inv('a', {})], { ...settings, enabled: false }, '2026-03-11'), []);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Emailing an invoice', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_mail_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const outbox: MailMessage[] = [];
  const send = async (uid: string, invoice: string, body: Record<string, unknown> = {}) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/emails/invoices/${id(invoice)}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    process.env.EMAIL_WEBHOOK_SECRET = 'hook-secret-for-tests';
    setMailTransportForTests(async m => { outbox.push(m); return { delivered: true, provider: 'test', messageId: `m${outbox.length}-${ws}` }; });
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { emailWebhookRouter } = await import('../server/routes/emailRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({
      uid: 'owner-1', name: 'Mail Co', currency: 'EUR', timezone: 'UTC', members: ['owner-1', 'view-1'], roles: { 'view-1': 'viewer' },
      emailTemplates: { invoice: { subject: 'Bill {{number}} from {{company}}' } },
    });
    await db.collection('customers').doc(id('c1')).set({ workspaceId: ws, name: 'Acme', email: 'Billing@Acme.test' });
    await db.collection('invoices').doc(id('inv')).set({ workspaceId: ws, customerId: id('c1'), customerName: 'Acme', number: 'INV-9', amountCents: 125000, currency: 'EUR', status: 'pending', date: '2026-03-01', dueDate: '2026-03-31' });
    await db.collection('invoices').doc(id('draft')).set({ workspaceId: ws, customerId: id('c1'), number: 'INV-10', amountCents: 100, status: 'draft', dueDate: '2026-03-31' });
    const app = express();
    app.use(express.json());
    app.use('/api/v1/email-events', emailWebhookRouter);
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    setMailTransportForTests(null);
    server?.close();
    await db.pool.query(`delete from public."emailEvents" where data->>'recipient' like '%@acme.test'`);
    for (const table of ['invoices', 'bills', 'customers', 'vendors', 'emailEvents', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('viewers cannot send; drafts cannot be sent', async () => {
    assert.equal((await send('view-1', 'inv')).status, 403);
    assert.equal((await send('owner-1', 'draft')).status, 409);
    assert.equal(outbox.length, 0);
  });

  test('the invoice goes to the customer with the workspace template, text + HTML + PDF, and is logged', async () => {
    const res = await send('owner-1', 'inv');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [mail] = outbox;
    assert.equal(mail.to, 'billing@acme.test');
    assert.equal(mail.subject, 'Bill INV-9 from Mail Co');
    assert.match(String(mail.text), /€1,250\.00|1\.250,00|1,250\.00/, 'amount in the invoice currency');
    assert.ok(mail.html.includes('/i/pay_'));
    assert.equal(mail.attachments?.[0]?.filename, 'invoice_INV-9.pdf');
    assert.ok(Buffer.isBuffer(mail.attachments?.[0]?.content) && (mail.attachments?.[0]?.content as Buffer).subarray(0, 4).toString() === '%PDF');
    const inv = (await db.collection('invoices').doc(id('inv')).get()).data();
    assert.equal(inv?.status, 'sent');
    assert.match(String(inv?.paymentToken), /^pay_[0-9a-f]{64}$/);
    const log = await fetch(`${base}/api/v1/workspaces/${ws}/emails/log/${id('inv')}`, { headers: { 'x-test-uid': 'view-1' } }).then(r => r.json()) as { events: Array<{ event: string; recipient: string }> };
    assert.deepEqual(log.events.map(e => [e.event, e.recipient]), [['sent', 'billing@acme.test']]);
  });

  test('a bounce report (with the secret) is logged on the invoice, and the address is not emailed again', async () => {
    const bad = await fetch(`${base}/api/v1/email-events?token=wrong`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(bad.status, 401);
    const report = { type: 'email.bounced', data: { to: ['billing@acme.test'], email_id: `m1-${ws}` } };
    const ok = await fetch(`${base}/api/v1/email-events?token=hook-secret-for-tests`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) });
    assert.equal(ok.status, 200);
    const log = await fetch(`${base}/api/v1/workspaces/${ws}/emails/log/${id('inv')}`, { headers: { 'x-test-uid': 'owner-1' } }).then(r => r.json()) as { events: Array<{ event: string }> };
    assert.deepEqual(log.events.map(e => e.event).sort(), ['bounced', 'sent']);
    const again = await send('owner-1', 'inv', { template: 'reminder' });
    assert.equal(again.status, 409);
    assert.equal(outbox.length, 1);
  });

  test('statements (BE-07): every active customer with something open and an address; the rest skipped with the reason', async () => {
    await db.collection('customers').doc(id('c2')).set({ workspaceId: ws, name: 'No Mail Ltd' });
    await db.collection('customers').doc(id('c3')).set({ workspaceId: ws, name: 'Settled Inc', email: 'ap@settled.test' });
    await db.collection('customers').doc(id('c4')).set({ workspaceId: ws, name: 'Owes Co', email: 'AP@owes.test' });
    await db.collection('customers').doc(id('c5')).set({ workspaceId: ws, name: 'Gone Ltd', email: 'x@gone.test', status: 'inactive' });
    await db.collection('invoices').doc(id('i2')).set({ workspaceId: ws, customerId: id('c2'), number: 'INV-20', amountCents: 500, status: 'sent', date: '2026-03-01' });
    await db.collection('invoices').doc(id('i4')).set({ workspaceId: ws, customerId: id('c4'), number: 'INV-40', amountCents: 2500, status: 'sent', date: '2026-03-02' });
    await db.collection('invoices').doc(id('i5')).set({ workspaceId: ws, customerId: id('c5'), number: 'INV-50', amountCents: 900, status: 'sent', date: '2026-03-02' });
    const statements = (uid: string, body: Record<string, unknown> = {}) =>
      fetch(`${base}/api/v1/workspaces/${ws}/emails/statements`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });

    assert.equal((await statements('view-1')).status, 403);
    const res = await statements('owner-1');
    assert.equal(res.status, 200);
    const body = await res.json() as { sent: Array<{ id: string; to: string }>; skipped: Array<{ id: string; reason: string }>; failed: unknown[] };
    assert.deepEqual(body.sent.map(s => [s.id, s.to]), [[id('c4'), 'ap@owes.test']]);
    assert.deepEqual(body.skipped.map(s => [s.id, s.reason]).sort(), [
      [id('c1'), 'billing@acme.test bounced or reported spam'],
      [id('c2'), 'no email address'],
      [id('c3'), 'nothing is open'],
    ]);
    assert.deepEqual(body.failed, []);
    const mail = outbox[outbox.length - 1];
    assert.equal(mail.subject, 'Your statement from Mail Co');
    assert.match(String(mail.text), /The balance is .*25\.00/);
    assert.match(String(mail.attachments?.[0]?.filename), /^statement_Owes_Co\.pdf$/);
    assert.equal((mail.attachments?.[0]?.content as Buffer).subarray(0, 4).toString(), '%PDF');
    const log = await fetch(`${base}/api/v1/workspaces/${ws}/emails/log/${id('c4')}`, { headers: { 'x-test-uid': 'owner-1' } }).then(r => r.json()) as { events: Array<{ event: string }> };
    assert.deepEqual(log.events.map(e => e.event), ['sent']);

    const one = await statements('owner-1', { customerIds: [id('c5')] }).then(r => r.json()) as { sent: Array<{ id: string }> };
    assert.deepEqual(one.sent.map(s => s.id), [id('c5')], 'an archived customer can still be chosen by hand');

    // ISS-141: a chosen period prints the opening balance and only that period's activity
    assert.equal((await statements('owner-1', { customerIds: [id('c4')], startDate: '2026-3-1' })).status, 400);
    const april = await statements('owner-1', { customerIds: [id('c4')], startDate: '2026-04-01', endDate: '2026-04-30' }).then(r => r.json()) as { sent: Array<{ id: string }> };
    assert.deepEqual(april.sent.map(s => s.id), [id('c4')]);
    const aprilPdf = pdfText(outbox[outbox.length - 1].attachments?.[0]?.content as Buffer);
    assert.match(aprilPdf, /2026-04-01 Opening balance/);
    assert.doesNotMatch(aprilPdf, /INV-40/);
  });

  test('remittance advice (K-25): the vendor gets what was paid and for which bills, only when asked', async () => {
    const { emailRemittance } = await import('../server/services/documentEmailService');
    const { afterPaymentRecorded } = await import('../server/services/afterPayment');
    await db.collection('vendors').doc(id('v1')).set({ workspaceId: ws, name: 'Paper Co', email: 'Billing@Paper.test' });
    await db.collection('vendors').doc(id('v2')).set({ workspaceId: ws, name: 'No Mail Co' });
    await db.collection('bills').doc(id('b1')).set({ workspaceId: ws, vendorId: id('v1'), number: 'PC-77', amountCents: 2500, currency: 'EUR', status: 'paid' });
    const payment = { id: id('pay-v1'), workspaceId: ws, direction: 'made', contactId: id('v1'), contactName: 'Paper Co', amountCents: 2500, currency: 'EUR', date: '2026-03-20',
      allocations: [{ documentId: id('b1'), documentType: 'bill', amountCents: 2500 }] };
    const before = outbox.length;
    assert.equal(await afterPaymentRecorded(db, payment, 'owner-1'), undefined, 'not asked: nothing sent');
    assert.equal(outbox.length, before);
    assert.equal(await afterPaymentRecorded(db, payment, 'owner-1', { remittance: true }), 'sent');
    const mail = outbox[outbox.length - 1];
    assert.equal(mail.to, 'billing@paper.test');
    assert.equal(mail.subject, 'Payment from Mail Co');
    assert.match(String(mail.text), /Hello Paper Co,/);
    assert.match(String(mail.text), /on 2026-03-20 for: PC-77/);
    assert.equal(await emailRemittance(db, { ...payment, contactId: id('v2') }), 'no email');
    assert.equal(await emailRemittance(db, { ...payment, direction: 'received' }), 'not a vendor payment');
  });

  test('monthly statements (Y-28): once a month for workspaces that turned them on; opted-out customers skipped', async () => {
    const { runMonthlyStatements } = await import('../server/services/reminderService');
    await db.collection('customers').doc(id('c6')).set({ workspaceId: ws, name: 'No Statements Ltd', email: 'ap@nostatements.test', noStatements: true });
    await db.collection('invoices').doc(id('i6')).set({ workspaceId: ws, customerId: id('c6'), number: 'INV-60', amountCents: 700, status: 'sent', date: '2026-03-02' });
    const before = outbox.length;
    const off = await runMonthlyStatements(db, new Date('2026-11-01T09:00:00Z'));
    assert.equal(off.workspaces, 0, 'not turned on yet');
    await db.collection('workspaces').doc(ws).set({ reminderSettings: { enabled: false, daysAfterDue: [3], monthlyStatements: true } }, { merge: true });
    const first = await runMonthlyStatements(db, new Date('2026-11-01T09:00:00Z'));
    assert.deepEqual(first, { workspaces: 1, sent: 1, failed: 0 });
    assert.deepEqual(outbox.slice(before).map(m => m.to), ['ap@owes.test'], 'the opted-out, bounced, archived and settled ones get nothing');
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.lastStatementsMonth, '2026-11');
    assert.deepEqual(await runMonthlyStatements(db, new Date('2026-11-02T09:00:00Z')), { workspaces: 0, sent: 0, failed: 0 }, 'once a month');
    assert.equal((await runMonthlyStatements(db, new Date('2026-12-01T09:00:00Z'))).sent, 1, 'next month again');
  });
});
