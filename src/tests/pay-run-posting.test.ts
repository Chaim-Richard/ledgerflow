/**
 * Pay runs posted by the server (U-02): the entry always balances, deductions included (it did not
 * before); only owners and accountants post; the four accounts must be real and of the right kind;
 * the run is saved with its amounts (before, nothing was saved); a second run on the same date
 * needs saying so; undo voids the entry while the date is open. The database part runs when
 * LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { payRunLines, payRunTotals, yearToDate } from '../lib/payRunPosting';
import { generatePayslipPdf, layoutPayslip } from '../server/services/payslipPdf';
import { pdfTextRuns } from './helpers/pdfText';
import type { Employee } from '../types';

const employee = (id: string, salaryCents: number, extra: Partial<Employee> = {}): Employee => ({
  id, uid: 'u', workspaceId: 'w', name: id, role: 'Staff', salaryCents, payFrequency: 'Monthly', status: 'Active', filingStatus: 'Single', state: 'TX', createdAt: '2026-01-01', ...extra,
} as Employee);
const accounts = { bank: { id: 'bank', name: 'Checking' }, wages: { id: 'wages', name: 'Wages' }, taxExpense: { id: 'ptax', name: 'Payroll tax' }, liabilities: { id: 'liab', name: 'Payroll liabilities' } };

describe('Pay run entry', () => {
  test('balances, with a 401k deduction too; terminated employees are not paid', () => {
    const totals = payRunTotals([employee('ann', 6_000_000), employee('bo', 4_800_000, { preTaxDeductionsCents: 20_000 }), employee('cy', 3_000_000, { status: 'Terminated' })], 2026);
    assert.equal(totals.employees.length, 2);
    assert.equal(totals.grossCents, 500_000 + 400_000);
    assert.equal(totals.deductionsCents, 20_000);
    assert.equal(totals.netCents, totals.grossCents - totals.deductionsCents - totals.withheldCents);
    const lines = payRunLines(totals, accounts);
    assert.equal(lines.reduce((s, l) => s + l.amountCents, 0), 0);
    const by = Object.fromEntries(lines.map(l => [l.accountId, l.amountCents]));
    assert.deepEqual(by, {
      wages: 900_000, ptax: totals.employerTaxCents, bank: -totals.netCents,
      liab: -(totals.withheldCents + totals.employerTaxCents + 20_000),
    });
  });
});

describe('Year to date (U-03)', () => {
  test('this year\'s posted runs per employee; undone runs, other years and old runs without amounts left out', () => {
    const line = (employeeId: string, grossCents: number) => ({ employeeId, name: employeeId, grossCents, deductionsCents: 0, withheldCents: grossCents / 10, employerTaxCents: 0, netCents: grossCents * 0.9 });
    const ytd = yearToDate([
      { date: '2026-01-31', status: 'processed', employees: [line('ann', 500_000), line('bo', 400_000)] },
      { date: '2026-02-28', status: 'processed', employees: [line('ann', 500_000)] },
      { date: '2026-03-31', status: 'undone', employees: [line('ann', 500_000)] },
      { date: '2025-12-31', status: 'processed', employees: [line('ann', 500_000)] },
      { date: '2026-04-30', status: 'processed' },
    ], '2026');
    assert.deepEqual(ytd.get('ann'), { grossCents: 1_000_000, deductionsCents: 0, withheldCents: 100_000, employerTaxCents: 0, netCents: 900_000, runs: 2 });
    assert.equal(ytd.get('bo')?.runs, 1);
  });
});

describe('Payslip (U-01)', () => {
  const line = { employeeId: 'ann', name: 'Ann Lee', grossCents: 500_000, deductionsCents: 20_000, withheldCents: 90_000, employerTaxCents: 40_000, netCents: 390_000,
    taxes: { federalCents: 50_000, stateCents: 0, localCents: 0, socialSecurityCents: 31_000, medicareCents: 9_000 } };
  test('gross, deductions, each tax withheld (none at zero), net, and the year to date up to this run', () => {
    const runs = [{ date: '2026-09-30', status: 'processed', employees: [line] }, { date: '2026-10-31', status: 'processed', employees: [line] }, { date: '2026-11-30', status: 'processed', employees: [line] }];
    const layout = layoutPayslip({ date: '2026-10-31' }, line, runs, { name: 'Acme Ltd', currency: 'usd' });
    assert.deepEqual(layout.rows.map(r => [r.label, r.amount]), [
      ['Gross pay', '5,000.00 USD'], ['Pre-tax deductions (retirement, health)', '−200.00 USD'], ['Federal income tax', '−500.00 USD'],
      ['Social Security', '−310.00 USD'], ['Medicare', '−90.00 USD'], ['Net pay', '3,900.00 USD'],
    ]);
    assert.deepEqual(layout.ytd[0], { label: 'Gross pay in 2026', amount: '10,000.00 USD' }, 'September and October, not November');
  });

  test('the PDF says it', async () => {
    const layout = layoutPayslip({ date: '2026-10-31' }, line, [{ date: '2026-10-31', status: 'processed', employees: [line] }], { name: 'Acme Ltd', currency: 'USD' });
    const text = pdfTextRuns(await generatePayslipPdf(layout)).join(' ');
    for (const word of ['Payslip', 'Ann', 'Lee', '2026-10-31', '3,900.00', 'Medicare']) assert.ok(text.includes(word), word);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Pay runs (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_payrun_${crypto.randomBytes(4).toString('hex')}`;
  const id = (n: string) => `${ws}_${n}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const body = () => ({ date: '2026-10-01', bankAccountId: id('bank'), wagesAccountId: id('wages'), taxExpenseAccountId: id('ptax'), liabilitiesAccountId: id('liab') });
  const call = async (uid: string, method: string, path = '', data?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/pay-runs${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Payroll Co', currency: 'USD', members: ['owner-1', 'acct-1', 'book-1'], roles: { 'acct-1': 'accountant', 'book-1': 'bookkeeper' } });
    const acc = (n: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(n)).set({ workspaceId: ws, uid: 'owner-1', balanceCents: 0, isActive: true, ...fields });
    await acc('bank', { code: '1000', name: 'Checking', type: 'asset', category: 'Cash' });
    await acc('wages', { code: '6000', name: 'Wages', type: 'expense' });
    await acc('ptax', { code: '6010', name: 'Payroll tax', type: 'expense' });
    await acc('liab', { code: '2100', name: 'Payroll liabilities', type: 'liability' });
    await db.collection('employees').doc(id('ann')).set({ ...employee('Ann', 6_000_000), id: undefined, workspaceId: ws });
    await db.collection('employees').doc(id('bo')).set({ ...employee('Bo', 4_800_000, { preTaxDeductionsCents: 20_000 }), id: undefined, workspaceId: ws });
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'payRuns', 'employees', 'chartAccounts', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('refused: a bookkeeper, a wrong kind of account', async () => {
    assert.equal((await call('book-1', 'POST', '', body())).status, 403);
    const wrong = await call('acct-1', 'POST', '', { ...body(), bankAccountId: id('wages') });
    assert.equal(wrong.status, 400);
    assert.match(String(wrong.body.message), /bank account/);
  });

  let runId = '';
  test('an accountant posts: one balanced entry on the pay date, and the run is saved with its amounts', async () => {
    const res = await call('acct-1', 'POST', '', body());
    assert.equal(res.status, 200);
    runId = String(res.body.payRunId);
    const run = (await db.collection('payRuns').doc(runId).get()).data()!;
    assert.deepEqual([run.status, run.date, run.employeeCount, run.grossCents, run.deductionsCents], ['processed', '2026-10-01', 2, 900_000, 20_000]);
    const entry = (await db.collection('transactions').doc(String(run.transactionId)).get()).data()!;
    assert.equal(entry.date, '2026-10-01');
    assert.equal((entry.lines as Array<{ amountCents: number }>).reduce((s, l) => s + l.amountCents, 0), 0);
    assert.equal(entry.totalAmountCents, run.totalAmountCents);
  });

  test('a payslip for an employee of the run comes back as a PDF; one for someone not in it does not', async () => {
    const run = (await db.collection('payRuns').doc(runId).get()).data()!;
    const employeeId = (run.employees as Array<{ employeeId: string }>)[0].employeeId;
    const pdf = await fetch(`${base}/api/v1/workspaces/${ws}/pay-runs/${runId}/payslips/${employeeId}`, { headers: { 'x-test-uid': 'owner-1' } });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal((await pdf.arrayBuffer()).byteLength > 1000, true);
    assert.equal((await fetch(`${base}/api/v1/workspaces/${ws}/pay-runs/${runId}/payslips/nobody`, { headers: { 'x-test-uid': 'owner-1' } })).status, 404);
    assert.equal((await fetch(`${base}/api/v1/workspaces/${ws}/pay-runs/${runId}/payslips/${employeeId}`, { headers: { 'x-test-uid': 'book-1' } })).status, 403);
  });

  test('a second run on the same date needs saying so; undo voids the entry but not in a closed period', async () => {
    assert.equal((await call('acct-1', 'POST', '', body())).status, 409);
    assert.equal((await call('acct-1', 'POST', '', { ...body(), again: true })).status, 200);
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-10-31' });
    assert.equal((await call('acct-1', 'DELETE', `/${runId}`)).status, 409);
    await db.collection('workspaces').doc(ws).update({ lockDate: null });
    assert.equal((await call('acct-1', 'DELETE', `/${runId}`)).status, 200);
    const run = (await db.collection('payRuns').doc(runId).get()).data()!;
    assert.equal(run.status, 'undone');
    assert.equal((await db.collection('transactions').doc(String(run.transactionId)).get()).data()?.status, 'void');
  });
});
