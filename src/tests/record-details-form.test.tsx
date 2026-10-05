import './helpers/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { RecordDetailsForm } from '../components/common/RecordDetailsForm';
import type { DetailAdapter } from '../lib/recordDetails';
const target = { kind: 'vendors' as const, id: 'vendor' };
test('a related-record form keeps the parent draft and refused edit, preventing duplicate saves', async () => {
  let release!: () => void;
  let writes = 0;
  const adapter: DetailAdapter = { session: () => ({ uid: 'u', workspaceId: 'w', writable: true }), read: async () => ({ name: 'ספק Vendor', address: 'Old', workspaceId: 'w' }), update: async () => { writes++; await new Promise<void>(resolve => { release = resolve; }); throw new Error('Server refused'); } };
  const view = render(<><input aria-label="Parent bill number" defaultValue="Draft 17" /><RecordDetailsForm target={target} adapter={adapter} /></>);
  try {
    await waitFor(() => assert.ok(view.getByRole('textbox', { name: 'Address' })));
    fireEvent.change(view.getByRole('textbox', { name: 'Address' }), { target: { value: 'ירושלים\nStreet 8' } });
    view.getByRole('button', { name: 'Save details' }).focus(); fireEvent.click(view.getByRole('button', { name: 'Save details' }));
    await waitFor(() => assert.equal(writes, 1));
    assert.equal((view.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled, true);
    fireEvent.submit(view.container.querySelector('form')!); assert.equal(writes, 1);
    release(); await waitFor(() => assert.match(view.getByRole('alert').textContent || '', /Server refused/));
    assert.equal((view.getByRole('textbox', { name: 'Address' }) as HTMLTextAreaElement).value, 'ירושלים\nStreet 8');
    assert.equal((view.getByRole('textbox', { name: 'Parent bill number' }) as HTMLInputElement).value, 'Draft 17');
    assert.equal(document.activeElement, view.getByRole('button', { name: 'Save details' }), 'a refused save leaves keyboard focus ready for retry');
  } finally { cleanup(); }
});
test('confirmed saves announce future use and retain the saved details for further edits', async () => {
  let address = 'Old';
  const adapter: DetailAdapter = { session: () => ({ uid: 'u', workspaceId: 'w', writable: true }), read: async () => ({ name: 'Vendor', address, workspaceId: 'w' }), update: async (_target, changes) => { address = changes.address; } };
  const view = render(<RecordDetailsForm target={target} adapter={adapter} />);
  try { await waitFor(() => assert.ok(view.getByRole('textbox', { name: 'Address' }))); fireEvent.change(view.getByRole('textbox', { name: 'Address' }), { target: { value: 'New' } }); fireEvent.click(view.getByRole('button', { name: 'Save details' })); await waitFor(() => assert.match(view.getByRole('status').textContent || '', /saved for future/)); assert.equal(address, 'New'); }
  finally { cleanup(); }
});
test('confirmed partial saves refresh unedited fields so a later save cannot undo another editor', async () => {
  let record = { name: 'Vendor', address: 'Old', workspaceId: 'w' };
  const writes: Record<string, string>[] = [];
  const adapter: DetailAdapter = { session: () => ({ uid: 'u', workspaceId: 'w', writable: true }), read: async () => record, update: async (_target, changes) => { writes.push(changes); record = { ...record, ...changes }; } };
  const view = render(<RecordDetailsForm target={target} adapter={adapter} />);
  try {
    await waitFor(() => assert.ok(view.getByRole('textbox', { name: 'Address' })));
    record = { ...record, name: 'Renamed by another editor' };
    fireEvent.change(view.getByRole('textbox', { name: 'Address' }), { target: { value: 'New' } }); fireEvent.click(view.getByRole('button', { name: 'Save details' }));
    await waitFor(() => assert.match(view.getByRole('status').textContent || '', /saved for future/));
    assert.equal((view.getByLabelText('Name') as HTMLInputElement).value, record.name);
    fireEvent.change(view.getByRole('textbox', { name: 'Address' }), { target: { value: 'Again' } }); fireEvent.click(view.getByRole('button', { name: 'Save details' }));
    await waitFor(() => assert.equal(writes.length, 2));
    assert.deepEqual(writes, [{ address: 'New' }, { address: 'Again' }]); assert.equal(record.name, 'Renamed by another editor');
  } finally { cleanup(); }
});
