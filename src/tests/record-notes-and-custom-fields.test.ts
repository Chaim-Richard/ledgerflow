/**
 * A-36 (CD-06/CF-08) notes on any record and A-37 (CG-01) custom fields. Hand-checked: a search
 * with two words finds notes that contain both in any order; a required custom field cannot be
 * cleared; numbers and dates are refused in words when they are not numbers and dates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { addRecordNote, editRecordNote, noteCountsByType, notePreview, noteProblem, notesForEntity, searchRecordNotes } from '../lib/recordNotes';
import { CUSTOM_FIELD_CSV_HEADERS, coerceCustomField, customFieldCsvRow, customFieldProblem, customFieldRequiredProblem, customFieldValues, fieldValueProblem, type CustomFieldDef } from '../lib/customFields';

const note = (id: string, body: string, at: string, entityId = 'cust1') =>
  addRecordNote({ id, workspaceId: 'w1', entityType: 'customer', entityId, body, authorUid: 'u1', authorName: 'Dana' }, at);

const notes = [
  note('n1', 'Called about the late invoice', '2026-10-01T09:00:00Z'),
  note('n2', 'Late invoice paid, they asked for Net 45', '2026-10-02T09:00:00Z'),
  note('n3', 'Moved warehouse', '2026-10-03T09:00:00Z', 'cust2'),
];

test('a note keeps who and when, and one record’s notes are newest first', () => {
  assert.equal(noteProblem('  '), 'Write something first.');
  assert.equal(noteProblem('x'.repeat(4001)), 'A note can be up to 4000 characters.');
  assert.equal(noteProblem('ok'), null);
  const thread = notesForEntity(notes, 'customer', 'cust1', 'w1');
  assert.deepEqual(thread.map(n => n.id), ['n2', 'n1']);
  assert.equal(thread[1].authorName, 'Dana');
  assert.equal(notesForEntity(notes, 'customer', 'cust1', 'w2').length, 0, 'another workspace sees nothing');
  const edited = editRecordNote(notes[0], 'Called twice about the late invoice', '2026-10-04T09:00:00Z');
  assert.equal(edited.editedAt, '2026-10-04T09:00:00Z');
  assert.equal(editRecordNote(edited, 'third time', '2026-10-05T09:00:00Z').editedAt, '2026-10-04T09:00:00Z', 'the first change time stands');
});

test('a search with two words finds notes that have both, in any order, and an empty search finds every note', () => {
  const found = searchRecordNotes(notes, 'invoice late');
  assert.deepEqual(found.map(n => n.id), ['n2', 'n1'], 'newest first');
  assert.deepEqual(searchRecordNotes(notes, 'warehouse').map(n => n.id), ['n3']);
  assert.deepEqual(searchRecordNotes(notes, 'dana').length, 3, 'the author is searchable');
  assert.deepEqual(searchRecordNotes(notes, 'cust2').map(n => n.id), ['n3'], 'the record is searchable');
  assert.equal(searchRecordNotes(notes, 'nothing like this').length, 0);
  assert.equal(searchRecordNotes(notes, '').length, 3);
  assert.equal(notePreview({ body: 'First line\nSecond line' }), 'First line');
  assert.equal(notePreview({ body: 'x'.repeat(90) }).endsWith('…'), true);
  assert.equal(noteCountsByType(notes).customer, 3);
  assert.equal(noteCountsByType(notes).item, 0);
});

const defs: CustomFieldDef[] = [
  { id: 'f1', entityType: 'customer', key: 'region', label: 'Region', type: 'text' },
  { id: 'f2', entityType: 'customer', key: 'creditLimit', label: 'Credit limit', type: 'number' },
  { id: 'f3', entityType: 'customer', key: 'renewal', label: 'Renewal', type: 'date', required: true },
  { id: 'f4', entityType: 'item', key: 'grade', label: 'Grade', type: 'choice', choices: ['A', 'B'] },
];

test('field definitions are checked for keys, duplicates and choices', () => {
  assert.equal(customFieldProblem(defs), null);
  assert.equal(customFieldProblem([{ id: 'x', entityType: 'customer', key: '9bad', label: 'X', type: 'text' }]), 'The key “9bad” must start with a letter and use letters, digits, - or _ (up to 40).');
  assert.equal(customFieldProblem([{ id: 'x', entityType: 'customer', key: 'a', label: ' ', type: 'text' }]), 'Every field needs a name.');
  assert.equal(customFieldProblem([defs[0], { ...defs[0], id: 'f9', key: 'REGION' }]), 'Two fields for the same record use the key “REGION”.');
  assert.equal(customFieldProblem([{ id: 'x', entityType: 'item', key: 'g', label: 'G', type: 'choice' }]), 'The choice field “G” needs at least one option.');
  assert.equal(customFieldProblem([{ id: 'x', entityType: 'item', key: 'g', label: 'G', type: 'text', choices: ['A'] }]), 'Only a choice field can list options (G).');
});

test('values are coerced with plain-word refusals, and required fields cannot be cleared', () => {
  assert.deepEqual(coerceCustomField(defs[1], '1500'), { ok: true, value: 1500 });
  assert.deepEqual(coerceCustomField(defs[1], 'not a number'), { ok: false, reason: 'Credit limit must be a number.' });
  assert.deepEqual(coerceCustomField(defs[2], '2026-13-01'), { ok: false, reason: 'Renewal must be a date (YYYY-MM-DD).' });
  assert.deepEqual(coerceCustomField(defs[2], ''), { ok: false, reason: 'Renewal is required.' });
  assert.deepEqual(coerceCustomField(defs[3], 'C'), { ok: false, reason: 'Grade must be one of: A, B.' });
  assert.deepEqual(coerceCustomField(defs[0], '   '), { ok: true, value: undefined }, 'an optional empty field is simply not set');
  assert.equal(fieldValueProblem(defs[0], 'x'.repeat(501)), 'Region can be up to 500 characters.');
  assert.equal(customFieldRequiredProblem(defs, 'customer', { renewal: '2026-01-01' }), null);
  assert.equal(customFieldRequiredProblem(defs, 'customer', {}), 'Renewal is required.');
});

test('the columns a list or export adds are the owner’s fields in the owner’s order', () => {
  assert.deepEqual(CUSTOM_FIELD_CSV_HEADERS(defs, 'customer'), ['Region', 'Credit limit', 'Renewal']);
  assert.deepEqual(customFieldValues(defs, 'customer', { region: 'North', creditLimit: '1500' }).map(v => v.value), ['North', 1500, undefined]);
  assert.deepEqual(customFieldCsvRow(defs, 'customer', { region: 'North', renewal: '2026-01-01' }), ['North', '', '2026-01-01']);
  assert.deepEqual(CUSTOM_FIELD_CSV_HEADERS(defs, 'vendor'), [], 'a type with no fields adds no columns');
});
