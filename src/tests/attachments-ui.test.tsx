/**
 * Attachments on screen (K-07): the files panel lists a record's files, attaches new ones (saved one
 * by one, a too-big one refused with the reason and nothing written), and removes through the server
 * (writers any file, others their own). A new invoice keeps the picked files and hands them over on
 * save; the old box that said "2 file(s) attached" without saving anything is gone.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AttachmentsPanel from '../components/common/AttachmentsPanel';
import InvoiceModal from '../components/sales/InvoiceModal';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { MAX_ATTACHMENT_BYTES } from '../lib/attachments';
import { makeChartAccount, makeCustomer } from './fixtures';
import type { Invoice } from '../types';

type Call = { url: string; method: string; body: unknown };
// the page's File (jsdom's), which its FileReader reads; Node has a File of its own
const PageFile = (window as unknown as { File: typeof File }).File;
const stored = (id: string, name: string, uid: string, createdAt: string) => ({
  id, updated_at: createdAt,
  data: { workspaceId: 'component-workspace', uid, name, fileUrl: 'data:text/plain;base64,aGk=', sizeBytes: 2, createdAt, linkedCollection: 'invoices', linkedId: 'inv1', linkedLabel: 'Invoice INV-1' },
});

describe('The files panel', () => {
  let calls: Call[] = [];
  let rows: ReturnType<typeof stored>[] = [];
  beforeEach(() => {
    calls = [];
    rows = [stored('f1', 'old.pdf', 'someone', '2026-10-01T00:00:00Z'), stored('f2', 'mine.pdf', 'test-user', '2026-10-05T00:00:00Z')];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method || 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      const body = url.includes('/rest/v1/documents') && (init?.method || 'GET') === 'GET' ? rows : url.includes('/attachments/') ? { status: 'success' } : null;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    window.confirm = () => true;
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });
  const target = { collection: 'invoices' as const, id: 'inv1', label: 'Invoice INV-1' };

  test('lists the record\'s files newest first; attaches a new one; refuses a too-big one with the reason', async () => {
    setComponentWorkspace('bookkeeper');
    render(<AttachmentsPanel target={target} />);
    await waitFor(() => assert.equal(screen.getAllByRole('listitem').length, 2));
    assert.deepEqual(screen.getAllByRole('listitem').map(li => li.querySelector('bdi')?.textContent), ['mine.pdf', 'old.pdf']);
    assert.match(calls.find(c => c.url.includes('/rest/v1/documents'))!.url, /linkedId=eq\.inv1/);

    const input = screen.getByLabelText('Attach files to Invoice INV-1') as HTMLInputElement;
    const big = new PageFile(['x'], 'huge.tif', { type: 'image/tiff' });
    Object.defineProperty(big, 'size', { value: MAX_ATTACHMENT_BYTES + 1 });
    await act(async () => { fireEvent.change(input, { target: { files: [new PageFile(['hello'], 'contract.pdf', { type: 'application/pdf' }), big] } }); });
    await waitFor(() => assert.equal(screen.getAllByRole('listitem').length, 3));
    const writes = calls.filter(c => /\/rpc\/lf_set/.test(c.url)).map(c => (c.body as { p_table: string; p_data: Record<string, unknown> }));
    assert.equal(writes.length, 1, 'only the file that fits is written');
    assert.deepEqual([writes[0].p_table, writes[0].p_data.name, writes[0].p_data.linkedCollection, writes[0].p_data.linkedId, writes[0].p_data.uid], ['documents', 'contract.pdf', 'invoices', 'inv1', 'test-user']);
    assert.match(String(writes[0].p_data.fileUrl), /^data:application\/pdf;base64,/);
  });

  test('removing goes through the server; a viewer only sees Remove on their own file and cannot attach', async () => {
    setComponentWorkspace('viewer');
    render(<AttachmentsPanel target={target} />);
    await waitFor(() => assert.equal(screen.getAllByRole('listitem').length, 2));
    assert.equal(screen.queryByLabelText('Attach files to Invoice INV-1'), null);
    assert.equal(screen.queryByRole('button', { name: 'Remove old.pdf' }), null);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove mine.pdf' })); });
    await waitFor(() => assert.equal(screen.getAllByRole('listitem').length, 1));
    const removal = calls.find(c => c.method === 'DELETE')!;
    assert.equal(removal.url, '/api/v1/workspaces/component-workspace/attachments/f2');
  });
});

describe('A new invoice', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ inventory: [], taxRates: [] });
    globalThis.fetch = (async () => new Response('null', { status: 404 })) as typeof fetch;
  });
  afterEach(() => cleanup());

  test('the picked files are handed over on save; nothing claims they were attached before that', async () => {
    const saved: Array<Partial<Invoice> & { attachmentFiles?: File[] }> = [];
    render(<InvoiceModal isOpen onClose={() => {}} onSave={inv => { saved.push(inv); }} customers={[makeCustomer({ id: 'c1', name: 'Acme Ltd' })]}
      accounts={[makeChartAccount({ id: 'rev', name: 'Sales', type: 'income' })]} />);
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Acme Ltd' } });
    fireEvent.change(screen.getByLabelText('Item / Description'), { target: { value: 'Design' } });
    fireEvent.change(screen.getByLabelText(/^Rate/), { target: { value: '100' } });
    const file = new PageFile(['pdf'], 'brief.pdf', { type: 'application/pdf' });
    fireEvent.change(document.getElementById('inv-attachments')!, { target: { files: [file] } });
    assert.ok(screen.getByRole('button', { name: "Don't attach brief.pdf" }));
    assert.match(document.body.textContent || '', /Kept with the invoice when you save it/);
    await act(async () => { fireEvent.click(screen.getByText('Save Draft')); });
    await waitFor(() => assert.equal(saved.length, 1));
    assert.deepEqual(saved[0].attachmentFiles?.map(f => f.name), ['brief.pdf']);
    assert.equal((saved[0].metadata as Record<string, unknown>).hasAttachments, undefined);
  });
});
