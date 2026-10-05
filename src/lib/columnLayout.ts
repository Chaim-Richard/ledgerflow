/** Stable presentation IDs; no ledger values or record data are stored here. */
export const COLUMN_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['select', 'Selection'], ['date', 'Date'], ['description', 'Description'], ['category', 'Account'],
  ['project', 'Project'], ['class', 'Class'], ['location', 'Location'], ['amount', 'Amount'],
  ['balance', 'Running balance'], ['status', 'Status'], ['actions', 'Actions'],
];
export interface ColumnLayout { order: string[]; widths: Record<string, number> }
const known = new Set(COLUMN_LABELS.map(([id]) => id));
export function normalizeColumnLayout(raw: unknown): ColumnLayout {
  const input = raw && typeof raw === 'object' ? raw as { order?: unknown; widths?: unknown } : {};
  const middle = Array.isArray(input.order) ? input.order.filter((id): id is string => typeof id === 'string' && known.has(id) && id !== 'select' && id !== 'actions') : [];
  const order = ['select', ...new Set([...middle, ...COLUMN_LABELS.map(([id]) => id).filter(id => id !== 'select' && id !== 'actions')]), 'actions'];
  const widths: Record<string, number> = {};
  if (input.widths && typeof input.widths === 'object') for (const [id, width] of Object.entries(input.widths)) {
    if (known.has(id) && id !== 'select' && typeof width === 'number' && Number.isFinite(width)) widths[id] = Math.min(600, Math.max(64, Math.round(width)));
  }
  return { order, widths };
}
export function readColumnLayout(key: string): ColumnLayout {
  try { return normalizeColumnLayout(JSON.parse(localStorage.getItem(key) || '{}')); }
  catch { return normalizeColumnLayout(null); }
}
