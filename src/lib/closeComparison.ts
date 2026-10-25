/**
 * R-09 close comparison (AI #3, A-1): the month being closed beside the month before it and the
 * same month last year, with the change and a flag for big moves.
 *
 * Read-only and display only: it calls the existing statement functions
 * (`computeProfitAndLoss`, `computeBalanceSheet`) once per period — the same numbers every report
 * shows — and never writes, posts or recalculates money its own way. Balance-sheet columns are
 * closing snapshots (as at each month end); P&L columns are the activity inside each month.
 */
import type { ChartAccount, Transaction } from '../types';
import {
  computeBalanceSheet,
  computeProfitAndLoss,
} from '../server/reports/computeReports';
import { reportVariance } from './reportColumns';
import { addToDateISO, monthBoundsISO, parseAmountToCents } from './utils';
import { balanceEntries, opensForPeriod, opensFromServer, periodEntries, type ServerOpening } from './serverBalances';

/** A change is a "big move" when it is at least this percent of the month it is compared with. */
export const CLOSE_COMPARISON_PERCENT = 20;
/** …and at least this much money, until the person closing sets their own amount. */
export const CLOSE_COMPARISON_THRESHOLD_CENTS = 100_000;

export type CloseComparisonPeriodId = 'current' | 'previousMonth' | 'previousYear';

export interface CloseComparisonPeriod {
  id: CloseComparisonPeriodId;
  /** The calendar month, YYYY-MM. */
  month: string;
  startDate: string;
  endDate: string;
}

export interface CloseComparisonRow {
  id: string;
  label: string;
  code?: string;
  kind: 'account' | 'total';
  current: number;
  previousMonth: number;
  previousYear: number;
  changePreviousMonth: number;
  changePreviousYear: number;
  percentPreviousMonth: number | null;
  percentPreviousYear: number | null;
  /** Change vs the previous month passed the threshold and the percent rule. */
  bigMove: boolean;
  /** Change vs the same month last year passed the threshold and the percent rule. */
  bigMoveYear: boolean;
  /**
   * L-123 step 3d: false when this month or the one compared with is incomplete (`CloseComparisonStatement.incomplete`):
   * the change is then not a real move, so its percent is null and it is never a big move.
   */
  comparablePreviousMonth: boolean;
  comparablePreviousYear: boolean;
}

export interface CloseComparisonStatement {
  id: 'pl' | 'bs';
  title: string;
  rows: CloseComparisonRow[];
  /**
   * L-123 step 3d: per column, true when its figures come from the loaded entries alone while the browser's list is
   * capped (the server's balances do not cover that month end or period start), so older entries may be missing.
   */
  incomplete: Record<CloseComparisonPeriodId, boolean>;
}

export interface CloseComparisonResult {
  month: string;
  previousMonth: string;
  previousYearMonth: string;
  periods: Record<CloseComparisonPeriodId, CloseComparisonPeriod>;
  thresholdCents: number;
  percent: number;
  profitAndLoss: CloseComparisonStatement;
  balanceSheet: CloseComparisonStatement;
  /** Rows flagged against either comparison, biggest change first. */
  bigMoves: CloseComparisonRow[];
}

/**
 * The owner's rule: a move counts only when it is at least `thresholdCents` in money and (when
 * there was something to compare with) at least `percent` of the month it is compared with. A move
 * from zero is always measured against the threshold alone — there is no percentage of nothing.
 */
export function isBigMove(
  changeCents: number,
  baseCents: number,
  thresholdCents: number,
  percent: number,
): boolean {
  if (!changeCents || !Number.isFinite(changeCents)) return false;
  if (Math.abs(changeCents) < thresholdCents) return false;
  if (!baseCents) return true;
  return (Math.abs(changeCents) / Math.abs(baseCents)) * 100 >= percent;
}

/**
 * The amount typed in the panel ("1,000", "1000.50") as whole cents; null when it is not a
 * positive amount someone could mean.
 */
export function thresholdFromInput(input: string): number | null {
  const trimmed = (input || '').trim();
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,3})?$/.test(trimmed)) return null;
  const cents = parseAmountToCents(trimmed);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

function monthOf(month: string, by: { years?: number; months?: number }): string {
  return addToDateISO(`${month.slice(0, 7)}-01`, by).slice(0, 7);
}

