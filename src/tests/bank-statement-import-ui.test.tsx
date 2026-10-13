import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import StatementImporter from '../components/ledger/StatementImporter';
import Banking from '../components/banking/Banking';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';
import { makeTransaction } from './fixtures';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetch } from './helpers/dom';
import { getSupabase } from '../lib/db/client';
import { aiService } from '../services/aiService';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/bank-statements/${name}`, import.meta.url), 'utf8');
const originalParse = aiService.parseStatement;
let aiCalls = 0;
beforeEach(() => {
  setComponentWorkspace();
  stubFetch(200, {});
  useLedgerStore.setState({ accounts: [], transactions: [] });
  useUIStore.setState({ isImporterOpen: false });
  aiCalls = 0;
  aiService.parseStatement = async () => { aiCalls++; throw new Error('Bank formats must not use AI'); };
});
afterEach(async () => { cleanup(); aiService.parseStatement = originalParse; await getSupabase().auth.dispose(); });

const upload = async (name: string, text: string) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  const file = { name, type: 'text/plain', text: async () => text };
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
};

test('Banking opens the existing statement dialog; viewers cannot launch import', () => {
  render(<Banking />);
  fireEvent.click(screen.getByRole('button', { name: 'Import statement' }));
  assert.equal(useUIStore.getState().isImporterOpen, true);
  cleanup();
  setComponentWorkspace('viewer');
  useUIStore.setState({ isImporterOpen: false });
  render(<Banking />);
  const button = screen.getByRole('button', { name: 'Import statement' }) as HTMLButtonElement;
  assert.equal(button.disabled, true);
  fireEvent.click(button);
  assert.equal(useUIStore.getState().isImporterOpen, false);
});

test('QIF requires date order, offers retry, reviews signed amounts and imports only selected entries', async () => {
  let saved: unknown[] = [];
  render(<StatementImporter isOpen onClose={() => {}} onImport={rows => { saved = rows; }} existingTransactions={[]} businessContext="" accounts={[]} patternCache={{}} />);
  assert.match((document.querySelector('input[type=file]') as HTMLInputElement).accept, /\.qif,\.bai,\.bai2/);
  await upload('checking.QIF', fixture('checking-dmy.qif'));
  assert.match(screen.getByRole('alert').textContent || '', /Choose the QIF date order/);
  assert.equal(saved.length, 0);
  fireEvent.change(screen.getByLabelText('QIF date order'), { target: { value: 'dmy' } });
  await upload('checking.QIF', fixture('checking-dmy.qif'));
  assert.ok(screen.queryByRole('alert') === null);
  assert.ok(await screen.findByText('שכירות Office - October rent')); 
  assert.ok(screen.getByText('-$1,250.50'));
  assert.ok(screen.getByText('+$250.10'));
  assert.equal(saved.length, 0, 'parsing is not a posting');
  const selected = screen.getAllByRole('button', { name: /^Select .+ on / });
  fireEvent.click(selected[0]);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import 1 Entries' })); });
  assert.equal(saved.length, 1);
  assert.equal((saved[0] as { amountCents: number }).amountCents, 25010);
  assert.equal((saved[0] as { date: string }).date, '2026-10-06');
  assert.equal(aiCalls, 0);
});

test('BAI2 review preserves existing duplicate fingerprints and keeps duplicates unselected', async () => {
  let saved: unknown[] = [];
  const existing = makeTransaction({ date: '2026-10-05', description: 'Customer payment, Acme תשלום October', totalAmountCents: 25050 });
  render(<StatementImporter isOpen onClose={() => {}} onImport={rows => { saved = rows; }} existingTransactions={[existing]} businessContext="" accounts={[]} patternCache={{}} />);
  await upload('checking.bai2', fixture('checking.bai2'));
  assert.ok(await screen.findByText('Duplicate Detected')); 
  assert.equal(screen.getAllByRole('button', { name: /^Select .+ on / }).filter(b => b.getAttribute('aria-pressed') === 'true').length, 1);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import 1 Entries' })); });
  assert.equal(saved.length, 1);
  assert.equal((saved[0] as { amountCents: number }).amountCents, -5000);
  assert.ok((saved[0] as { importIdentity: string }).importIdentity);
  assert.equal(aiCalls, 0);
});

test('malformed BAI2 and currency mismatch remain in input with visible line errors and no import', async () => {
  let calls = 0;
  render(<StatementImporter isOpen onClose={() => {}} onImport={() => { calls++; }} existingTransactions={[]} businessContext="" accounts={[]} patternCache={{}} />);
  await upload('broken.bai', fixture('checking.bai2').replace('49,255100,6', '49,1,6'));
  assert.match(screen.getByRole('alert').textContent || '', /BAI2 line 8: Account control/);
  assert.ok(screen.queryByRole('button', { name: /Import \d+ Entries/ }) === null);
  const ws = useAuthStore.getState().getCurrentWorkspace()!;
  useAuthStore.setState({ workspaces: [{ ...ws, currency: 'EUR' }] });
  await upload('checking.bai2', fixture('checking.bai2'));
  assert.match(screen.getByRole('alert').textContent || '', /BAI2 line 3: Statement currency USD differs/);
  assert.equal(calls, 0);
  assert.equal(aiCalls, 0);
});

test('a file read started in another workspace cannot fill the new workspace review', async () => {
  render(<StatementImporter isOpen onClose={() => {}} onImport={() => { throw new Error('Must not import'); }} existingTransactions={[]} businessContext="" accounts={[]} patternCache={{}} />);
  let finishRead: (value: string) => void = () => {};
  const read = new Promise<string>(resolve => { finishRead = resolve; });
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [{ name: 'checking.bai2', type: 'text/plain', text: () => read }] } });
    useAuthStore.setState({ currentWorkspaceId: 'another-workspace' });
    finishRead(fixture('checking.bai2'));
  });
  assert.match(screen.getByRole('alert').textContent || '', /Workspace or user changed/);
  assert.ok(screen.queryByRole('button', { name: /Import \d+ Entries/ }) === null);
});

test('QIF refuses zero- and three-decimal workspace currencies before scaling or importing money', async () => {
  let calls = 0;
  render(<StatementImporter isOpen onClose={() => {}} onImport={() => { calls++; }} existingTransactions={[]} businessContext="" accounts={[]} patternCache={{}} />);
  fireEvent.change(screen.getByLabelText('QIF date order'), { target: { value: 'mdy' } });
  const ws = useAuthStore.getState().getCurrentWorkspace()!;
  for (const currency of ['JPY', 'KWD']) {
    useAuthStore.setState({ workspaces: [{ ...ws, currency }] });
    await upload('checking.qif', fixture('checking-mdy.qif'));
    assert.match(screen.getByRole('alert').textContent || '', /two-decimal workspace currencies only/);
    assert.ok(screen.queryByRole('button', { name: /Import \d+ Entries/ }) === null);
  }
  assert.equal(calls, 0);
  assert.equal(aiCalls, 0);
});

test('#110: a refused import keeps the review open with the selection; a stored one closes it', async () => {
  let closed = 0;
  let answer = false;
  const calls: unknown[][] = [];
  render(<StatementImporter isOpen onClose={() => { closed++; }} onImport={async rows => { calls.push(rows); return answer; }} existingTransactions={[]} businessContext="" accounts={[]} patternCache={{}} />);
  fireEvent.change(screen.getByLabelText('QIF date order'), { target: { value: 'dmy' } });
  await upload('checking.QIF', fixture('checking-dmy.qif'));
  await screen.findByText('שכירות Office - October rent');
  fireEvent.click(screen.getAllByRole('button', { name: /^Select .+ on / })[0]);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import 1 Entries' })); });
  assert.equal(calls.length, 1);
  assert.equal(closed, 0, 'the server refused: the dialog must stay open');
  assert.ok(screen.getByRole('button', { name: 'Import 1 Entries' }), 'the selection is kept for a retry');
  answer = true;
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import 1 Entries' })); });
  assert.equal(calls.length, 2);
  assert.equal(closed, 1);
});

test("#101: CSV keeps O'Brien's amount, reads a quoted line break as one row, and never turns a missing amount into $0", async () => {
  const rows: Array<{ description: string; amountCents: number }> = [];
  render(<StatementImporter isOpen onClose={() => {}} onImport={r => { rows.push(...(r as typeof rows)); }} existingTransactions={[]} businessContext="" accounts={[]} patternCache={{}} />);
  await upload('bank.csv', 'Date,Description,Amount\n2026-10-12,O\'Brien Coffee,-12.50\n2026-10-13,"Multi-line memo\nsecond line",10.00\n2026-10-14,No amount,\n');
  await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Process Deterministic Mapping' })); });
  assert.ok(await screen.findByText("O'Brien Coffee"));
  assert.ok(screen.getByText('-$12.50'));
  assert.equal(screen.queryByText('No amount'), null, 'a row without an amount is skipped, not imported as $0');
  assert.equal(screen.queryAllByText('$0.00').length, 0);
});
