import React, { useId, useMemo } from "react";
import type { ChartAccount, Transaction } from "../../types";
import { useAuthStore } from "../../stores/useAuthStore";
import { useLedgerStore } from "../../stores/useLedgerStore";
import { useStatementColumns } from "../../hooks/useStatementColumns";
import {
  splitReportPeriods,
  statementFigures,
  statementRows,
  percentageOfTotal,
  reportVariance,
  reportPercent,
  statementColumnCsv,
} from "../../lib/reportColumns";
import type {
  ReportColumnMode,
  ReportPeriod,
  StatementData,
  StatementKind,
  StatementRow,
} from "../../lib/reportColumns";
import { downloadCsv } from "../../lib/csvExport";
import { isPostable, isTransactionInDateRange } from "../../lib/txFilters";

interface StatementColumnsProps {
  kind: StatementKind;
  title: string;
  accounts: ChartAccount[];
  transactions: Transaction[];
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
  compare: boolean;
  mode: ReportColumnMode;
  onModeChange: (mode: ReportColumnMode) => void;
  showPercent: boolean;
  onPercentChange: (show: boolean) => void;
  totalData: StatementData;
  previousTotalData: StatementData;
  totalAuthoritative: boolean;
  formatMoney: (cents: number) => string;
  sortBy?: "code" | "name" | "balance";
  sortDir?: "asc" | "desc";
  onSort: (field: "code" | "name" | "balance") => void;
  onDrillDown: (name: string, transactions: Transaction[]) => void;
}

