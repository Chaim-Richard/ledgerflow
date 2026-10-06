/**
 * Journal entry templates (BD-09 / CA-27): an entry made again and again is saved once under a name
 * and picked to start the next one. A template keeps accounts, sides and (if typed) amounts; it
 * balances or holds no amounts; saving under a used name replaces; only writers save or remove;
 * another workspace's templates are never listed or removable; nothing is posted from a template.
 * The database part runs when LF_TEST_DATABASE_URL is set.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import JournalEntryModal from '../components/ledger/JournalEntryModal';
import { formLines, templateLines, templateProblem, templateSummary, type JournalTemplate } from '../lib/journalTemplates';
import { useLedgerStore } from '../stores/useLedgerStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount } from './fixtures';
import type { Firestore } from '../server/db/pgFirestore';

const realFetch = globalThis.fetch;
const known = new Set(['wages', 'accrued', 'bank']);
const line = (accountId: string, debitCents = 0, creditCents = 0) => ({ accountId, debitCents, creditCents });

describe('What a template may hold', () => {
  test('a name, two lines or more with this workspace\'s accounts, balanced or without amounts', () => {
    assert.equal(templateProblem({ name: 'Payroll accrual', lines: [line('wages', 500000), line('accrued', 0, 500000)] }, known), null);
    assert.equal(templateProblem({ name: 'Payroll accrual', lines: [line('wages'), line('accrued')] }, known), null, 'amounts typed each time');
    assert.match(templateProblem({ name: ' ', lines: [line('wages'), line('accrued')] }, known) || '', /name/);
    assert.match(templateProblem({ name: 'x', lines: [line('wages')] }, known) || '', /at least two lines/);
    assert.match(templateProblem({ name: 'x', lines: [line('wages'), line('elsewhere')] }, known) || '', /Line 2: choose an account of this workspace/);
    assert.match(templateProblem({ name: 'x', lines: [line('wages', 100, 100), line('accrued')] }, known) || '', /not both/);
    assert.match(templateProblem({ name: 'x', lines: [line('wages', -5), line('accrued')] }, known) || '', /zero or more/);
    assert.match(templateProblem({ name: 'x', lines: [line('wages', 500), line('accrued', 0, 400)] }, known) || '', /do not balance/);
    assert.match(templateProblem({ name: 'x'.repeat(61), lines: [line('wages'), line('accrued')] }, known) || '', /60 characters/);
  });

  test('from the form: lines without an account are left out; back to the form: named from today\'s accounts', () => {
    const lines = templateLines([
      { accountId: 'wages', accountName: 'Wages', debit: 500000, credit: 0, dimensions: { project: 'P-1', class: ' ' } },
      { accountId: '', accountName: '', debit: 0, credit: 0 },
      { accountId: 'accrued', accountName: 'Accrued wages', debit: 0, credit: 500000 },
    ]);
    assert.deepEqual(lines, [{ accountId: 'wages', debitCents: 500000, creditCents: 0, dimensions: { project: 'P-1' } }, { accountId: 'accrued', debitCents: 0, creditCents: 500000 }]);
    const back = formLines({ lines: [...lines, line('closed-account', 0, 0)] }, [{ id: 'wages', name: 'Salaries' }, { id: 'accrued', name: 'Accrued wages' }]);
    assert.deepEqual(back.lines.map(l => [l.accountName, l.debit, l.credit, l.dimensions]), [['Salaries', 500000, 0, { project: 'P-1' }], ['Accrued wages', 0, 500000, {}]]);
    assert.equal(back.missing, 1);
    assert.equal(templateSummary({ lines }, c => (c / 100).toFixed(2)), '2 lines · 5000.00');
    assert.equal(templateSummary({ lines: [line('wages'), line('accrued')] }, String), '2 lines · amounts typed each time');
  });
});

describe('In the journal entry form', () => {
  const wages = makeChartAccount({ id: 'wages', code: '6100', name: 'Wages', type: 'expense' });
  const accrued = makeChartAccount({ id: 'accrued', code: '2150', name: 'Accrued wages', type: 'liability' });
  const saved: JournalTemplate = {
    id: 'jt_1', workspaceId: 'component-workspace', kind: 'journalTemplate', name: 'Payroll accrual', description: 'Month-end payroll accrual', adjusting: true,
    lines: [line('wages', 500000), line('accrued', 0, 500000)], createdBy: 'test-user', createdAt: '2026-10-01', updatedAt: '2026-10-01',
  };
  let calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const stub = () => {
    calls = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      calls.push({ url, method, body: JSON.parse(String(init?.body || '{}')) });
      if (url.includes('/journal-templates') && method === 'GET') return new Response(JSON.stringify({ status: 'success', data: { templates: [saved] } }), { status: 200 });
      if (url.includes('/journal-templates') && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ status: 'success', data: { template: { ...saved, ...body, id: 'jt_2' }, replaced: false } }), { status: 200 });
      }
      return new Response('{"status":"success"}', { status: 200 });
    }) as typeof fetch;
  };
  afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

  test('picking a template fills the lines, the description and the adjusting mark; nothing is posted', async () => {
    setComponentWorkspace('bookkeeper');
    useLedgerStore.setState({ baseCurrency: 'USD', transactions: [], lockDate: null, accounts: [wages, accrued] });
    stub();
    render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user' } as never} accounts={[wages, accrued]} workspaceId="component-workspace" />);
    const select = await screen.findByLabelText('Start from a template');
    fireEvent.change(select, { target: { value: 'jt_1' } });
    assert.equal((screen.getByLabelText('Description') as HTMLInputElement).value, 'Month-end payroll accrual');
    assert.equal((screen.getByLabelText('Account for line 1') as HTMLInputElement).value, '6100 - Wages');
    assert.equal((screen.getByLabelText('Debit amount for line 1') as HTMLInputElement).value, '5000');
    assert.equal((screen.getByLabelText('Credit amount for line 2') as HTMLInputElement).value, '5000');
    assert.equal((screen.getByLabelText('Adjusting entry') as HTMLInputElement).checked, true);
    assert.ok(screen.getByText(/2 lines · \$5,000\.00/));
    assert.equal(calls.filter(c => c.url.includes('/transactions')).length, 0);
  });

  test('"Save as template" sends the lines typed, under the name given', async () => {
    setComponentWorkspace('accountant');
    useLedgerStore.setState({ baseCurrency: 'USD', transactions: [], lockDate: null, accounts: [wages, accrued] });
    stub();
    render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user' } as never} accounts={[wages, accrued]} workspaceId="component-workspace" />);
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Rent accrual' } });
    fireEvent.change(screen.getByLabelText('Account for line 1'), { target: { value: 'wages' } });
    fireEvent.change(screen.getByLabelText('Account for line 2'), { target: { value: 'accrued' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as template' }));
    assert.equal((screen.getByLabelText('Template name') as HTMLInputElement).value, 'Rent accrual', 'named after the description');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save template' })); });
    await waitFor(() => assert.ok(calls.some(c => c.method === 'POST')));
    const post = calls.find(c => c.method === 'POST')!;
    assert.equal(post.url, '/api/v1/workspaces/component-workspace/journal-templates');
    assert.deepEqual(post.body, { name: 'Rent accrual', description: 'Rent accrual', adjusting: false, lines: [line('wages'), line('accrued')] });
    await waitFor(() => assert.equal((screen.getByLabelText('Start from a template') as HTMLSelectElement).value, 'jt_2'));
  });

  test('a viewer can use templates but not save them', async () => {
    setComponentWorkspace('viewer');
    useLedgerStore.setState({ baseCurrency: 'USD', transactions: [], lockDate: null, accounts: [wages, accrued] });
    stub();
    render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user' } as never} accounts={[wages, accrued]} workspaceId="component-workspace" />);
    await screen.findByLabelText('Start from a template');
    assert.equal(screen.queryByRole('button', { name: 'Save as template' }), null);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Templates through the server (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_jt_${crypto.randomBytes(4).toString('hex')}`;
  const other = `${ws}x`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const call = async (uid: string, method: string, path = '', body?: unknown, workspace = ws) => {
    const res = await realFetch(`${base}/api/v1/workspaces/${workspace}/journal-templates${path}`, {
      method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json() as { message?: string; data?: { templates?: JournalTemplate[]; template?: JournalTemplate; replaced?: boolean } } };
  };
  const payroll = () => ({ name: 'Payroll accrual', description: 'Month-end payroll', adjusting: true, lines: [line(id('wages'), 500000), line(id('accrued'), 0, 500000)] });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'JT', currency: 'USD', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    await db.collection('workspaces').doc(other).set({ uid: 'owner-2', name: 'Other', currency: 'USD', members: ['owner-2'] });
    for (const a of ['wages', 'accrued']) await db.collection('chartAccounts').doc(id(a)).set({ workspaceId: ws, name: a, code: a === 'wages' ? '6100' : '2150', type: a === 'wages' ? 'expense' : 'liability' });
    await db.collection('chartAccounts').doc(`${other}_wages`).set({ workspaceId: other, name: 'wages', code: '6100', type: 'expense' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['documents', 'chartAccounts', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, other]]);
    await db.terminate();
  });

  test('a writer saves; saving under the same name (any case) replaces; members read them', async () => {
    assert.equal((await call('view-1', 'POST', '', payroll())).status, 403, 'viewers do not save');
    const first = await call('book-1', 'POST', '', payroll());
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.data?.replaced, false);
    const again = await call('owner-1', 'POST', '', { ...payroll(), name: 'PAYROLL ACCRUAL ', lines: [line(id('wages')), line(id('accrued'))] });
    assert.equal(again.body.data?.replaced, true);
    assert.equal(again.body.data?.template?.id, first.body.data?.template?.id);
    await call('book-1', 'POST', '', { name: 'Depreciation', lines: [line(id('wages'), 100), line(id('accrued'), 0, 100)] });
    const list = await call('view-1', 'GET');
    assert.deepEqual(list.body.data?.templates?.map(t => [t.name, t.lines.length, t.lines[0].debitCents]), [['Depreciation', 2, 100], ['PAYROLL ACCRUAL', 2, 0]]);
    const stored = (await db.collection('documents').doc(first.body.data!.template!.id).get()).data() || {};
    assert.equal(stored.uid, undefined, 'no uid: never shown in anyone\'s Vault');
    assert.equal(stored.createdBy, 'book-1');
    const nothingPosted = await db.collection('transactions').where('workspaceId', '==', ws).get();
    assert.equal(nothingPosted.size, 0);
  });

  test('refused: unbalanced, another workspace\'s account, unknown fields', async () => {
    const unbalanced = await call('owner-1', 'POST', '', { name: 'Off', lines: [line(id('wages'), 500), line(id('accrued'), 0, 400)] });
    assert.deepEqual([unbalanced.status, unbalanced.body.message], [400, 'The amounts do not balance: leave them all empty, or make debits equal credits']);
    const foreign = await call('owner-1', 'POST', '', { name: 'Theirs', lines: [line(`${other}_wages`), line(id('accrued'))] });
    assert.deepEqual([foreign.status, foreign.body.message], [400, 'Line 1: choose an account of this workspace']);
    assert.equal((await call('owner-1', 'POST', '', { ...payroll(), postNow: true })).status, 400);
  });

  test('removing: writers only, this workspace only, kept in the audit trail', async () => {
    const theirs = await call('owner-2', 'POST', '', { name: 'Theirs', lines: [line(`${other}_wages`), line(`${other}_wages`)] }, other);
    assert.equal(theirs.status, 200, JSON.stringify(theirs.body));
    assert.equal((await call('owner-1', 'GET')).body.data?.templates?.some(t => t.name === 'Theirs'), false, 'another workspace\'s templates are not listed');
    assert.equal((await call('owner-1', 'DELETE', `/${theirs.body.data!.template!.id}`)).status, 404, 'nor removable from here');
    const mine = (await call('owner-1', 'GET')).body.data!.templates!.find(t => t.name === 'Depreciation')!;
    assert.equal((await call('view-1', 'DELETE', `/${mine.id}`)).status, 403);
    assert.equal((await call('book-1', 'DELETE', `/${mine.id}`)).status, 200);
    assert.deepEqual((await call('owner-1', 'GET')).body.data?.templates?.map(t => t.name), ['PAYROLL ACCRUAL']);
    const audit = (await db.collection('auditLogs').where('workspaceId', '==', ws).get()).docs.map(d => d.data());
    assert.deepEqual(audit.map(a => a.action).sort(), ['journalTemplate.removed', 'journalTemplate.replaced', 'journalTemplate.saved', 'journalTemplate.saved']);
    assert.ok(audit.some(a => (a.details as { description?: string }).description === 'Removed the journal template "Depreciation"'));
  });
});
