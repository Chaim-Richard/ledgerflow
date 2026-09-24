import type { CompareMode, ReportTimeframe } from './fiscalCalendar';

/** What the Reports page keeps in the address bar so a link reopens the same report. */
export interface ReportUrlState {
  report: string;
  year: number;
  timeframe: ReportTimeframe;
  quarter: number;
  month: number;
  compare: CompareMode;
}

const TIMEFRAMES: ReportTimeframe[] = ['month', 'quarter', 'year'];
const COMPARES: Record<string, CompareMode> = { prev: 'previous', ly: 'lastYear' };

function intIn(value: string | null, min: number, max: number): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

/** Reads the report state from a query string; anything missing or invalid keeps its default. */
export function reportStateFromParams(params: URLSearchParams, defaults: ReportUrlState): ReportUrlState {
  const report = params.get('report');
  const t = params.get('t') as ReportTimeframe | null;
  const cmp = params.get('cmp');
  return {
    report: report && /^[a-z0-9-]{1,60}$/.test(report) ? report : defaults.report,
    year: intIn(params.get('y'), 1900, 2999) ?? defaults.year,
    timeframe: t && TIMEFRAMES.includes(t) ? t : defaults.timeframe,
    quarter: (intIn(params.get('q'), 1, 4) ?? defaults.quarter + 1) - 1,
    month: (intIn(params.get('m'), 1, 12) ?? defaults.month + 1) - 1,
    compare: cmp ? COMPARES[cmp] ?? 'none' : defaults.compare,
  };
}

/** Writes the report state into a copy of `params` (other parameters are kept). */
export function reportStateToParams(state: ReportUrlState, params: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const out = new URLSearchParams(params);
  out.set('report', state.report);
  out.set('y', String(state.year));
  out.set('t', state.timeframe);
  out.delete('q');
  out.delete('m');
  if (state.timeframe === 'quarter') out.set('q', String(state.quarter + 1));
  if (state.timeframe === 'month') out.set('m', String(state.month + 1));
  if (state.compare === 'none') out.delete('cmp');
  else out.set('cmp', state.compare === 'previous' ? 'prev' : 'ly');
  return out;
}
