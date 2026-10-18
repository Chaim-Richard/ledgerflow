import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TAX_TABLES, NON_TABLE_MODULES } from './tax-table-catalog';
import { normalizeRows, validateTable, type Problem } from './tax-table-validation';

const TAX_DIRECTORY = new URL('../src/lib/tax/', import.meta.url);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
/** Public structured constants carrying legal facts must have a declared table contract. */
export function looksLikeTaxTable(value: unknown): boolean {
  const rows = Array.isArray(value) ? value : record(value) ? [value, ...Object.values(value)] : [];
  return rows.some(row => record(row) && ['validFrom', 'validTo', 'source', 'rate', 'ratePercent', 'percent', 'thresholdCents', 'from', 'socialSecurityWageBaseCents'].some(key => key in row));
}
export async function checkTaxTables(directory: URL = TAX_DIRECTORY) {
  const files = (await readdir(directory)).filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts')).sort();
  const problems: Problem[] = [];
  const declarations = new Set([...TAX_TABLES.map(table => table.file), ...Object.keys(NON_TABLE_MODULES)]);
  for (const file of declarations) if (!files.includes(file)) problems.push({ table: file, row: 0, rule: 'discovery', message: 'Declared module no longer exists; reconcile the catalog.' });
  let rowCount = 0;
  for (const file of files) {
    if (!declarations.has(file)) problems.push({ table: file, row: 0, rule: 'discovery', message: 'New tax module needs table contracts or an explicit non-table reason.' });
    const exported = await import(new URL(file, directory).href) as Record<string, unknown>;
    const specs = TAX_TABLES.filter(table => table.file === file);
    for (const spec of specs) {
      problems.push(...validateTable(spec, exported[spec.name]));
      rowCount += normalizeRows(spec, exported[spec.name]).length;
    }
    for (const [name, value] of Object.entries(exported)) {
      if (looksLikeTaxTable(value) && !specs.some(spec => spec.name === name)) {
        problems.push({ table: file + ':' + name, row: 0, rule: 'discovery', message: 'Structured tax export needs an explicit identity, date and unit contract.' });
      }
    }
  }
  return { files: files.length, tables: TAX_TABLES.length, rows: rowCount, problems };
}
async function main() {
  const result = await checkTaxTables();
  for (const problem of result.problems) console.error(problem.table + ' row ' + problem.row + ' [' + problem.rule + '] ' + problem.message);
  console.log('Tax table structure: ' + result.files + ' modules, ' + result.tables + ' tables, ' + result.rows + ' rows, ' + result.problems.length + ' problems.');
  console.log('Structure checks do not verify legal correctness, source availability or jurisdiction readiness.');
  if (result.problems.length) process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
