import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import IifListExport from '../components/platform/settings/IifListExport';
import { useAuthStore } from '../stores/useAuthStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { readIif } from '../lib/iifImport';

/**
 * E-53 screen: Settings → Backup & Export → QuickBooks Desktop lists (IIF).
 * The file is assembled in the browser, but only from the checksum-verified server backup —
 * a partial browser cache can never become an "export".
 */
const originalFetch = globalThis.fetch;
const auth = useAuthStore.getState();
const savedCreateObjectURL = URL.createObjectURL;
const savedRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  cleanup();
  useAuthStore.setState(auth, true);
  globalThis.fetch = originalFetch;
  URL.createObjectURL = savedCreateObjectURL;
  URL.revokeObjectURL = savedRevokeObjectURL;
});

/** A minimal signed backup exactly the server's shape: checksum over the payload without `checksum`. */
function signedBackup() {
  const source = {
    schemaVersion: 1,
    exportedAt: '2026-10-25T09:00:00.000Z',
    workspace: { id: 'component-workspace', name: 'Demo Ltd' },
    transactions: [],
    accounts: [
      { id: 'a1', uid: 'u', workspaceId: 'component-workspace', code: '1010', name: 'Checking', type: 'asset', category: 'Cash', subtype: 'bank', balanceCents: 100_000_00 },
      { id: 'a2', uid: 'u', workspaceId: 'component-workspace', code: '1020', name: 'Old petty cash', type: 'asset', balanceCents: 0, archived: true },
    ],
    customers: [{ id: 'c1', uid: 'u', workspaceId: 'component-workspace', name: 'Acme Ltd', email: 'acme@example.com' }],
    vendors: [],
    inventory: [{ id: 'i1', uid: 'u', workspaceId: 'component-workspace', name: 'Paper box', sku: 'PAP-1', unitPriceCents: 40_00, unitCostCents: 25_00, quantityAtHand: 999, reorderPoint: 0, createdAt: '2026-01-01' }],
    metadata: { counts: { transactions: 0, accounts: 2, customers: 1, vendors: 0, inventory: 1 }, serverAuthoritative: true },
  };
  return {
    ...source,
    metadata: { ...source.metadata, checksum: createHash('sha256').update(JSON.stringify(source)).digest('hex') },
  };
}

function stubDownload(): { blob: { current: Blob | null } } {
  const blob = { current: null as Blob | null };
  URL.createObjectURL = ((value: Blob) => { blob.current = value; return 'blob:iif-test'; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  return { blob };
}

test('E-53 only a signed-in owner can request the IIF', () => {
  setComponentWorkspace('viewer');
  render(<IifListExport />);
  assert.equal((screen.getByRole('button', { name: 'Download QuickBooks lists (.iif)' }) as HTMLButtonElement).disabled, true);
  cleanup();
  setComponentWorkspace('owner');
  render(<IifListExport />);
  assert.equal((screen.getByRole('button', { name: 'Download QuickBooks lists (.iif)' }) as HTMLButtonElement).disabled, false);
});

test('E-53 a failed server export is named and never replaced by browser cache', async () => {
  setComponentWorkspace('owner');
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('{}', { status: 503 }); }) as typeof fetch;
  render(<IifListExport />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Download QuickBooks lists (.iif)' }));
  });
  await waitFor(() => assert.match(screen.getByRole('alert').textContent || '', /No incomplete IIF was downloaded/));
  assert.equal(calls, 1);
});

test('E-53 the downloaded file holds the verified lists, and what was left out is shown with the reason', async () => {
  setComponentWorkspace('owner');
  globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), '/api/v1/workspaces/component-workspace/export');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-token');
    return new Response(JSON.stringify(signedBackup()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const { blob } = stubDownload();

  render(<IifListExport />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Download QuickBooks lists (.iif)' }));
  });
  await waitFor(() => assert.ok(blob.current, 'the IIF blob was produced'));

  const text = await blob.current!.text();
  assert.match(text, /^!HDR\tPROD\tVER\tREL\tIIF\tEDITION\n/);
  assert.ok(!text.includes('!TRNS'), 'no transaction sections');
  assert.ok(!text.includes('100000'), 'no account balance');
  assert.ok(!text.includes('999'), 'no stock quantity');
  assert.match(text, /ACCNT\tChecking\tBANK\t\t1010\n/);
  assert.ok(!text.includes('Old petty cash'), 'the archived account is not written');
  assert.match(text, /CUST\tAcme Ltd\t\t\tacme@example\.com\t\t\n/);
  assert.match(text, /ITEM\tPaper box\tINVENTORY\t\t\t40\.00\t25\.00\tPAP-1\n/);

  // and the file reads back through the E-29 reader — the round-trip on screen data
  const read = readIif(text);
  assert.deepEqual(read.counts, { accounts: 1, customers: 1, vendors: 0, items: 1 });
  assert.deepEqual(read.skipped, []);
  assert.equal(read.transactionsRefused, 0);

  const leftOut = await screen.findByLabelText('Records left out of the IIF file');
  assert.match(leftOut.textContent || '', /Old petty cash: archived accounts are not exported/);
});

test('E-53 a backup whose checksum does not match is refused, with the reason on screen', async () => {
  setComponentWorkspace('owner');
  const broken = signedBackup() as Record<string, unknown>;
  (broken.accounts as unknown[]).push({ id: 'tampered', workspaceId: 'component-workspace', name: 'Tampered' });
  globalThis.fetch = (async () => new Response(JSON.stringify(broken), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  const { blob } = stubDownload();

  render(<IifListExport />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Download QuickBooks lists (.iif)' }));
  });
  await waitFor(() => assert.match(screen.getByRole('alert').textContent || '', /checksum verification failed/i));
  assert.equal(blob.current, null, 'a tampered payload produces no file');
});
