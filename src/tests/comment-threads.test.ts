/**
 * A-21 (CF-07): comment threads. Hand-checked: a teammate named with @ is told and the writer is
 * not; the thread is oldest first and other records are left out; the writer can change their own
 * comment for ten minutes and no longer, and nobody can change someone else's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMENT_MAX_LENGTH, commentEditProblem, commentProblem, commentWhen, editedThreadComment, newThreadComment, threadComments, threadParticipants,
} from '../lib/commentThreads';

const people = [{ uid: 'u1', email: 'dana@example.com' }, { uid: 'u2', email: 'noam@example.com' }];
const at = (minutesAfterNine: number) => new Date(Date.UTC(2026, 9, 11, 9, minutesAfterNine)).toISOString();

const first = newThreadComment(
  { id: 'c1', workspaceId: 'w1', entityType: 'customer', entityId: 'cust1', author: { uid: 'u1', name: 'Dana', email: 'dana@example.com' }, body: 'Please call @noam about the quote.' },
  people, at(0),
);

test('a comment keeps who, when and the teammates it named', () => {
  assert.equal(first.body, 'Please call @noam about the quote.');
  assert.deepEqual(first.mentions, ['u2'], 'the named teammate is told');
  assert.equal(first.authorName, 'Dana');
  assert.equal(first.createdAt, at(0));
  const own = newThreadComment({ id: 'c2', workspaceId: 'w1', entityType: 'customer', entityId: 'cust1', author: { uid: 'u2', email: 'noam@example.com' }, body: 'ok @dana' }, people, at(1));
  assert.deepEqual(own.mentions, ['u1'], 'everyone named is found');
  const alone = newThreadComment({ id: 'c3', workspaceId: 'w1', entityType: 'customer', entityId: 'cust1', author: { uid: 'u1' }, body: 'just @dana writing' }, people, at(2));
  assert.deepEqual(alone.mentions, [], 'the writer is never told about their own words');
});

test('the thread is oldest first, one record at a time', () => {
  const other = newThreadComment({ id: 'c4', workspaceId: 'w1', entityType: 'project', entityId: 'cust1', author: { uid: 'u2' }, body: 'another record' }, people, at(3));
  const later = newThreadComment({ id: 'c5', workspaceId: 'w1', entityType: 'customer', entityId: 'cust1', author: { uid: 'u2' }, body: 'done' }, people, at(4));
  const elsewhere = newThreadComment({ id: 'c6', workspaceId: 'w2', entityType: 'customer', entityId: 'cust1', author: { uid: 'u2' }, body: 'other workspace' }, people, at(5));
  const thread = threadComments([later, other, first, elsewhere], 'customer', 'cust1', 'w1');
  assert.deepEqual(thread.map(c => c.id), ['c1', 'c5']);
  assert.deepEqual(threadParticipants(thread).map(p => p.uid), ['u1', 'u2']);
});

test('the writer may change their own comment for ten minutes, and no longer', () => {
  assert.equal(commentProblem('   '), 'Write something first.');
  assert.equal(commentProblem('x'.repeat(COMMENT_MAX_LENGTH + 1)), `A comment can be up to ${COMMENT_MAX_LENGTH} characters.`);
  assert.equal(commentProblem('fine'), null);
  assert.equal(commentEditProblem({ authorUid: 'u1', createdAt: at(0) }, 'u1', at(10)), null, 'exactly ten minutes is still inside');
  assert.equal(commentEditProblem({ authorUid: 'u1', createdAt: at(0) }, 'u1', at(11)), 'A comment can be changed for 10 minutes after it is written.');
  assert.equal(commentEditProblem({ authorUid: 'u1', createdAt: at(0) }, 'u2', at(1)), 'Only your own comment can be edited.');
  assert.equal(commentEditProblem({ authorUid: 'u1', createdAt: at(0) }, '', at(1)), 'Only the person who wrote a comment can change it.');
});

test('an edit keeps the original time, records the change and refreshes the mentions', () => {
  const edited = editedThreadComment(first, 'Thanks @noam and @dana', people, at(5));
  assert.equal(edited.createdAt, at(0));
  assert.equal(edited.editedAt, at(5));
  assert.deepEqual(edited.mentions, ['u2'], 'still only the teammate, not the writer');
  const again = editedThreadComment(edited, 'one more thing', people, at(9));
  assert.equal(again.editedAt, at(5), 'the first change time stands');
  assert.deepEqual(again.mentions, []);
});

test('when a comment was written is said in plain words', () => {
  const now = new Date(Date.UTC(2026, 9, 14, 12, 0));
  assert.equal(commentWhen({ createdAt: new Date(Date.UTC(2026, 9, 14, 9, 5)).toISOString() }, now), "today at 09:05");
  assert.equal(commentWhen({ createdAt: at(5) }, now), "3 days ago");
  assert.equal(commentWhen({ createdAt: new Date(Date.UTC(2026, 9, 13, 9, 12)).toISOString() }, now), 'yesterday at 09:12');
  assert.equal(commentWhen({ createdAt: new Date(Date.UTC(2026, 9, 11, 9, 0)).toISOString() }, now), '3 days ago');
  assert.equal(commentWhen({ createdAt: new Date(Date.UTC(2026, 6, 1, 9, 0)).toISOString() }, now), '2026-07-01');
});