export function StatementColumns(props: StatementColumnsProps) {
  const {
    kind,
    title,
    accounts,
    transactions,
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
    compare,
    mode,
    onModeChange,
    showPercent,
    onPercentChange,
    totalData,
    previousTotalData,
    totalAuthoritative,
    formatMoney,
    sortBy,
    sortDir,
    onSort,
    onDrillDown,
  } = props;
  const formId = useId();
  const fiscalStart =
    useAuthStore(
      (state) => state.getCurrentWorkspace()?.fiscalYearStartMonth,
    ) || 1;
  const truncated = useLedgerStore((state) => state.isDataTruncated);
  const periods = useMemo(
    () => splitReportPeriods(startDate, endDate, mode, fiscalStart),
    [startDate, endDate, mode, fiscalStart],
  );
  const previousPeriods = useMemo(
    () =>
      compare && compareStartDate && compareEndDate
        ? splitReportPeriods(
            compareStartDate,
            compareEndDate,
            mode,
            fiscalStart,
          )
        : [],
    [compare, compareStartDate, compareEndDate, mode, fiscalStart],
  );
  const report = useStatementColumns(
    kind,
    accounts,
    transactions,
    periods,
    previousPeriods,
    mode !== "total",
  );
  const columns = useMemo(
    () =>
      mode === "total"
        ? report.columns.map((column) => ({
            ...column,
            data: totalData,
            previousData: compare ? previousTotalData : undefined,
          }))
        : report.columns,
    [mode, report.columns, totalData, previousTotalData, compare],
  );
  const active = mode !== "total" || showPercent || compare;
  const rows = useMemo(
    () =>
      columns[0] && report.columns[0]
        ? statementRows(
            accounts,
            report.columns[0].data,
            sortBy,
            sortDir,
            statementFigures(columns[0].data),
          )
        : [],
    [accounts, columns, report.columns, sortBy, sortDir],
  );
  const figures = columns.map((column) => ({
    period: column.period,
    current: statementFigures(column.data),
    previous: column.previousData
      ? statementFigures(column.previousData)
      : undefined,
  }));
  const complete = mode === "total" ? totalAuthoritative : report.authoritative;
  const drillDown = (row: StatementRow, period: ReportPeriod) =>
    onDrillDown(
      `${row.label} · ${period.startDate} to ${period.endDate}`,
      transactions.filter(
        (transaction) =>
          isPostable(transaction) &&
          isTransactionInDateRange(
            transaction,
            kind === "pl" ? period.startDate : undefined,
            period.endDate,
          ) &&
          transaction.lines?.some((line) => line.accountId === row.accountId),
      ),
    );
  const exportCsv = () => {
    const csv = statementColumnCsv(rows, columns, showPercent, compare);
    downloadCsv(
      `${kind === "pl" ? "Profit_and_Loss" : "Balance_Sheet"}_${startDate}_${endDate}_${mode}.csv`,
      csv.headers,
      csv.rows,
    );
  };
  const cellsPerColumn = 1 + (showPercent ? 1 : 0) + (compare ? 3 : 0);
  return (
    <section className="space-y-3" aria-label={`${title} columns`}>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <label
          htmlFor={`${formId}-mode`}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          Columns:
          <select
            id={`${formId}-mode`}
            value={mode}
            onChange={(event) =>
              onModeChange(event.target.value as ReportColumnMode)
            }
            className="min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3"
          >
            <option value="total">Total</option>
            <option value="months">Months</option>
            <option value="quarters">Quarters</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showPercent}
            onChange={(event) => onPercentChange(event.target.checked)}
          />
          % of total
        </label>
        <button
          type="button"
          onClick={exportCsv}
          disabled={
            columns.length === 0 || report.loading || (truncated && !complete)
          }
          className="min-h-11 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold disabled:opacity-50"
        >
          Export columns CSV
        </button>
      </div>
      {active && (
        <>
          <p className="text-xs text-[var(--muted)]">
            {startDate} to {endDate} ·{" "}
            {kind === "bs"
              ? "Closing balances at each period end"
              : "Activity inside each period"}{" "}
            · % of {kind === "pl" ? "income" : "total assets"}
          </p>
          {report.loading && (
            <p role="status" className="text-sm">
              Loading full period reports…
            </p>
          )}
          {truncated && !complete && (
            <p
              role="status"
              className="rounded-lg border border-amber-500 p-3 text-sm"
            >
              Period figures use the loaded ledger and may be incomplete. CSV
              export is available after the full reports load.
            </p>
          )}
          {mode !== "total" && report.incomplete && !truncated && (
            <p role="status" className="text-sm">
              Some server reports could not load. Showing figures from the local
              ledger.
            </p>
          )}
          {compare && previousPeriods.length !== periods.length && (
            <p role="status" className="text-sm">
              The comparison has a different number of periods. Unavailable
              comparisons are shown as —.
            </p>
          )}
          <div className="max-w-full overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full border-collapse text-sm tabular-nums">
              <caption className="sr-only">
                {title} by {mode} with {showPercent ? "percentages and " : ""}
                {compare ? "comparison variance" : "amounts"}
              </caption>
              <thead className="bg-[var(--ink)]">
                <tr>
                  <th scope="col" rowSpan={2} className="p-3 text-left">
                    <button
                      type="button"
                      onClick={() => onSort("name")}
                      className="min-h-11"
                      aria-label="Sort accounts by name"
                    >
                      Account
                    </button>
                  </th>
                  <th scope="col" rowSpan={2} className="p-3 text-left">
                    <button
                      type="button"
                      onClick={() => onSort("code")}
                      className="min-h-11"
                      aria-label="Sort accounts by code"
                    >
                      Code
                    </button>
                  </th>
                  {columns.map((column) => (
                    <th
                      scope="colgroup"
                      colSpan={cellsPerColumn}
                      key={column.period.id}
                      className="p-3 text-center whitespace-nowrap"
                    >
                      {column.period.label}
                      <span className="block text-xs font-normal">
                        {kind === "bs"
                          ? column.period.endDate
                          : `${column.period.startDate} – ${column.period.endDate}`}
                      </span>
                      {compare && column.previousPeriod && (
                        <span className="block text-xs font-normal">
                          vs{" "}
                          {kind === "bs"
                            ? column.previousPeriod.endDate
                            : `${column.previousPeriod.startDate} – ${column.previousPeriod.endDate}`}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
                <tr>
                  {columns.map((column, index) => (
                    <React.Fragment key={column.period.id}>
                      <th scope="col" className="p-3 text-right">
                        {index === 0 ? (
                          <button
                            type="button"
                            onClick={() => onSort("balance")}
                            className="min-h-11"
                            aria-label="Sort accounts by first period amount"
                          >
                            Amount
                          </button>
                        ) : (
                          "Amount"
                        )}
                      </th>
                      {showPercent && (
                        <th
                          scope="col"
                          className="p-3 text-right whitespace-nowrap"
                        >
                          % of total
                        </th>
                      )}
                      {compare && (
                        <>
                          <th scope="col" className="p-3 text-right">
                            Previous
                          </th>
                          <th scope="col" className="p-3 text-right">
                            Variance
                          </th>
                          <th
                            scope="col"
                            className="p-3 text-right whitespace-nowrap"
                          >
                            Variance %
                          </th>
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-[var(--line)] ${row.total || row.heading ? "font-semibold bg-[var(--ink)]" : ""}`}
                  >
                    <th scope="row" className="p-3 text-left whitespace-nowrap">
                      {row.label}
                    </th>
                    <td className="p-3">{row.code}</td>
                    {figures.map((column) => {
                      const amount = column.current.values[row.id] || 0;
                      const previous = column.previous?.values[row.id] || 0;
                      const variance = column.previous
                        ? reportVariance(amount, previous)
                        : null;
                      return (
                        <React.Fragment key={column.period.id}>
                          <td className="p-3 text-right whitespace-nowrap">
                            {!row.heading &&
                              (row.accountId ? (
                                <button
                                  type="button"
                                  onClick={() => drillDown(row, column.period)}
                                  className="min-h-11 underline decoration-dotted"
                                  aria-label={`${row.label}, ${column.period.label}, open ledger`}
                                >
                                  {formatMoney(amount)}
                                </button>
                              ) : (
                                formatMoney(amount)
                              ))}
                          </td>
                          {showPercent && (
                            <td className="p-3 text-right whitespace-nowrap">
                              {!row.heading &&
                                reportPercent(
                                  percentageOfTotal(
                                    amount,
                                    column.current.denominator,
                                  ),
                                )}
                            </td>
                          )}
                          {compare && (
                            <>
                              <td className="p-3 text-right whitespace-nowrap">
                                {!row.heading &&
                                  (column.previous
                                    ? formatMoney(previous)
                                    : "—")}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                {!row.heading &&
                                  (variance
                                    ? formatMoney(variance.amount)
                                    : "—")}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                {!row.heading &&
                                  reportPercent(variance?.percent ?? null)}
                              </td>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
