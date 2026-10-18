/** D-26: structural checks only; never decides the tax to charge. */
export type Row = Record<string, unknown>;
export interface TableSpec {
  file: string; name: string; keys: readonly string[];
  fractions?: readonly string[]; amounts?: readonly string[]; percentages?: readonly string[];
  mode?: 'year' | 'holiday' | 'reference' | 'metadata';
}
export interface Problem { table: string; row: number; rule: string; message: string }
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
export const realDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v.startsWith('0000')) return false;
  const parsed = new Date(v + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
};
const sourceUrl = (value: unknown) => {
  if (typeof value !== 'string' || value !== value.trim() || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
};
export function normalizeRows(spec: TableSpec, value: unknown): unknown[] {
  if (spec.mode === 'metadata') return object(value) ? [{ ...value, source: value }] : [value];
  if (spec.mode === 'reference') return object(value)
    ? Object.entries(value).map(([country, row]) => object(row) ? { ...row, country } : row) : [value];
  if (!Array.isArray(value)) return [value];
  if (spec.mode === 'year') return value.map(row => object(row) && Number.isInteger(row.year) && Number(row.year) >= 1 && Number(row.year) <= 9999
    ? { ...row, validFrom: String(row.year).padStart(4, '0') + '-01-01', validTo: String(row.year).padStart(4, '0') + '-12-31' } : row);
  if (spec.mode === 'holiday') return value.flatMap(row => {
    if (!object(row)) return [row];
    const bands = Array.isArray(row.bands) && row.bands.length ? row.bands : [undefined];
    return bands.map(band => ({ ...row, bandId: object(band) ? band.id : undefined,
      capCents: object(band) ? band.capCents : undefined, validFrom: row.from, validTo: row.to }));
  });
  return value;
}
export function validateTable(spec: TableSpec, value: unknown): Problem[] {
  const problems: Problem[] = [];
  const label = spec.file + ':' + spec.name;
  const add = (row: number, rule: string, message: string) => problems.push({ table: label, row, rule, message });
  if (spec.mode !== 'metadata' && spec.mode !== 'reference' && !Array.isArray(value)) {
    add(0, 'shape', 'Expected an array table.');
    return problems;
  }
  const rows = normalizeRows(spec, value);
  if (!rows.length) add(0, 'empty', 'The declared table must not be empty.');
  const intervals = new Map<string, Array<{ start: string; end: string; row: number }>>();
  rows.forEach((unknownRow, index) => {
    const rowNumber = index + 1;
    if (!object(unknownRow)) { add(rowNumber, 'shape', 'Expected an object row.'); return; }
    const row = unknownRow;
    const source = row.source;
    if (object(source)) {
      if (typeof source.authority !== 'string' || !source.authority.trim()) add(rowNumber, 'source', 'Source authority is missing.');
      if (!realDate(source.retrieved)) add(rowNumber, 'source', 'Source retrieved date is not a real ISO date.');
      if (!sourceUrl(source.url)) add(rowNumber, 'source', 'Source URL must be absolute HTTPS without credentials.');
    } else if (!sourceUrl(source)) add(rowNumber, 'source', 'Source URL must be absolute HTTPS without credentials.');
    for (const field of ['checked', 'reviewedOn']) {
      if (row[field] !== undefined && !realDate(row[field])) add(rowNumber, 'date', field + ' is not a real ISO date.');
    }
    const identity = spec.keys.map(declared => {
      const optional = declared.endsWith('?');
      const field = optional ? declared.slice(0, -1) : declared;
      const value = row[field];
      if ((value === undefined || value === '') && optional) return '';
      if (typeof value !== 'string' || !value.trim()) add(rowNumber, 'identity', field + ' must identify the tax scope.');
      return value;
    });
    for (const [fields, maximum, integer] of [
      [spec.fractions || [], 1, false],
      [spec.percentages || [], 100, false],
      [spec.amounts || [], Number.MAX_SAFE_INTEGER, true],
    ] as const) {
      for (const declared of fields) {
        const optional = declared.endsWith('?');
        const field = optional ? declared.slice(0, -1) : declared;
        const value = row[field];
        if (value === undefined && optional) {
          if (row.treatment === 'reduced') add(rowNumber, 'range', 'A reduced treatment needs ' + field + '.');
          continue;
        }
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum || (integer && !Number.isSafeInteger(value))) {
          add(rowNumber, 'range', field + ' must be ' + (integer ? 'an integer' : 'a finite number') + ' in [0, ' + maximum + '].');
        }
      }
    }
    if (spec.mode === 'reference') {
      if (!realDate(row.reviewedOn)) add(rowNumber, 'date', 'A format needs its real reviewedOn date.');
      return; // A format review date is not a legal effective date.
    }
    if (spec.mode === 'year' && (!Number.isInteger(row.year) || Number(row.year) < 1 || Number(row.year) > 9999)) add(rowNumber, 'date', 'year must be an integer from 1 to 9999.');
    if (spec.mode === 'holiday' && !realDate(row.validTo)) add(rowNumber, 'date', 'A holiday publication needs its closing date.');
    if (!realDate(row.validFrom)) { add(rowNumber, 'date', 'validFrom is not a real ISO date.'); return; }
    if (row.validTo !== undefined && row.validTo !== null && !realDate(row.validTo)) {
      add(rowNumber, 'date', 'validTo must be a real ISO date or an open end.'); return;
    }
    const end = typeof row.validTo === 'string' ? row.validTo : '9999-12-31';
    if (end < row.validFrom) { add(rowNumber, 'date', 'validTo precedes validFrom.'); return; }
    const key = JSON.stringify(identity);
    const group = intervals.get(key) || [];
    group.push({ start: row.validFrom, end, row: rowNumber });
    intervals.set(key, group);
  });
  for (const group of intervals.values()) {
    group.sort((a, b) => a.start.localeCompare(b.start) || a.row - b.row);
    let active = group[0];
    for (const current of group.slice(1)) {
      if (current.start <= active.end) add(current.row, 'overlap', 'Inclusive dates overlap row ' + active.row + ' in the same tax scope.');
      if (current.end > active.end) active = current;
    }
  }
  return problems;
}
