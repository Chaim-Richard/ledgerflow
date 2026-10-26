/**
 * C-54/C-91: every registered report has either the shared ReportTableScroll fallback, an explicit
 * empty-state component/marker, or a written empty message with a next action. One relative import
 * level is followed for thin wrappers (for example A/R Aging → PartyAgingReportView). This is a
 * source-coverage guard, not proof that a particular runtime filter looks correct.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'src/config/registry.tsx');

function resolveImport(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

test('every registered report explains an empty result or has the shared fallback', () => {
  const registry = fs.readFileSync(registryPath, 'utf8');
  const start = registry.indexOf('export const REPORT_TABS_REGISTRY');
  assert.ok(start >= 0, 'report registry is present');
  const end = registry.indexOf("], 'reports')", start);
  assert.ok(end > start, 'report registry end is present');
  const section = registry.slice(start, end);
  const names = [...section.matchAll(/componentName:\s*'([^']+)'/g)].map(match => match[1]);
  assert.ok(names.length >= 100, `expected the full report registry, saw ${names.length}`);
  const imports = new Map([...registry.matchAll(/'([A-Za-z0-9_]+)':\s*lazy\(\(\) => import\('([^']+)'\)/g)]
    .map(match => [match[1], match[2]]));
  const missing: string[] = [];
  for (const name of names) {
    const spec = imports.get(name);
    if (!spec) { missing.push(`${name}: no component mapping`); continue; }
    const file = resolveImport(registryPath, spec);
    if (!file) { missing.push(`${name}: missing ${spec}`); continue; }
    const sources = [file];
    const first = fs.readFileSync(file, 'utf8');
    for (const importMatch of first.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const dependency = resolveImport(file, importMatch[1]);
      if (dependency && /\.tsx?$/.test(dependency) && !sources.includes(dependency)) sources.push(dependency);
    }
    const source = sources.map(candidate => fs.readFileSync(candidate, 'utf8')).join('\n');
    const automaticFallback = /ReportTableScroll/.test(source);
    const explicitState = /<ReportEmptyState|<EmptyState|emptyMessage=|data-report-empty-state/.test(source);
    const writtenEmptyMessage = /\b(No |Nothing |Choose |Select )/.test(source);
    const nextAction = /\b(Clear|Record|Add|Create|Choose|Check|Try|Refresh|Review|Set|Import|Connect|Open|Define|Mark|Post|Save|Adjust|Use)\b/i.test(source);
    if (!(automaticFallback || explicitState || (writtenEmptyMessage && nextAction))) {
      missing.push(`${name}: ${path.relative(root, file)}`);
    }
  }
  assert.deepEqual(missing, [], `reports without an empty-state path: ${missing.join(', ')}`);
});
