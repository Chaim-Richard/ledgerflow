/**
 * Saved CSV column layouts for bank statement imports (Y-03). A bank's export always has the same
 * header row, so the header is the key: the next file from that bank is mapped automatically.
 * Columns are stored by header name (not position), so a reordered export still maps correctly.
 */

export const MAP_FIELDS = ['date', 'description', 'amount', 'debit', 'credit', 'payee', 'memo'] as const;
export type MapField = typeof MAP_FIELDS[number];

/** Column positions chosen on screen (-1 = not used) plus how many header rows to skip. */
export type ColumnMapping = Record<MapField, number> & { skipRows: number };

export interface SavedColumnMap {
  columns: Partial<Record<MapField, string>>;
  skipRows: number;
  savedAt?: string;
}

const normalize = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');

/** A short, stable key for a header row (FNV-1a over the normalized header names). */
export function headerSignature(header: string[]): string {
  let hash = 0x811c9dc5;
  for (const ch of header.map(normalize).join('|')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `csv_${header.length}_${hash.toString(16).padStart(8, '0')}`;
}

export function mappingToSaved(mapping: ColumnMapping, header: string[]): SavedColumnMap {
  const columns: Partial<Record<MapField, string>> = {};
  for (const field of MAP_FIELDS) {
    const index = mapping[field];
    if (index >= 0 && index < header.length && header[index].trim()) columns[field] = header[index].trim();
  }
  return { columns, skipRows: Math.max(0, Math.min(20, Math.round(mapping.skipRows) || 0)) };
}

export function savedToMapping(saved: SavedColumnMap, header: string[]): ColumnMapping {
  const positions = header.map(normalize);
  const mapping = { skipRows: saved.skipRows } as ColumnMapping;
  for (const field of MAP_FIELDS) {
    const name = saved.columns[field];
    mapping[field] = name ? positions.indexOf(normalize(name)) : -1;
  }
  return mapping;
}
