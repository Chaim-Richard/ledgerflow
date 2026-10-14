import test from 'node:test';
import assert from 'node:assert/strict';
import { maskCardNumbers, passesCardLuhn } from '../lib/cardNumberMask';
import { feedbackRecords } from '../lib/feedbackTicket';
import { addRecordNote, editRecordNote } from '../lib/recordNotes';

test('E-25 Luhn check recognises sample card lengths, not ordinary references', () => {
  for (const number of ['4111111111111111', '5555555555554444', '378282246310005']) {
    assert.equal(passesCardLuhn(number), true);
  }
  for (const value of ['', '1234567890', '4111111111111112', '0000000000000000', '12345678901234567890']) {
    assert.equal(passesCardLuhn(value), false, value);
  }
});

test('E-25 masks all but four digits in plain or grouped sample values, leaving ordinary text unchanged', () => {
  assert.equal(maskCardNumbers('4111 1111 1111 1111'), '•••• •••• •••• 1111');
  assert.equal(maskCardNumbers('5555-5555-5555-4444'), '••••-••••-••••-4444');
  assert.equal(maskCardNumbers('Card 4111111111111111 ending.'), 'Card ••••••••••••1111 ending.');
  assert.equal(maskCardNumbers('Invalid 4111111111111112; invoice 12345678.'), 'Invalid 4111111111111112; invoice 12345678.');
  assert.equal(maskCardNumbers('A4111111111111111B'), 'A4111111111111111B', 'embedded reference numbers stay unchanged');
  assert.equal(maskCardNumbers('0000000000000000'), '0000000000000000', 'reject repeated digits');
  assert.equal(maskCardNumbers(''), '');
  assert.equal(maskCardNumbers('שלום 4111 1111 1111 1111 תודה'), 'שלום •••• •••• •••• 1111 תודה');
  assert.equal(maskCardNumbers('4111111111111111 and 5555555555554444'), '••••••••••••1111 and ••••••••••••4444');
});

test('E-25 masks card values inside saved feedback records, not just on the UI', () => {
  const data = feedbackRecords({ id: 'test', workspaceId: 'ws-1', uid: 'u-1', screen: 'help',
    body: 'Issue in 4111 1111 1111 1111 (reference 34567)', date: '2026-10-14T02:00:00Z' });
  assert.ok(data.message.body.includes('•••• •••• •••• 1111'));
  assert.ok(!data.message.body.includes('4111 1111 1111 1111'));
  assert.ok(data.message.body.includes('34567'));
});

test('E-25 new and edited record notes mask values before returning records to be stored', () => {
  const note = addRecordNote({ id: 'n1', workspaceId: 'ws-1', entityType: 'bill',
    entityId: 'bill-1', body: 'שלום 4111 1111 1111 1111', authorUid: 'user-1' }, '2026-10-14T01:00:00Z');
  assert.equal(note.body, 'שלום •••• •••• •••• 1111');
  const edited = editRecordNote(note, 'New 5555-5555-5555-4444', '2026-10-14T02:00:00Z');
  assert.equal(edited.body, 'New ••••-••••-••••-4444');
  assert.equal(note.body, 'שלום •••• •••• •••• 1111', 'original object unchanged');
});
