import {
  reportStateFromParams,
  reportStateToParams,
  type ReportUrlState,
} from './reportPermalink';

/**
 * C-85 / C-96: named report filters and an exact share link. Only the report id, period and
 * comparison are stored. No row, amount, identity token or other workspace data belongs here.
 */
export interface SavedReportView {
  name: string;
  /** The already validated report query string, not a whole URL. */
  params: string;
  createdAt: string;
}

export const MAX_REPORT_VIEWS = 20;

export const reportViewsKey = (user: string, workspace: string): string =>
  JSON.stringify(['lf_report_views_v1', user, workspace]);

const FALLBACK_STATE: ReportUrlState = {
  report: '',
  year: 2000,
  timeframe: 'month',
  quarter: 0,
  month: 0,
  compare: 'none',
};

/** A saved view's query string is normalized through the same reader as an incoming shared link. */
export function reportViewParams(state: ReportUrlState): string {
  return reportStateToParams(state).toString();
}

export function reportViewState(params: string, fallback: ReportUrlState = FALLBACK_STATE): ReportUrlState {
  return reportStateFromParams(new URLSearchParams(params), fallback);
}

export function parseReportViews(raw: string | null): SavedReportView[] {
  try {
    const value: unknown = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) return [];
    const views = (value as { views?: unknown }).views;
    if (!Array.isArray(views)) return [];
    const names = new Set<string>();
    const parsed: SavedReportView[] = [];
    for (const item of views) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Partial<SavedReportView>;
      if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 80 || names.has(row.name)) continue;
      if (typeof row.params !== 'string' || !row.params.length || row.params.length > 800) continue;
      let normalized: string;
      try {
        const state = reportViewState(row.params);
        if (!/^[a-z0-9-]{1,60}$/.test(state.report)) continue;
        normalized = reportViewParams(state);
      } catch { continue; }
      names.add(row.name);
      parsed.push({
        name: row.name,
        params: normalized,
        createdAt: typeof row.createdAt === 'string' && row.createdAt.length <= 40 ? row.createdAt : '',
      });
      if (parsed.length === MAX_REPORT_VIEWS) break;
    }
    return parsed;
  } catch {
    return [];
  }
}

/** The exact URL behind the Copy link button: all report filters, with unrelated query keys kept. */
export function reportShareUrl(state: ReportUrlState, href: string): string {
  const url = new URL(href);
  const params = reportStateToParams(state, url.searchParams);
  url.search = params.toString();
  return url.toString();
}

/** Clipboard access is injected so a refused clipboard is a UI state, not an unhandled rejection. */
export async function copyReportLink(
  state: ReportUrlState,
  href: string,
  writeText: (text: string) => void | Promise<void>,
): Promise<{ ok: boolean; url: string }> {
  const url = reportShareUrl(state, href);
  try {
    await writeText(url);
    return { ok: true, url };
  } catch {
    return { ok: false, url };
  }
}
