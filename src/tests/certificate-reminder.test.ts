/**
 * C-83: the reminder letter for a customer's tax certificate is a draft only. It is written for a
 * certificate that has expired, is about to expire, or has no recorded expiry; it says what the
 * records hold without claiming the customer is taxable, and it never sends anything itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { certificateReminderDraft, certificateReminderRows, needsCertificateReminder } from '../lib/tax/certificateReminder';

const options = { entityName: 'ספרים בע"מ', today: '2026-10-27' };

test('an expiring certificate gets an English draft with what the records hold', () => {
  const draft = certificateReminderDraft({ customer: 'Acme Ltd', number: 'CERT-77', expires: '2026-11-10', state: 'Expiring within 30 days', email: 'books@acme.test' }, 'en', options);
  assert.ok(draft);
  assert.match(draft.subject, /Request for an updated tax exemption certificate — Acme Ltd/);
  assert.match(draft.body, /number CERT-77, expiry 2026-11-10 \(checked on 2026-10-27\)/);
  assert.match(draft.body, /This letter is a request only; it is not a decision about your tax status\./);
  assert.match(draft.body, /Kind regards,\nספרים בע"מ/, 'the workspace name signs it');
  assert.match(draft.mailto || '', /^mailto:books@acme\.test\?subject=/);
  assert.match(decodeURIComponent((draft.mailto || '').split('body=')[1] || ''), /Acme Ltd/);
});

test('a Hebrew draft reads right to left with the Hebrew words for the missing parts', () => {
  const draft = certificateReminderDraft({ customer: 'חברת דוגמה', number: '', expires: '', state: 'No expiry recorded' }, 'he', options);
  assert.ok(draft);
  assert.match(draft.subject, /בקשה לאישור פטור ממס מעודכן — חברת דוגמה/);
  assert.match(draft.body, /מספר לא נרשם, תוקף לא נרשם \(נבדק ב-2026-10-27\)/);
  assert.match(draft.body, /בקשה בלבד/);
  assert.equal(draft.mailto, undefined, 'no saved email means no mail link, not an empty one');
});

test('only a date that passed, is coming, or is missing asks for a letter', () => {
  assert.equal(needsCertificateReminder('Expired'), true);
  assert.equal(needsCertificateReminder('Expiring within 30 days'), true);
  assert.equal(needsCertificateReminder('No expiry recorded'), true);
  assert.equal(needsCertificateReminder('Current by recorded date'), false);
  assert.equal(certificateReminderDraft({ customer: 'Acme', number: 'C-1', expires: '2027-06-01', state: 'Current by recorded date' }, 'en', options), null);
  assert.equal(certificateReminderDraft({ customer: 'Acme', number: '', expires: 'not a day', state: 'Needs review' }, 'he', options), null,
    'an internal record problem is fixed on the customer, not by writing to them');
});

test('the drafts keep the report order and skip the customers that need no letter', () => {
  const rows = [
    { id: '1', customer: 'Acme', number: 'A-1', expires: '2026-10-01', state: 'Expired' as const },
    { id: '2', customer: 'Beta', number: 'B-1', expires: '2027-01-01', state: 'Current by recorded date' as const },
    { id: '3', customer: 'Gamma', number: '', expires: '', state: 'No expiry recorded' as const },
  ];
  const drafts = certificateReminderRows(rows, 'en', options);
  assert.deepEqual(drafts.map(draft => draft.customer), ['Acme', 'Gamma']);
});
