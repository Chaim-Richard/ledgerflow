/**
 * Reads the database definition (supabase/migrations/*.sql) for the structural guard tests:
 * which collections have a table, their per-table rules (lf_rules rows) and indexes.
 */
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

export function migrationsSql(): string {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');
}

function quotedNames(list: string): string[] {
  return Array.from(list.matchAll(/'([A-Za-z_][A-Za-z0-9_]*)'/g), m => m[1]);
}

/** Every document table (one per collection), from the all_tables list in the init migration. */
export function documentTables(sql = migrationsSql()): string[] {
  const m = sql.match(/all_tables text\[\] := array\[([\s\S]*?)\];/);
  if (!m) throw new Error('all_tables list not found in supabase/migrations');
  return quotedNames(m[1]);
}

/** Tables that have an lf_rules row (the guard trigger refuses browser writes on any other table). */
export function tablesWithRules(sql = migrationsSql()): string[] {
  const names = new Set<string>();
  for (const block of sql.matchAll(/insert into public\.lf_rules[^;]*;/g)) {
    for (const row of block[0].matchAll(/\(\s*'([A-Za-z_][A-Za-z0-9_]*)'/g)) names.add(row[1]);
    const unnest = block[0].match(/unnest\(array\[([\s\S]*?)\]\)/);
    if (unnest) quotedNames(unnest[1]).forEach(n => names.add(n));
  }
  return Array.from(names);
}

/** The first and second '{...}' arrays of a table's lf_rules row: allowed keys and immutable keys. */
export function ruleArrays(table: string, sql = migrationsSql()): { allowed: string[]; immutable: string[] } {
  const row = sql.match(new RegExp(`\\(\\s*'${table}'\\s*,\\s*'\\{([^}]*)\\}'(?:\\s*,\\s*'\\{([^}]*)\\}')?`));
  if (!row) return { allowed: [], immutable: [] };
  const split = (s?: string) => (s ? s.split(',').map(k => k.trim()).filter(Boolean) : []);
  return { allowed: split(row[1]), immutable: split(row[2]) };
}

/** True when an index covers (workspace_id, (data->>'field')) on the table. */
export function hasWorkspaceFieldIndex(table: string, field: string, sql = migrationsSql()): boolean {
  const quoted = table === table.toLowerCase() ? `(?:"${table}"|${table})` : `"${table}"`;
  const re = new RegExp(`create index[^;]*on public\\.${quoted}\\s*\\(\\s*workspace_id\\s*,\\s*\\(data->>'${field}'\\)\\s*\\)`, 'i');
  return re.test(sql);
}
