/**
 * The general journal (K-05): entries typed in by hand (or all), newest first, searchable; each opens
 * to its lines; a manual entry can be reversed on a chosen day with a reason, or duplicated into the
 * journal form with the same lines. Reversals and reversed entries can't be reversed again; viewers
 * only read.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import JournalView, { type JournalListEntry } from '../components/ledger/JournalView';
import JournalEntryModal from '../components/ledger/JournalEntryModal';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount } from './fixtures';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const entry = (id: string, date: string, description: string, over: Partial<JournalListEntry> = {}): JournalListEntry => ({
  id, uid: 'u', workspaceId: 'w', date, description, createdAt: '', kind: 'journal',
  lines: [{ accountId: 'rent', accountName: 'Rent', debit: 50000, credit: 0 }, { accountId: 'bank', accountName: 'Checking', debit: 0, credit: 50000 }],
  ...over,
});
const entries = [
  entry('a', '2026-09-30', 'September accrual', { autoReverseOn: '2026-10-01' }),
  entry('b', '2026-10-02', 'Fix a typo'),
  entry('c', '2026-10-01', 'Reversal of: September accrual', { isReversal: true }),
  entry('d', '2026-08-01', 'Old mistake', { reversedBy: 'x' }),
  entry('inv', '2026-10-03', 'Invoice INV-1', { kind: 'actual' }),
];

describe('The journal list', () => {
  afterEach(() => cleanup());

  test('hand-typed entries newest first; all of them on request; search', () => {
    render(<JournalView journalEntries={entries} formatCurrency={money} canEdit />);
    const rows = () => screen.getAllByRole('listitem').map(li => li.textContent || '');
    assert.equal(rows().length, 4);
    assert.match(rows()[0], /2026-10-02Fix a typo/);
    assert.match(screen.getByText(/entries ·/).textContent || '', /4 entries · \$2000\.00 in debits/);
    fireEvent.click(screen.getByLabelText('Entries typed in by hand only'));
    assert.equal(rows().length, 5);
    assert.match(rows()[0], /Invoice INV-1/);
    fireEvent.change(screen.getByLabelText('Search the journal'), { target: { value: 'accrual' } });
    assert.equal(rows().length, 2);
  });

  test('an entry opens to its lines; badges say how it relates to reversals', () => {
    render(<JournalView journalEntries={entries} formatCurrency={money} canEdit />);
    assert.match(document.body.textContent || '', /September accrualreverses on 2026-10-01/);
    assert.match(document.body.textContent || '', /Reversal of: September accruala reversal/);
    assert.match(document.body.textContent || '', /Old mistakereversed/);
    fireEvent.click(screen.getByRole('button', { name: 'Show the lines of Fix a typo on 2026-10-02' }));
    const table = screen.getByRole('table', { name: 'Lines of Fix a typo' });
    assert.match(table.textContent || '', /Rent\$500\.00Checking\$500\.00/);
  });

  test('reverse on a chosen day with a reason; reversals and reversed entries offer no Reverse', async () => {
    const reversed: Array<[string, string, string]> = [];
    render(<JournalView journalEntries={entries} formatCurrency={money} canEdit onReverse={(e, date, reason) => { reversed.push([e.id, date, reason]); }} onDuplicate={() => {}} />);
    assert.equal(screen.queryByRole('button', { name: 'Reverse Reversal of: September accrual of 2026-10-01' }), null);
    assert.equal(screen.queryByRole('button', { name: 'Reverse Old mistake of 2026-08-01' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Reverse Fix a typo of 2026-10-02' }));
    const go = screen.getByRole('button', { name: 'Reverse it' }) as HTMLButtonElement;
    assert.equal(go.disabled, true, 'a reason is needed');
    fireEvent.change(screen.getByLabelText('Reverse on'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: 'Entered twice' } });
    await act(async () => { fireEvent.click(go); });
    assert.deepEqual(reversed, [['b', '2026-10-05', 'Entered twice']]);
  });

  test('duplicate hands over the entry; a viewer gets no actions', () => {
    const copies: string[] = [];
    const { unmount } = render(<JournalView journalEntries={entries} formatCurrency={money} canEdit onReverse={() => {}} onDuplicate={e => copies.push(e.id)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Fix a typo of 2026-10-02' }));
    assert.deepEqual(copies, ['b']);
    unmount();
    render(<JournalView journalEntries={entries} formatCurrency={money} canEdit={false} onReverse={() => {}} onDuplicate={() => {}} />);
    assert.equal(screen.queryByRole('button', { name: /^(Reverse|Duplicate) / }), null);
  });
});

describe('Duplicating into the journal form', () => {
  afterEach(() => cleanup());

  test('the form starts with the entry\'s description and lines', () => {
    const accounts = [makeChartAccount({ id: 'rent', code: '6000', name: 'Rent', type: 'expense' }), makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' })];
    useLedgerStore.setState({ baseCurrency: 'USD', transactions: [], lockDate: null, accounts });
    render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user' } as never} accounts={accounts} workspaceId="w"
      initialEntry={{ description: 'Fix a typo', lines: entries[1].lines }} />);
    assert.equal((screen.getByLabelText('Description') as HTMLInputElement).value, 'Fix a typo');
    assert.match((screen.getByLabelText('Account for line 1') as HTMLInputElement).value, /Rent/);
    assert.equal((screen.getByLabelText('Debit amount for line 1') as HTMLInputElement).value, '500');
    assert.match((screen.getByLabelText('Account for line 2') as HTMLInputElement).value, /Checking/);
    assert.equal((screen.getByLabelText('Credit amount for line 2') as HTMLInputElement).value, '500');
  });
});

describe('Adjusting entries (BD-03)', () => {
  afterEach(() => cleanup());

  test('marked in the list, and listed alone on request', () => {
    const withAdjusting = [...entries, entry('adj', '2026-12-31', 'Year-end accrual', { adjusting: true })];
    render(<JournalView journalEntries={withAdjusting} formatCurrency={money} canEdit />);
    assert.match(document.body.textContent || '', /Year-end accrualadjusting/);
    fireEvent.click(screen.getByLabelText('Adjusting entries only'));
    assert.deepEqual(screen.getAllByRole('listitem').map(li => li.textContent?.includes('Year-end accrual')), [true]);
  });

  test('the journal form saves the mark with the entry; a duplicate keeps it', async () => {
    const accounts = [makeChartAccount({ id: 'rent', code: '6000', name: 'Rent', type: 'expense' }), makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' })];
    useLedgerStore.setState({ baseCurrency: 'USD', transactions: [], lockDate: null, accounts });
    const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), body: JSON.parse(String(init?.body || '{}')) });
      return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user', getIdToken: async () => 't' } as never} accounts={accounts} workspaceId="w"
      initialEntry={{ description: 'Year-end accrual', lines: entries[1].lines, adjusting: true }} />);
    assert.equal((screen.getByLabelText('Adjusting entry') as HTMLInputElement).checked, true);
    await act(async () => { fireEvent.submit(screen.getByLabelText('Description').closest('form')!); });
    await waitFor(() => assert.ok(sent.some(s => s.url === '/api/v1/transactions')));
    const tx = sent.find(s => s.url === '/api/v1/transactions')!.body.transaction as { metadata?: Record<string, unknown>; type: string };
    assert.deepEqual([tx.type, tx.metadata], ['journal', { adjusting: true }]);
  });
});
