/**
 * Sparse fieldsets for API reads (Z-04): `?fields=date,description,totalAmountCents` returns only
 * those fields of each record (and always its `id`), so a client that needs three fields does not
 * download whole entries. A field may name one level inside an object (`metadata.invoiceId`).
 */
export class FieldsError extends Error {}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;
const MAX_FIELDS = 50;

/** The fields asked for, or null when the request asks for whole records. */
export function parseFields(raw: unknown): string[] | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const list = String(Array.isArray(raw) ? raw.join(',') : raw).split(',').map(f => f.trim()).filter(Boolean);
  if (list.length === 0) return null;
  if (list.length > MAX_FIELDS) throw new FieldsError(`Ask for at most ${MAX_FIELDS} fields`);
  const bad = list.find(f => !NAME.test(f));
  if (bad) throw new FieldsError(`"${bad.slice(0, 60)}" is not a field name`);
  return [...new Set(list)];
}

/** Each record with only the fields asked for (and its id); a field a record lacks is left out. */
export function pickFields<T extends Record<string, unknown>>(records: T[], fields: string[] | null): Array<Record<string, unknown>> {
  if (!fields) return records;
  return records.map(record => {
    const out: Record<string, unknown> = { id: record.id };
    for (const field of fields) {
      const [top, inner] = field.split('.');
      if (!(top in record)) continue;
      if (!inner) { out[top] = record[top]; continue; }
      const value = record[top];
      if (value && typeof value === 'object' && !Array.isArray(value) && inner in (value as Record<string, unknown>)) {
        out[top] = { ...((out[top] as Record<string, unknown>) || {}), [inner]: (value as Record<string, unknown>)[inner] };
      }
    }
    return out;
  });
}
