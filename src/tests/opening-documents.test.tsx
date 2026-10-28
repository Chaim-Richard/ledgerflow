/**
 * Opening invoices and bills (CA-08): the old system's unpaid invoices pasted from a spreadsheet,
 * checked line by line, each added as an open invoice against Opening Balance Equity (not a sale),
 * with its own number and due date so aging is right on day one.
 * EG-14: the dialog now only previews and confirms through POST /api/v1/open-items/{preview,confirm};
 * the server saves the documents and refuses unknown contacts (it no longer adds them).
 * Hand-worked totals (cents): preview with one refused row 125000 (Acme 1,250.00) + 500 (Beta 5.00) = 125500 = $1,255.00;
 * all three good 125000 + 40000 (New Client 400.00) + 500 = 165500 = $1,655.00.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OpeningDocumentsDialog from '../components/common/OpeningDocumentsDialog';
import { openingBalanceDocument, openingRowsCsv, parseOpeningRows } from '../lib/partyOpeningBalance';
import { readOpenItemsCsv } from '../lib/openItemImport';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
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

describe('The pasted lines as the EG-14 file', () => {
  test('the server reader takes the file the dialog builds; lines map back to the paste', () => {
    const { csv, lines } = openingRowsCsv('Customer\tNumber\tDate\tDue\tAmount\n\nAcme Ltd\tINV-0912\t2026-08-14\t2026-09-13\t1,250.00\nNew Client,INV-0920,2026-08-30,400');
    assert.deepEqual(lines, [3, 4]);
    const read = readOpenItemsCsv(csv, { cutOverDate: '2026-09-30', currency: 'USD', contacts: [{ id: 'c1', name: 'Acme Ltd' }] });
    assert.equal(read.fileProblem, null);
    assert.deepEqual(read.rows.map(r => [r.line, r.contactId ?? null, r.number, r.dueDate, r.amountCents, r.openCents, r.problem]), [
      [2, 'c1', 'INV-0912', '2026-09-13', 125000, 125000, null],
      [3, null, 'INV-0920', '2026-08-30', 40000, 40000, '"New Client" is not in your contacts: add it first'],
    ]);
    // hand-worked: only Acme's 1,250.00 counts
    assert.equal(read.openTotalCents, 125000);
  });
});

describe('The dialog on the EG-14 open-item import (preview, then confirm)', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  const PASTE = 'Customer\tNumber\tDate\tDue\tAmount\nAcme Ltd\tINV-0912\t2026-08-14\t2026-09-13\t1,250.00\nNew Client\tINV-0920\t2026-08-30\t400\nBeta Co\tINV-0915\t2026-08-20\t2026-09-19\t5';
  // the file the dialog builds from PASTE (heading line 1 dropped; pasted lines 2, 3, 4 become CSV rows 2, 3, 4)
  const CSV = 'contact,number,date,due date,currency,amount,amount still open\nAcme Ltd,INV-0912,2026-08-14,2026-09-13,,"1,250.00","1,250.00"\nNew Client,INV-0920,2026-08-30,,,400,400\nBeta Co,INV-0915,2026-08-20,2026-09-19,,5,5';
  const row = (line: number, contactName: string, number: string, date: string, dueDate: string, cents: number, problem: string | null = null) =>
    ({ line, number, contactName, date, dueDate, currency: 'USD', amountCents: cents, openCents: cents, problem });

  function stub(answers: Record<string, { status: number; body: unknown }>) {
    const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      sent.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : {} });
      const mode = Object.keys(answers).find(m => url.endsWith(`/api/v1/open-items/${m}`));
      const answer = mode ? answers[mode] : { status: 200, body: /\/rpc\//.test(url) ? null : [] };
      return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    return { sent, calls: (mode: string) => sent.filter(s => s.url.endsWith(`/api/v1/open-items/${mode}`)) };
  }

  test('the server preview is shown row by row; an unknown contact is refused and nothing can be added', async () => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded();
    // hand-worked: Acme 1,250.00 + Beta 5.00 good = 1,255.00 (125000 + 500 = 125500 cents); New Client 400.00 refused, not counted
    const { calls } = stub({ preview: { status: 200, body: { status: 'success', cutOverDate: '2026-09-30', openTotalCents: 125500, created: [], rows: [
      row(2, 'Acme Ltd', 'INV-0912', '2026-08-14', '2026-09-13', 125000),
      row(3, 'New Client', 'INV-0920', '2026-08-30', '2026-08-30', 40000, '"New Client" is not in your contacts: add it first'),
      row(4, 'Beta Co', 'INV-0915', '2026-08-20', '2026-09-19', 500),
    ] } } });
    render(<OpeningDocumentsDialog side="customer" onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Paste the invoices'), { target: { value: PASTE } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })); });
    await waitFor(() => assert.equal(calls('preview').length, 1));
    assert.deepEqual(calls('preview')[0].body, { workspaceId: 'component-workspace', side: 'customer', csv: CSV });
    const table = await screen.findByRole('table');
    assert.match(table.textContent || '', /Preview: 2 to add · \$1,255\.00 · 1 with a problem/);
    assert.match(table.textContent || '', /"New Client" is not in your contacts: add it first/);
    assert.match(table.textContent || '', /\$1,250\.00/);
    // the server refuses the whole file while a row has a problem, so the dialog does not offer to add
    assert.equal((screen.getByRole('button', { name: 'Add 2 opening invoices' }) as HTMLButtonElement).disabled, true);
  });

  test('confirm sends exactly the file that was previewed, and the dialog itself creates nothing', async () => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded();
    // hand-worked: 125000 + 40000 + 500 = 165500 cents = $1,655.00
    const rows = [row(2, 'Acme Ltd', 'INV-0912', '2026-08-14', '2026-09-13', 125000), row(3, 'New Client', 'INV-0920', '2026-08-30', '2026-08-30', 40000), row(4, 'Beta Co', 'INV-0915', '2026-08-20', '2026-09-19', 500)];
    const { sent, calls } = stub({
      preview: { status: 200, body: { status: 'success', cutOverDate: '2026-09-30', openTotalCents: 165500, created: [], rows } },
      confirm: { status: 200, body: { status: 'success', cutOverDate: '2026-09-30', openTotalCents: 165500, created: ['a', 'b', 'c'], rows } },
    });
    let closed = 0;
    render(<OpeningDocumentsDialog side="customer" onClose={() => { closed++; }} />);
    fireEvent.change(screen.getByLabelText('Paste the invoices'), { target: { value: PASTE } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })); });
    assert.match((await screen.findByRole('table')).textContent || '', /Preview: 3 to add · \$1,655\.00/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add 3 opening invoices' })); });
    await waitFor(() => assert.equal(calls('confirm').length, 1));
    // the server has no preview token: the "token" is the previewed file itself, sent again byte for byte
    assert.deepEqual(calls('confirm')[0].body, calls('preview')[0].body);
    assert.equal(calls('confirm')[0].body.csv, CSV);
    await waitFor(() => assert.equal(closed, 1));
    assert.deepEqual(sent.filter(s => /\/documents\/|\/rpc\/lf_set/.test(s.url)), [], 'no invoice or contact is written from the client');
  });

  test('server errors are shown: a file refused at preview, and a row refused at confirm', async () => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded();
    const rows = [row(2, 'Acme Ltd', 'INV-0912', '2026-08-14', '2026-09-13', 125000), row(3, 'New Client', 'INV-0920', '2026-08-30', '2026-08-30', 40000), row(4, 'Beta Co', 'INV-0915', '2026-08-20', '2026-09-19', 500)];
    const answers: Record<string, { status: number; body: unknown }> = { preview: { status: 400, body: { status: 'error', message: 'Record the opening balances first: their date is the cut-over date', rows: [] } } };
    stub(answers);
    let closed = 0;
    render(<OpeningDocumentsDialog side="customer" onClose={() => { closed++; }} />);
    fireEvent.change(screen.getByLabelText('Paste the invoices'), { target: { value: PASTE } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })); });
    assert.equal((await screen.findByRole('alert')).textContent, 'Record the opening balances first: their date is the cut-over date');
    assert.equal(screen.queryByRole('table'), null);

    answers.preview = { status: 200, body: { status: 'success', cutOverDate: '2026-09-30', openTotalCents: 165500, created: [], rows } };
    answers.confirm = { status: 400, body: { status: 'error', message: '1 row has a problem: nothing was imported', rows: [rows[0], { ...rows[1], problem: 'Already in the books for this contact' }, rows[2]] } };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })); });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Add 3 opening invoices' })); });
    await waitFor(() => assert.equal(screen.getByRole('alert').textContent, '1 row has a problem: nothing was imported'));
    // the server's rows replace the preview: hand-worked total stays the server's 165500 until checked again
    assert.match(screen.getByRole('table').textContent || '', /Already in the books for this contact/);
    assert.equal(closed, 0);
  });
});
