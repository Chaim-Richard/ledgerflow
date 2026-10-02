/**
 * The transaction list's search and date range in the address (I-17), so a filtered list can be
 * shared or bookmarked: ?search=aws&from=2026-09-01&to=2026-09-30. Other parameters (the report
 * settings) are left alone.
 */
export interface ListUrlState {
  search: string;
  from?: string;
  to?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function listStateFromParams(params: URLSearchParams): ListUrlState {
  const date = (v: string | null) => (v && DATE.test(v) ? v : undefined);
  return { search: (params.get('search') || '').slice(0, 200), from: date(params.get('from')), to: date(params.get('to')) };
}

/** Writes the state into a copy of `params`; empty values are removed. */
export function listStateToParams(state: Partial<ListUrlState>, params: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const out = new URLSearchParams(params);
  const put = (key: string, value: string | undefined) => (value ? out.set(key, value) : out.delete(key));
  put('search', state.search?.trim());
  put('from', state.from && DATE.test(state.from) ? state.from : undefined);
  put('to', state.to && DATE.test(state.to) ? state.to : undefined);
  return out;
}

/** Replaces the address without a new history entry when it changed. */
export function replaceSearchParams(params: URLSearchParams): void {
  const url = new URL(window.location.href);
  const query = params.toString();
  const next = `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
  if (next !== `${url.pathname}${url.search}${url.hash}`) window.history.replaceState(window.history.state, '', next);
}
