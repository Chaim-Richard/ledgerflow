/**
 * Split rules (Q-05): a saved rule splits a cost by percentages, each share with its own account or
 * labels; the shares add up to exactly 100% and the amounts to exactly the cost (the remainder on the
 * last share). A rule is suggested on a bill with why, and applying it only changes the lines on
 * screen. Owners and accountants keep the rules on the server. The database part runs with
 * LF_TEST_DATABASE_URL.
 */
import './helpers/dom';
import test, { after, afterEach, before, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { allocationRulesProblem, applyRule, ruleMatch, splitByRule, suggestRule, type AllocationRule } from '../lib/allocationRules';
import BillModal, { type BillDraft } from '../components/purchases/BillModal';
import AllocationRulesSettings from '../components/platform/settings/AllocationRulesSettings';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { stubFetch, stubFetchWithBodies } from './helpers/dom';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';
import type { Workspace } from '../types';
import { makeChartAccount, makeVendor } from './fixtures';

const rent: AllocationRule = {
  id: 'ar_aaaaaaaa', name: 'Rent split', match: 'Landlord',
  shares: [{ percent: 60, labels: { property: 'P5' } }, { percent: 40, labels: { property: 'P6' } }],
};

describe('The rules', () => {
  test('shares add up to 100%, two decimals; a name and a text to match', () => {
    assert.equal(allocationRulesProblem([rent]), null);
    assert.equal(allocationRulesProblem([{ ...rent, id: undefined, shares: [{ percent: 33.33 }, { percent: 33.33 }, { percent: 33.34 }] }]), null);
    assert.match(String(allocationRulesProblem([{ ...rent, shares: [{ percent: 60 }, { percent: 30 }] }])), /add up to 90%/);
    assert.match(String(allocationRulesProblem([{ ...rent, shares: [{ percent: 60.555 }, { percent: 39.445 }] }])), /two decimals/);
    assert.match(String(allocationRulesProblem([{ ...rent, shares: [{ percent: 100 }] }])), /2 to 20 shares/);
    assert.match(String(allocationRulesProblem([{ ...rent, match: 'x' }])), /contains/);
    assert.match(String(allocationRulesProblem([rent, { ...rent, id: 'ar_bbbbbbbb', name: 'rent SPLIT' }])), /twice/);
    assert.match(String(allocationRulesProblem([{ ...rent, id: 'bad' }])), /id/);
    assert.match(String(allocationRulesProblem('x')), /list/);
  });

  test('suggested with why, by vendor or description; whole cents with the remainder on the last share', () => {
    assert.equal(ruleMatch(rent, { vendorName: 'Big landlord Ltd' }), "rule 'Rent split' matched: vendor contains 'Landlord'");
    assert.equal(ruleMatch(rent, { description: 'October LANDLORD' }), "rule 'Rent split' matched: description contains 'Landlord'");
    assert.equal(suggestRule([rent], { vendorName: 'Paper Co' }), null);
    assert.deepEqual(splitByRule(rent, 1001), [600, 401]);
    assert.deepEqual(splitByRule({ shares: [{ percent: 33.33 }, { percent: 33.33 }, { percent: 33.34 }] }, 100), [33, 33, 34]);
    assert.deepEqual(splitByRule(rent, -1001), [-600, -401], 'a credit splits the same way');
    let n = 0;
    const lines = applyRule({ shares: [{ percent: 60, labels: { property: 'P5' } }, { percent: 40, accountId: 'other', labels: { property: 'P6' } }] },
      [{ id: 'x', amountCents: 1000, accountId: 'rent', description: 'Rent', dimensions: { dept: 'D1' } }], () => `n${++n}`);
    assert.deepEqual(lines, [
      { id: 'n1', amountCents: 600, accountId: 'rent', description: 'Rent', dimensions: { dept: 'D1', property: 'P5' } },
      { id: 'n2', amountCents: 400, accountId: 'other', description: 'Rent', dimensions: { dept: 'D1', property: 'P6' } },
    ]);
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_split_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const put = async (uid: string, rules: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/allocation-rules`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify({ rules }) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Split', members: ['owner-1', 'acct-1', 'book-1'], roles: { 'acct-1': 'accountant', 'book-1': 'bookkeeper' } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'x@example.test' }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('owners and accountants keep the rules; new ones get ids, known ids stay; a bookkeeper and a bad rule are refused', async () => {
    const { id: _id, ...fresh } = rent;
    assert.equal((await put('book-1', [fresh])).status, 403);
    assert.equal((await put('owner-1', [{ ...fresh, shares: [{ percent: 50 }, { percent: 40 }] }])).status, 400);
    const saved = await put('owner-1', [fresh]);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const id = (saved.body.rules as AllocationRule[])[0].id;
    assert.match(id, /^ar_[0-9a-f]{12}$/);
    const again = await put('acct-1', [{ ...fresh, id, name: 'Rent 60/40' }, { ...fresh, id: 'ar_zzzzzzzz', name: 'Other', match: 'Water board' }]);
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const rules = (await db.collection('workspaces').doc(ws).get()).data()?.allocationRules as AllocationRule[];
    assert.equal(rules[0].id, id, 'its id is kept');
    assert.notEqual(rules[1].id, 'ar_zzzzzzzz', 'an id that is not this workspace\'s gets a new one');
    const audit = await db.pool.query(`select count(*)::int as n from public."auditLogs" where workspace_id = $1 and data->>'action' = 'ALLOCATION_RULES_SET'`, [ws]);
    assert.equal(audit.rows[0].n, 2);
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  describe('a bill', () => {
    beforeEach(() => {
      stubFetch(404);
      useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD', allocationRules: [rent] } as Workspace] });
      useLedgerStore.setState({ bills: [], transactions: [], taxRates: [] });
    });

    test('the rule is suggested with why, and applying it splits the line, labelled, in whole cents', async () => {
      const saved: BillDraft[] = [];
      render(<BillModal isOpen onClose={() => {}} onSave={b => { saved.push(b); }} vendors={[makeVendor({ id: 'v1', name: 'Landlord Ltd' })]} accounts={[makeChartAccount({ id: 'exp', name: 'Rent', type: 'expense' })]} />);
      fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'October rent' } });
      fireEvent.change(screen.getByLabelText('Expense Account'), { target: { value: 'exp' } });
      fireEvent.change(screen.getByLabelText(/^Amount \(/), { target: { value: '1000.01' } });
      assert.match(screen.getByText(/Split rule suggested/).textContent || '', /vendor contains 'Landlord'.*60% \/ 40%/);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply Rent split' })); });
      assert.equal(screen.queryByText(/Split rule suggested/), null, 'applied once');
      await act(async () => { fireEvent.click(screen.getByText('Save & Close')); });
      await waitFor(() => assert.equal(saved.length, 1));
      assert.deepEqual(saved[0].splits?.map(s => [s.amountCents, s.accountId, s.dimensions]), [[60000, 'exp', { property: 'P5' }], [40001, 'exp', { property: 'P6' }]]);
    });
  });

  test('Settings → Split rules: an owner makes a rule; the problem is said until the shares add up', async () => {
    const ws = setComponentWorkspace('owner');
    useAuthStore.setState({ workspaces: [{ ...ws, allocationRules: [], dimensions: [{ id: 'property', name: 'Property' }] }] });
    useLedgerStore.setState({ accounts: [makeChartAccount({ id: 'exp', name: 'Rent', type: 'expense' })], dimensionNodes: [{ id: 'P5', dimensionId: 'property', description: 'Property 5' }] });
    const calls = stubFetchWithBodies(200, { status: 'success', rules: [{ ...rent, shares: [{ percent: 60 }, { percent: 40 }] }] });
    render(<AllocationRulesSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'New split rule' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rent split' } });
    fireEvent.change(screen.getByLabelText('Vendor or description contains'), { target: { value: 'Landlord' } });
    fireEvent.change(screen.getByLabelText('Share 1 percentage'), { target: { value: '60' } });
    assert.match(screen.getByRole('status').textContent || '', /add up to 110%/);
    fireEvent.change(screen.getByLabelText('Share 2 percentage'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Share 1 Property'), { target: { value: 'P5' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save rule' })); });
    const put = calls.find(c => c.method === 'PUT')!;
    assert.equal(put.url, '/api/v1/workspaces/component-workspace/allocation-rules');
    assert.deepEqual(put.body, { rules: [{ name: 'Rent split', match: 'Landlord', shares: [{ percent: 60, labels: { property: 'P5' } }, { percent: 40 }] }] });
    await waitFor(() => assert.ok(screen.getByText('Rent split', { selector: 'bdi' })));
  });

  test('a bookkeeper sees the rules but cannot change them', () => {
    const ws = setComponentWorkspace('bookkeeper');
    useAuthStore.setState({ workspaces: [{ ...ws, allocationRules: [rent] }] });
    render(<AllocationRulesSettings />);
    assert.ok(screen.getByText('Owners and accountants keep the split rules.'));
    assert.equal(screen.queryByRole('button', { name: /Change|New split rule/ }), null);
  });
});
