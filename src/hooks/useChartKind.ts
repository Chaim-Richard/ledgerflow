import { useState } from "react";
import { useAuthStore } from "../stores/useAuthStore";

export const CHART_KINDS = ["bar", "line", "area"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

/** Only a display choice is stored; no labels, financial rows or account IDs. */
export function chartKindKey(
  userId: string | undefined,
  workspaceId: string | null | undefined,
  chartId: string,
) {
  return `lf_chart_kind_v1:${JSON.stringify([userId || "guest", workspaceId || "none", chartId])}`;
}
export function useChartScope(chartId: string) {
  const uid = useAuthStore((state) => state.user?.uid);
  const workspaceId = useAuthStore((state) => state.currentWorkspaceId);
  return chartKindKey(uid, workspaceId, chartId);
}
export function useChartKind(key: string, fallback: ChartKind) {
  const [kind, setKind] = useState<ChartKind>(() => {
    try {
      const saved = localStorage.getItem(key);
      return CHART_KINDS.find((value) => value === saved) || fallback;
    } catch {
      return fallback;
    }
  });
  const [storageError, setStorageError] = useState(false);
  const changeKind = (next: ChartKind) => {
    setKind(next);
    try {
      localStorage.setItem(key, next);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  return { kind, changeKind, storageError };
}
