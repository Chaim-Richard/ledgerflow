import { useEffect, useMemo, useState } from "react";
import type { ChartAccount, Transaction } from "../types";
import { useAuthStore } from "../stores/useAuthStore";
import { useFinancialReporting } from "./useFinancialReporting";
import { computeReportColumns } from "../lib/reportColumns";
import type {
  ReportColumn,
  ReportPeriod,
  StatementKind,
} from "../lib/reportColumns";

interface RemoteColumns {
  base: ReportColumn[];
  key: string;
  columns: ReportColumn[];
  loading: boolean;
  incomplete: boolean;
}

/** Each column requests the same full-history endpoint as the existing Total view. */
export function useStatementColumns(
  kind: StatementKind,
  accounts: ChartAccount[],
  transactions: Transaction[],
  periods: ReportPeriod[],
  previousPeriods: ReportPeriod[],
  requestPeriods: boolean,
) {
  const workspaceId = useAuthStore((state) => state.currentWorkspaceId);
  const { fetchPL, fetchBalanceSheet } = useFinancialReporting();
  const localColumns = useMemo(
    () =>
      computeReportColumns(
        kind,
        accounts,
        transactions,
        periods,
        previousPeriods,
      ),
    [kind, accounts, transactions, periods, previousPeriods],
  );
  const key = JSON.stringify([workspaceId, kind, periods, previousPeriods]);
  const [remote, setRemote] = useState<RemoteColumns | null>(null);
  useEffect(() => {
    if (!requestPeriods || !workspaceId || periods.length === 0) return;
    let cancelled = false;
    async function load() {
      // Publish loading after the effect starts; responses belong only to this selection/workspace.
      await Promise.resolve();
      if (cancelled) return;
      setRemote({
        base: localColumns,
        key,
        columns: [],
        loading: true,
        incomplete: false,
      });
      let incomplete = false;
      const fetchPeriod = async (period: ReportPeriod) => {
        const result =
          kind === "pl"
            ? await fetchPL(period.startDate, period.endDate)
            : await fetchBalanceSheet(period.endDate);
        const valid =
          result &&
          typeof result === "object" &&
          (kind === "pl"
            ? "income" in result && "cogs" in result && "expense" in result
            : "assets" in result &&
              "liabilities" in result &&
              "equity" in result);
        if (!valid) {
          incomplete = true;
          return null;
        }
        return result;
      };
      const columns = await Promise.all(
        localColumns.map(async (column) => {
          const [data, previousData] = await Promise.all([
            fetchPeriod(column.period),
            column.previousPeriod
              ? fetchPeriod(column.previousPeriod)
              : Promise.resolve(undefined),
          ]);
          return {
            ...column,
            data: data || column.data,
            previousData:
              previousData === undefined
                ? undefined
                : previousData || column.previousData,
          };
        }),
      );
      if (!cancelled)
        setRemote({
          base: localColumns,
          key,
          columns,
          loading: false,
          incomplete,
        });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    requestPeriods,
    workspaceId,
    kind,
    key,
    periods,
    localColumns,
    fetchPL,
    fetchBalanceSheet,
  ]);
  const selection =
    remote?.key === key && remote.base === localColumns ? remote : null;
  return {
    columns:
      requestPeriods && selection && !selection.loading
        ? selection.columns
        : localColumns,
    loading: Boolean(
      requestPeriods && workspaceId && (!selection || selection.loading),
    ),
    authoritative: Boolean(
      requestPeriods &&
      selection &&
      !selection.loading &&
      !selection.incomplete,
    ),
    incomplete: Boolean(requestPeriods && selection?.incomplete),
  };
}