function period(id: CloseComparisonPeriodId, month: string): CloseComparisonPeriod {
  const bounds = monthBoundsISO(`${month}-01`);
  return { id, month, startDate: bounds.start, endDate: bounds.end };
}

function accountOrder(a: ChartAccount, b: ChartAccount): number {
  return (a.code || a.name).localeCompare(b.code || b.name, 'en');
}

interface StatementValues {
  /** accountId → amount (signed, in whole cents, as the statement shows it). */
  accounts: Record<string, number>;
  /** row id (total:…) → amount. */
  totals: Record<string, number>;
}

/** P&L activity for one month, shaped like the report's own account maps. */
function profitAndLossValues(
  accounts: ChartAccount[],
  transactions: Transaction[],
  bounds: { startDate: string; endDate: string },
): StatementValues {
  const data = computeProfitAndLoss(accounts, transactions, bounds.startDate, bounds.endDate);
  const values: StatementValues = { accounts: {}, totals: {} };
  for (const section of ['income', 'cogs', 'expense'] as const) {
    for (const [id, account] of Object.entries(data[section].accounts)) {
      values.accounts[`${section}:${id}`] = account.balance;
    }
    values.totals[`total:${section}`] = data[section].total;
  }
  values.totals['total:grossProfit'] = data.grossProfit;
  values.totals['total:netIncome'] = data.netIncome;
  return values;
}

/** Balance-sheet closing snapshot for one month end, matching the report's own rows. */
function balanceSheetValues(
  accounts: ChartAccount[],
  transactions: Transaction[],
  endDate: string,
): StatementValues {
  const data = computeBalanceSheet(accounts, transactions, endDate);
  const values: StatementValues = { accounts: {}, totals: {} };
  for (const [id, amount] of Object.entries(data.assets)) values.accounts[`asset:${id}`] = amount;
  for (const [id, amount] of Object.entries(data.liabilities)) values.accounts[`liability:${id}`] = amount;
  for (const [id, amount] of Object.entries(data.equity)) values.accounts[`equity:${id}`] = amount;
  values.totals = {
    'total:assets': data.totalAssets,
    'total:liabilities': data.totalLiabilities,
    // Current earnings are shown as their own row and counted once in the equity subtotal.
    'total:retainedEarnings': data.netIncome,
    'total:equity': data.totalEquity + data.netIncome,
    'total:claims': data.totalClaims,
  };
  return values;
}

function buildRow(
  id: string,
  label: string,
  kind: CloseComparisonRow['kind'],
  values: { current: number; previousMonth: number; previousYear: number },
  thresholdCents: number,
  percent: number,
  code?: string,
): CloseComparisonRow {
  const changePreviousMonth = values.current - values.previousMonth;
  const changePreviousYear = values.current - values.previousYear;
  const previousMonthVariance = reportVariance(values.current, values.previousMonth);
  const previousYearVariance = reportVariance(values.current, values.previousYear);
  return {
    id,
    label,
    ...(code ? { code } : {}),
    kind,
    ...values,
    changePreviousMonth,
    changePreviousYear,
    percentPreviousMonth: previousMonthVariance.percent,
    percentPreviousYear: previousYearVariance.percent,
    bigMove: isBigMove(changePreviousMonth, values.previousMonth, thresholdCents, percent),
    bigMoveYear: isBigMove(changePreviousYear, values.previousYear, thresholdCents, percent),
    comparablePreviousMonth: true,
    comparablePreviousYear: true,
  };
}

function statementRows(
  definitions: Array<{ id: string; label: string; kind: CloseComparisonRow['kind']; code?: string; read: (values: StatementValues) => number | undefined }>,
  periods: [StatementValues, StatementValues, StatementValues],
  thresholdCents: number,
  percent: number,
): CloseComparisonRow[] {
  const [current, previousMonth, previousYear] = periods;
  return definitions.map(definition => buildRow(
    definition.id,
    definition.label,
    definition.kind,
    {
      current: definition.read(current) ?? 0,
      previousMonth: definition.read(previousMonth) ?? 0,
      previousYear: definition.read(previousYear) ?? 0,
    },
    thresholdCents,
    percent,
    definition.code,
  ));
}

