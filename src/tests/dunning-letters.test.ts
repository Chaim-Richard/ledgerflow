/**
 * A-70: dunning letters. Three steps by days overdue, each sent once, never out of order; the text
 * in English and Hebrew; amounts in the invoice currency without float rounding.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { dunningAmountText, dunningLetter, dunningLogFor, dunningStepDue, nextDunningStep, type DunningLogEntry } from '../lib/dunningLetters';

describe('A-70 dunning letters', () => {
  test('the step due follows the days overdue (default schedule: 7, 21 and 45 days)', () => {
    assert.equal(dunningStepDue(0), 0);
    assert.equal(dunningStepDue(6), 0);
    assert.equal(dunningStepDue(7), 1);
    assert.equal(dunningStepDue(21), 2);
    assert.equal(dunningStepDue(60), 3);
  });

  test('a workspace schedule replaces the default', () => {
    const custom = [{ step: 1 as const, fromDaysOverdue: 3 }, { step: 2 as const, fromDaysOverdue: 10 }, { step: 3 as const, fromDaysOverdue: 20 }];
    assert.equal(dunningStepDue(3, custom), 1);
    assert.equal(dunningStepDue(10, custom), 2);
  });

  test('each step is sent once; after step 2 went out, step 1 is never sent again', () => {
    const log: DunningLogEntry[] = [{ invoiceId: 'inv_1', step: 1, sentAt: '2026-10-01T09:00:00Z', channel: 'email' }];
    assert.equal(nextDunningStep(log, 'inv_1', 10), null, 'step 1 already sent');
    assert.equal(nextDunningStep(log, 'inv_1', 25), 2, 'step 2 is due now');
    log.push({ invoiceId: 'inv_1', step: 2, sentAt: '2026-10-20T09:00:00Z', channel: 'email' });
    assert.equal(nextDunningStep(log, 'inv_1', 30), null);
    assert.equal(nextDunningStep(log, 'inv_1', 50), 3);
  });

  test('when several steps are due and none was sent, one letter goes: the latest due step', () => {
    assert.equal(nextDunningStep([], 'inv_9', 60), 3);
  });

  test('the log is kept per invoice, oldest first', () => {
    const log: DunningLogEntry[] = [
      { invoiceId: 'a', step: 2, sentAt: '2026-10-20', channel: 'email' },
      { invoiceId: 'b', step: 1, sentAt: '2026-10-01', channel: 'email' },
      { invoiceId: 'a', step: 1, sentAt: '2026-10-01', channel: 'email' },
    ];
    assert.deepEqual(dunningLogFor(log, 'a').map(e => e.step), [1, 2]);
  });

  test('amounts are shown in the invoice currency with exact cents', () => {
    assert.equal(dunningAmountText(123450, 'EUR'), '1,234.50 EUR');
    assert.equal(dunningAmountText(5, 'USD'), '0.05 USD');
    assert.equal(dunningAmountText(-2000, 'ILS'), '-20.00 ILS');
    assert.equal(dunningAmountText(99_999_999_999_999, 'USD'), '999,999,999,999.99 USD');
  });

  test('English letters: escalating wording with the invoice, due date, days and amount', () => {
    const first = dunningLetter({ invoiceNumber: 'INV-7', customerName: 'Acme', companyName: 'Ledger Co', dueDate: '2026-09-01', outstandingCents: 150000, currency: 'usd', daysOverdue: 10, step: 1 });
    assert.match(first.subject, /Friendly reminder: invoice INV-7/);
    assert.match(first.body, /1,500\.00 USD/);
    assert.equal(first.direction, 'ltr');
    const last = dunningLetter({ invoiceNumber: 'INV-7', customerName: 'Acme', companyName: 'Ledger Co', dueDate: '2026-09-01', outstandingCents: 150000, currency: 'USD', daysOverdue: 50, step: 3 });
    assert.match(last.subject, /Final notice/);
    assert.match(last.body, /50 days after its due date/);
  });

  test('Hebrew letters are right to left with Hebrew wording and the same figures', () => {
    const letter = dunningLetter({ invoiceNumber: '1042', customerName: 'לקוח', companyName: 'חברה', dueDate: '2026-09-01', outstandingCents: 2500, currency: 'ILS', daysOverdue: 25, step: 2, language: 'he' });
    assert.equal(letter.direction, 'rtl');
    assert.match(letter.subject, /חשבונית 1042/);
    assert.match(letter.body, /25 ימים/);
    assert.match(letter.body, /25\.00 ILS/);
  });

  test('control characters in names are cleaned and a missing field leaves nothing behind', () => {
    const letter = dunningLetter({ invoiceNumber: 'X', customerName: 'Bad\u0000Name', companyName: '', dueDate: '2026-09-01', outstandingCents: 0, currency: 'USD', daysOverdue: 1, step: 1 });
    assert.match(letter.body, /Dear Bad Name,/);
    assert.match(letter.body, /Kind regards,\n\n?$|Kind regards,\n$/);
  });
});
