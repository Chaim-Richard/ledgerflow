/**
 * A-37 (tracker CG-01): owner-defined extra fields on customers, vendors and items — text, number,
 * date or a choice — shown in lists and exports. The definitions are the owner's; this module
 * validates them, coerces typed values, and turns them into the columns a list/CSV shows.
 *
 * The values are stored as the record's own metadata by the caller; nothing here touches money,
 * stock or posting. Pure.
 */

export type CustomFieldType = 'text' | 'number' | 'date' | 'choice';
export type CustomFieldEntity = 'customer' | 'vendor' | 'item';

export interface CustomFieldDef {
  id: string;
  entityType: CustomFieldEntity;
  /** the storage key inside the record's metadata (letters, digits, _ and -) */
  key: string;
  label: string;
  type: CustomFieldType;
  /** the allowed values for a choice field */
  choices?: string[];
  required?: boolean;
}

const KEY = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** A date that is also a real day (2026-13-01 is not). */
const isRealDate = (value: string) => {
  if (!YMD.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** Why these definitions cannot be saved, in plain words, or null when they can. */
export function customFieldProblem(defs: CustomFieldDef[]): string | null {
  const seen = new Set<string>();
  for (const def of defs) {
    if (!String(def.label || '').trim()) return 'Every field needs a name.';
    if (!KEY.test(def.key)) return `The key “${def.key}” must start with a letter and use letters, digits, - or _ (up to 40).`;
    const id = `${def.entityType}:${def.key.toLocaleLowerCase()}`;
    if (seen.has(id)) return `Two fields for the same record use the key “${def.key}”.`;
    seen.add(id);
    if (def.type === 'choice' && (!def.choices?.length || def.choices.some(c => !String(c).trim()))) {
      return `The choice field “${def.label}” needs at least one option.`;
    }
    if (def.type !== 'choice' && def.choices?.length) return `Only a choice field can list options (${def.label}).`;
  }
  return null;
}

/** Why this value cannot go into this field, in plain words, or null when it can. */
export function fieldValueProblem(def: CustomFieldDef, raw: unknown): string | null {
  const empty = raw === undefined || raw === null || String(raw).trim() === '';
  if (empty) return def.required ? `${def.label} is required.` : null;
  const value = String(raw).trim();
  if (def.type === 'number' && !Number.isFinite(Number(value))) return `${def.label} must be a number.`;
  if (def.type === 'date' && !isRealDate(value)) return `${def.label} must be a date (YYYY-MM-DD).`;
  if (def.type === 'choice' && !(def.choices || []).includes(value)) return `${def.label} must be one of: ${(def.choices || []).join(', ')}.`;
  if (value.length > 500) return `${def.label} can be up to 500 characters.`;
  return null;
}

/** The value as it is stored (a number for a number field, the text otherwise), or the refusal. */
export function coerceCustomField(def: CustomFieldDef, raw: unknown): { ok: true; value: string | number | undefined } | { ok: false; reason: string } {
  const problem = fieldValueProblem(def, raw);
  if (problem) return { ok: false, reason: problem };
  const text = String(raw ?? '').trim();
  if (!text) return { ok: true, value: undefined };
  return { ok: true, value: def.type === 'number' ? Number(text) : text };
}

/** One record's values for the fields of its type: label, value, and whether it is set. */
export function customFieldValues(defs: CustomFieldDef[], entityType: CustomFieldEntity, values: Record<string, unknown> = {}): Array<{ def: CustomFieldDef; value: string | number | undefined }> {
  return defs.filter(d => d.entityType === entityType).map(def => {
    const raw = values[def.key];
    const coerced = coerceCustomField(def, raw);
    return { def, value: coerced.ok ? coerced.value : undefined };
  });
}

/** The columns a list or an export adds for one entity type, in the owner's order. */
export function customFieldColumns(defs: CustomFieldDef[], entityType: CustomFieldEntity): Array<{ key: string; label: string }> {
  return defs.filter(d => d.entityType === entityType).map(d => ({ key: d.key, label: d.label }));
}

export const CUSTOM_FIELD_CSV_HEADERS = (defs: CustomFieldDef[], entityType: CustomFieldEntity) => customFieldColumns(defs, entityType).map(c => c.label);

/** The CSV cells for one record, in the same order as the headers. */
export function customFieldCsvRow(defs: CustomFieldDef[], entityType: CustomFieldEntity, values: Record<string, unknown> = {}): Array<string | number> {
  return customFieldValues(defs, entityType, values).map(({ value }) => (value === undefined ? '' : value));
}

/**
 * Why a new value cannot replace the old one, respecting required fields: clearing a required
 * field is refused, and the rest of the record's values are untouched.
 */
export function customFieldRequiredProblem(defs: CustomFieldDef[], entityType: CustomFieldEntity, values: Record<string, unknown>): string | null {
  for (const def of defs.filter(d => d.entityType === entityType && d.required)) {
    const problem = fieldValueProblem(def, values[def.key]);
    if (problem) return problem;
  }
  return null;
}
