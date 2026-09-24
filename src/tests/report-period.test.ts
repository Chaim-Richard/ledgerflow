import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { getComparePeriod, getReportPeriod } from '../lib/fiscalCalendar';
import { reportStateFromParams, reportStateToParams } from '../lib/reportPermalink';
import type { ReportUrlState } from '../lib/reportPermalink';
import { computeProfitAndLoss } from '../server/reports/computeReports';
import { makeChartAccount, makeTransaction } from './fixtures';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Report period', () => {
  test('calendar year: month, quarter, year', () => {
    assert.deepEqual(getReportPeriod('month', 2026, 0, 1), { startDate: '2026-02-01', endDate: '2026-02-28' });
    assert.deepEqual(getReportPeriod('quarter', 2026, 1, 0), { startDate: '2026-04-01', endDate: '2026-06-30' });
    assert.deepEqual(getReportPeriod('year', 2026, 0, 0), { startDate: '2026-01-01', endDate: '2026-12-31' });
  });

  test('February in a leap year', () => {
    assert.deepEqual(getReportPeriod('month', 2024, 0, 1), { startDate: '2024-02-01', endDate: '2024-02-29' });
  });

  test('fiscal year starting in April: FY2026 is April 2025 to March 2026', () => {
    assert.deepEqual(getReportPeriod('year', 2026, 0, 0, 4), { startDate: '2025-04-01', endDate: '2026-03-31' });
    assert.deepEqual(getReportPeriod('quarter', 2026, 0, 0, 4), { startDate: '2025-04-01', endDate: '2025-06-30' });
    assert.deepEqual(getReportPeriod('quarter', 2026, 3, 0, 4), { startDate: '2026-01-01', endDate: '2026-03-31' });
    assert.deepEqual(getReportPeriod('month', 2026, 0, 5, 4), { startDate: '2025-06-01', endDate: '2025-06-30' });
    assert.deepEqual(getReportPeriod('month', 2026, 0, 1, 4), { startDate: '2026-02-01', endDate: '2026-02-28' });
  });
});

describe('Compare period', () => {
  test('previous month is the calendar month before, not a count of days', () => {
    assert.deepEqual(getComparePeriod('2026-03-01', '2026-03-31', 'previous'), { startDate: '2026-02-01', endDate: '2026-02-28' });
    assert.deepEqual(getComparePeriod('2026-01-01', '2026-01-31', 'previous'), { startDate: '2025-12-01', endDate: '2025-12-31' });
  });

  test('previous quarter and previous (fiscal) year', () => {
    assert.deepEqual(getComparePeriod('2026-04-01', '2026-06-30', 'previous'), { startDate: '2026-01-01', endDate: '2026-03-31' });
    assert.deepEqual(getComparePeriod('2025-04-01', '2026-03-31', 'previous'), { startDate: '2024-04-01', endDate: '2025-03-31' });
  });

  test('same period last year, 29 February included', () => {
    assert.deepEqual(getComparePeriod('2026-04-01', '2026-06-30', 'lastYear'), { startDate: '2025-04-01', endDate: '2025-06-30' });
    assert.deepEqual(getComparePeriod('2024-02-01', '2024-02-29', 'lastYear'), { startDate: '2023-02-01', endDate: '2023-02-28' });
  });

  test('a range that is not whole months moves back by its own length', () => {
    assert.deepEqual(getComparePeriod('2026-03-10', '2026-03-16', 'previous'), { startDate: '2026-03-03', endDate: '2026-03-09' });
  });

  test('no comparison', () => {
    assert.equal(getComparePeriod('2026-03-01', '2026-03-31', 'none'), null);
  });
});

describe('Report link', () => {
  const defaults: ReportUrlState = { report: 'pnl', year: 2026, timeframe: 'month', quarter: 0, month: 0, compare: 'none' };

  test('state → link → state', () => {
    const state: ReportUrlState = { report: 'balance-sheet', year: 2025, timeframe: 'quarter', quarter: 1, month: 0, compare: 'previous' }; // a quarter link carries no month
    const params = reportStateToParams(state, new URLSearchParams('view=reports'));
    assert.equal(params.toString(), 'view=reports&report=balance-sheet&y=2025&t=quarter&q=2&cmp=prev');
    assert.deepEqual(reportStateFromParams(params, defaults), state);
  });

  test('bad or missing values fall back to the defaults', () => {
    const state = reportStateFromParams(new URLSearchParams('report=<x>&y=abc&t=decade&q=9&m=13&cmp=zzz'), defaults);
    assert.deepEqual(state, { ...defaults, compare: 'none' });
  });
});

describe('P&L compared with the same period last year', () => {
  const accounts = [
    makeChartAccount({ id: 'cash', name: 'Cash', type: 'asset', category: 'Cash' }),
    makeChartAccount({ id: 'sales', name: 'Sales', type: 'revenue', category: 'Revenue' }),
    makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense', category: 'Rent' }),
  ];
  const tx = (id: string, date: string, account: string, cents: number) => makeTransaction({
    id, date, lines: [{ accountId: 'cash', amountCents: -cents }, { accountId: account, amountCents: cents }],
  });
  const transactions = [
    tx('s25', '2025-03-10', 'sales', -40000), tx('r25', '2025-03-15', 'rent', 10000),
    tx('s26', '2026-03-10', 'sales', -55000), tx('r26', '2026-03-15', 'rent', 12000),
    tx('feb', '2026-02-20', 'sales', -99900),
  ];

  test('previous-year numbers come from the compare period only', () => {
    const period = getReportPeriod('month', 2026, 0, 2);
    const compare = getComparePeriod(period.startDate, period.endDate, 'lastYear')!;
    const now = computeProfitAndLoss(accounts, transactions, period.startDate, period.endDate);
    const before = computeProfitAndLoss(accounts, transactions, compare.startDate, compare.endDate);
    assert.equal(now.income.total, 55000);
    assert.equal(before.income.total, 40000);
    assert.equal(now.netIncome - before.netIncome, 43000 - 30000);
  });
});

describe('Report generator (npm run scaffold:report)', () => {
  test('creates the math, the screen and a test, and never overwrites', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-scaffold-'));
    const run = () => execFileSync('node', ['scripts/scaffold.js', 'report', 'SalesByRegion'], { env: { ...process.env, LF_SCAFFOLD_ROOT: root }, encoding: 'utf8', stdio: 'pipe' });
    const out = run();
    for (const f of ['src/server/reports/salesByRegionReport.ts', 'src/components/reporting/SalesByRegionView.tsx', 'src/tests/sales-by-region-report.test.ts']) {
      assert.ok(fs.existsSync(path.join(root, f)), f);
    }
    assert.match(fs.readFileSync(path.join(root, 'src/server/reports/salesByRegionReport.ts'), 'utf8'), /isPostable\(tx\)[\s\S]*lineAmount\(line, tx\)/);
    assert.match(out, /componentName: 'SalesByRegionView'/);
    assert.throws(run);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