/**
 * The comparison itself. Accounts with nothing in any of the three periods are left out (the
 * totals always stay) so the panel shows the month's real activity, not every account in the
 * chart. Every figure comes from the statement functions above.
 */
export function buildCloseComparison(input: {
  month: string;
  accounts: ChartAccount[];
  transactions: Transaction[];
  thresholdCents?: number;
  percent?: number;
  /**
   * L-123 step 3d: the server's balances through the oldest loaded day (useLedgerStore.serverOpening). Each month end
   * on or after that day reads them (`balanceEntries`), and each month that starts after it (`periodEntries`).
   */
  opening?: ServerOpening | null;
  workspaceId?: string;
  /** The browser's list of entries is capped (truncatedCollections.transactions): a column the server does not cover is incomplete. */
  capped?: boolean;
}): CloseComparisonResult {
  const month = (input.month || '').slice(0, 7);
  const thresholdCents = input.thresholdCents ?? CLOSE_COMPARISON_THRESHOLD_CENTS;
  const percent = input.percent ?? CLOSE_COMPARISON_PERCENT;
  const accounts = input.accounts || [];
  const transactions = input.transactions || [];

  const previousMonth = monthOf(month, { months: -1 });
  const previousYearMonth = monthOf(month, { years: -1 });
  const periods = {
    current: period('current', month),
    previousMonth: period('previousMonth', previousMonth),
    previousYear: period('previousYear', previousYearMonth),
  } as Record<CloseComparisonPeriodId, CloseComparisonPeriod>;

  const opening = input.opening || null;
  const plEntries = (p: CloseComparisonPeriod) => periodEntries(transactions, opening, p.startDate, input.workspaceId);
  const bsEntries = (date: string) => balanceEntries(transactions, opening, date, input.workspaceId);

  const plPeriods = [
    profitAndLossValues(accounts, plEntries(periods.current), periods.current),
    profitAndLossValues(accounts, plEntries(periods.previousMonth), periods.previousMonth),
    profitAndLossValues(accounts, plEntries(periods.previousYear), periods.previousYear),
  ] as [StatementValues, StatementValues, StatementValues];
  const bsPeriods = [
    balanceSheetValues(accounts, bsEntries(periods.current.endDate), periods.current.endDate),
    balanceSheetValues(accounts, bsEntries(periods.previousMonth.endDate), periods.previousMonth.endDate),
    balanceSheetValues(accounts, bsEntries(periods.previousYear.endDate), periods.previousYear.endDate),
  ] as [StatementValues, StatementValues, StatementValues];

  const plRows: CloseComparisonRow[] = [];
  const sections: Array<{ section: 'income' | 'cogs' | 'expense'; title: string }> = [
    { section: 'income', title: 'Income' },
    { section: 'cogs', title: 'Cost of goods sold' },
    { section: 'expense', title: 'Expenses' },
  ];
  for (const { section, title } of sections) {
    const members = accounts
      .filter(account => `${section}:${account.id}` in plPeriods[0].accounts)
      .sort(accountOrder);
    const active = members.filter(account => {
      const id = `${section}:${account.id}`;
      return plPeriods.some(values => (values.accounts[id] || 0) !== 0);
    });
    plRows.push(...statementRows(
      active.map(account => ({
        id: `account:${account.id}`,
        label: account.name,
        kind: 'account' as const,
        code: account.code,
        read: (values: StatementValues) => values.accounts[`${section}:${account.id}`],
      })),
      plPeriods,
      thresholdCents,
      percent,
    ));
    plRows.push(...statementRows(
      [{ id: `total:${section}`, label: `Total ${title.toLowerCase()}`, kind: 'total', read: (values: StatementValues) => values.totals[`total:${section}`] }],
      plPeriods,
      thresholdCents,
      percent,
    ));
    if (section === 'cogs') {
      plRows.push(...statementRows(
        [{ id: 'total:grossProfit', label: 'Gross profit', kind: 'total', read: (values: StatementValues) => values.totals['total:grossProfit'] }],
        plPeriods,
        thresholdCents,
        percent,
      ));
    }
  }
  plRows.push(...statementRows(
    [{ id: 'total:netIncome', label: 'Net income', kind: 'total', read: (values: StatementValues) => values.totals['total:netIncome'] }],
    plPeriods,
    thresholdCents,
    percent,
  ));

  const bsRows: CloseComparisonRow[] = [];
  const bsSection = (type: 'asset' | 'liability', title: string, totalId: string) => {
    const members = accounts.filter(account => account.type === type).sort(accountOrder);
    const active = members.filter(account => {
      const id = `${type}:${account.id}`;
      return bsPeriods.some(values => (values.accounts[id] || 0) !== 0);
    });
    bsRows.push(...statementRows(
      active.map(account => ({
        id: `account:${account.id}`,
        label: account.name,
        kind: 'account' as const,
        code: account.code,
        read: (values: StatementValues) => values.accounts[`${type}:${account.id}`],
      })),
      bsPeriods,
      thresholdCents,
      percent,
    ));
    bsRows.push(...statementRows(
      [{ id: totalId, label: `Total ${title.toLowerCase()}`, kind: 'total', read: (values: StatementValues) => values.totals[totalId] }],
      bsPeriods,
      thresholdCents,
      percent,
    ));
  };
  bsSection('asset', 'Assets', 'total:assets');
  bsSection('liability', 'Liabilities', 'total:liabilities');
  const equityAccounts = accounts.filter(account => account.type === 'equity').sort(accountOrder)
    .filter(account => bsPeriods.some(values => (values.accounts[`equity:${account.id}`] || 0) !== 0));
  bsRows.push(...statementRows(
    equityAccounts.map(account => ({
      id: `account:${account.id}`,
      label: account.name,
      kind: 'account' as const,
      code: account.code,
      read: (values: StatementValues) => values.accounts[`equity:${account.id}`],
    })),
    bsPeriods,
    thresholdCents,
    percent,
  ));
  // Current earnings are their own row and are counted once in the equity subtotal (see the report).
  bsRows.push(...statementRows(
    [
      { id: 'total:retainedEarnings', label: 'Current earnings', kind: 'total', read: (values: StatementValues) => values.totals['total:retainedEarnings'] },
      { id: 'total:equity', label: 'Total equity', kind: 'total', read: (values: StatementValues) => values.totals['total:equity'] },
      { id: 'total:claims', label: 'Total liabilities and equity', kind: 'total', read: (values: StatementValues) => values.totals['total:claims'] },
    ],
    bsPeriods,
    thresholdCents,
    percent,
  ));

  // L-123 step 3d: a column the server's balances do not cover, while the list is capped, is incomplete
  const ids: CloseComparisonPeriodId[] = ['current', 'previousMonth', 'previousYear'];
  const plIncomplete = Object.fromEntries(ids.map(id => [id, !!input.capped && !opensForPeriod(transactions, opening, periods[id].startDate, input.workspaceId)])) as Record<CloseComparisonPeriodId, boolean>;
  const bsIncomplete = Object.fromEntries(ids.map(id => [id, !!input.capped && !opensFromServer(transactions, opening, periods[id].endDate, input.workspaceId)])) as Record<CloseComparisonPeriodId, boolean>;
  const markIncomplete = (rows: CloseComparisonRow[], incomplete: Record<CloseComparisonPeriodId, boolean>) => {
    for (const row of rows) {
      if (incomplete.current || incomplete.previousMonth) Object.assign(row, { comparablePreviousMonth: false, percentPreviousMonth: null, bigMove: false });
      if (incomplete.current || incomplete.previousYear) Object.assign(row, { comparablePreviousYear: false, percentPreviousYear: null, bigMoveYear: false });
    }
  };
  markIncomplete(plRows, plIncomplete);
  markIncomplete(bsRows, bsIncomplete);

  const bigMoves = [...plRows, ...bsRows]
    .filter(row => row.bigMove || row.bigMoveYear)
    .sort((a, b) => Math.max(Math.abs(b.changePreviousMonth), Math.abs(b.changePreviousYear))
      - Math.max(Math.abs(a.changePreviousMonth), Math.abs(a.changePreviousYear)));

  return {
    month,
    previousMonth,
    previousYearMonth,
    periods,
    thresholdCents,
    percent,
    profitAndLoss: { id: 'pl', title: 'Profit & loss', rows: plRows, incomplete: plIncomplete },
    balanceSheet: { id: 'bs', title: 'Balance sheet', rows: bsRows, incomplete: bsIncomplete },
    bigMoves,
  };
}
