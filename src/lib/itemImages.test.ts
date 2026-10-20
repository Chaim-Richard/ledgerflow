import test from 'node:test';
import assert from 'node:assert/strict';
import { attachmentRecord, attachmentsOf, MAX_ATTACHMENT_BYTES } from './attachments';
import { ITEM_IMAGE_MIME_TYPES, itemImageProblem, itemImages, latestItemImage } from './itemImages';

test('item image policy accepts only bounded JPEG, PNG, and WebP images', () => {
  for (const type of ITEM_IMAGE_MIME_TYPES) {
    assert.equal(itemImageProblem({ name: 'photo', size: MAX_ATTACHMENT_BYTES, type }), null);
  }
  assert.equal(itemImageProblem({ name: 'empty.png', size: 0, type: 'image/png' }), 'empty.png is empty');
  assert.match(itemImageProblem({ name: 'large.png', size: MAX_ATTACHMENT_BYTES + 1, type: 'image/png' }) || '', /most is 700 KB/);
  assert.equal(itemImageProblem({ name: 'notes.pdf', size: 100, type: 'application/pdf' }), 'notes.pdf must be a JPEG, PNG, or WebP image');
  assert.equal(itemImageProblem({ name: 'unknown', size: 100 }), 'unknown must be a JPEG, PNG, or WebP image');
});

test('an item image is a normal workspace-linked attachment and newest safe image wins', () => {
  const target = { collection: 'inventory' as const, id: 'item-7', label: 'Item כיסא Chair' };
  const old = attachmentRecord({ name: 'old.jpg', size: 50, type: 'image/jpeg' }, 'data:image/jpeg;base64,AA', target,
    { uid: 'u1', workspaceId: 'w1' }, '2026-10-18T10:00:00Z');
  const newest = attachmentRecord({ name: 'new.webp', size: 60, type: 'image/webp' }, 'data:image/webp;base64,AA', target,
    { uid: 'u1', workspaceId: 'w1' }, '2026-10-19T10:00:00Z');
  const unrelated = { ...newest, id: 'other', linkedId: 'other-item' };
  const nonImage = { ...newest, id: 'pdf', mimeType: 'application/pdf', fileUrl: 'data:application/pdf;base64,AA', name: 'manual.pdf' };
  const unsafe = { ...newest, id: 'unsafe', fileUrl: 'https://example.test/photo.webp' };
  const rows = attachmentsOf([
    { ...old, id: 'old' }, { ...newest, id: 'new' }, unrelated, nonImage, unsafe,
  ], target);
  assert.deepEqual(rows.map(file => file.id), ['new', 'pdf', 'unsafe', 'old']);
  assert.deepEqual(itemImages(rows).map(file => file.id), ['new', 'old']);
  assert.equal(latestItemImage(rows)?.id, 'new');
  assert.equal(latestItemImage([{ ...old, id: 'bad', fileUrl: 'data:image/svg+xml;base64,AA', mimeType: 'image/svg+xml' }]), undefined);
  assert.equal(newest.linkedCollection, 'inventory');
  assert.equal(newest.linkedId, 'item-7');
  assert.equal(newest.workspaceId, 'w1');
});
