/**
 * Opening invoices and bills (CA-08): the old system's unpaid invoices pasted from a spreadsheet,
 * checked line by line, each added as an open invoice against Opening Balance Equity (not a sale),
 * with its own number and due date so aging is right on day one; unknown contacts are added.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OpeningDocumentsDialog from '../components/common/OpeningDocumentsDialog';
import { openingBalanceDocument, parseOpeningRows } from '../lib/partyOpeningBalance';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount, makeCustomer } from './fixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';

describe('Reading the pasted lines', () => {
  test('tabs or commas, headings skipped, the due date optional', () => {
    const rows = parseOpeningRows([
      'Customer\tNumber\tDate\tDue\tAmount',
      'Acme Ltd\tINV-0912\t2026-08-14\t2026-09-13\t1,250.00',
      'Beta Co,INV-0915,2026-08-20,"310.50"',
    ].join('\n'));
    assert.deepEqual(rows.map(r => [r.line, r.partyName, r.number, r.date, r.dueDate, r.amountCents, r.problem]), [
      [2, 'Acme Ltd', 'INV-0912', '2026-08-14', '2026-09-13', 125000, null],
      [3, 'Beta Co', 'INV-0915', '2026-08-20', '2026-08-20', 31050, null],
    ]);
  });

  test('each problem is named on its line', () => {
    const problems = parseOpeningRows([
      'Acme\tA-1\t14/08/2026\t100',
      'Acme\tA-2\t2026-08-14\t2026-08-01\t100',
      'Acme\tA-3\t2026-10-02\t100',
      'Acme\tA-4\t2026-08-14\t0',
      'Acme\tA-5\t2026-08-14\t100',
      'acme\ta-5\t2026-08-15\t100',
      '\tA-6\t2026-08-14\t100',
    ].join('\n'), '2026-09-30').map(r => r.problem);
    assert.deepEqual(problems, [
      'The date must be written YYYY-MM-DD',
      'Due before its own date',
      'Dated after the day the books start (2026-09-30): enter it as a normal invoice or bill',
      'The amount still owed must be above 0',
      null,
      'The same number appears twice for this contact',
      'Who owes it? The first column is the contact',
    ]);
  });

  test('an opening invoice keeps its own number and due date', () => {
    const doc = openingBalanceDocument('customer', { id: 'c1', name: 'Acme' }, { id: 'obe', name: 'Opening Balance Equity' }, 125000, '2026-08-14', 'USD', { number: 'INV-0912', dueDate: '2026-09-13' });
    assert.deepEqual([doc.number, doc.dueDate, doc.status, doc.items?.[0].accountId, doc.metadata?.type], ['INV-0912', '2026-09-13', 'sent', 'obe', 'opening-balance']);
  });
});

describe('The dialog', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('preview, then each line added as an opening invoice; a new customer is added first', async () => {
    setComponentWorkspace('bookkeeper');
    markComponentCollectionsLoaded('customers');
    useLedgerStore.setState({
      customers: [makeCustomer({ id: 'c1', name: 'Acme Ltd' })],
      accounts: [
        makeChartAccount({ id: 'obe', name: 'Opening Balance Equity', type: 'equity', category: 'Equity' }),
        makeChartAccount({ id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' }),
        makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', category: 'Cash' }),
        makeChartAccount({ id: 'sales', name: 'Sales', type: 'income', category: 'Revenue' }),
      ],
      transactions: [],
    });
    const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), body: typeof init?.body === 'string' ? JSON.parse(init.body) : {} });
      const body = String(input).endsWith('/transactions/bulk') ? { status: 'ok' } : /\/rpc\//.test(String(input)) ? null : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<OpeningDocumentsDialog side="customer" onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Paste the invoices'), { target: { value: 'Acme Ltd\tINV-0912\t2026-08-14\t2026-09-13\t1250\nNew Client\tINV-0920\t2026-08-30\t400\nBad line\tX\t30/08/2026\t5' } });
    assert.match(screen.getByRole('table').textContent || '', /Preview: 2 to add · \$1,650\.00/);
    assert.match(screen.getByRole('table').textContent || '', /New Client \(new\)/);
    assert.match(screen.getByRole('table').textContent || '', /The date must be written YYYY-MM-DD/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add 2 opening invoices' })); });
    await waitFor(() => assert.equal(sent.filter(s => s.url.endsWith('/transactions/bulk')).length, 2));
    const invoices = sent.filter(s => s.url.endsWith('/transactions/bulk')).map(s => (s.body.entityMutation as { data: Record<string, unknown> }).data);
    assert.deepEqual(invoices.map(i => [i.number, i.dueDate, i.amountCents, (i.metadata as { type: string }).type]), [['INV-0912', '2026-09-13', 125000, 'opening-balance'], ['INV-0920', '2026-08-30', 40000, 'opening-balance']]);
    const newCustomer = sent.find(s => /\/rpc\/lf_set/.test(s.url) && (s.body as { p_table?: string }).p_table === 'customers');
    assert.equal((newCustomer?.body.p_data as { name: string }).name, 'New Client');
  });
});
