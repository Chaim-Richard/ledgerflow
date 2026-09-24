import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WORKSPACE_SCOPED_COLLECTIONS } from '../constants/collections';
import { documentTables, tablesWithRules } from './helpers/migrations';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'tests' && entry.name !== 'node_modules') sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('Database coverage guard (every collection has a table and access rules)', () => {
  const tables = new Set(documentTables());
  const withRules = new Set(tablesWithRules());

  test('every collection the browser or server uses has a table in supabase/migrations', () => {
    const used = new Set<string>();
    const files = [...sourceFiles(path.join(process.cwd(), 'src')), path.join(process.cwd(), 'server.ts')];
    const patterns = [
      /collection\(db,\s*['"]([a-zA-Z0-9_]+)['"]/g,
      /doc\(db,\s*['"]([a-zA-Z0-9_]+)['"]/g,
      /\.collection\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g,
      /\.collectionGroup\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g,
    ];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const re of patterns) {
        for (const m of text.matchAll(re)) used.add(m[1]);
      }
    }
    assert.ok(used.size > 20, 'should find the collections used by the app');
    const missing = Array.from(used).filter(c => !tables.has(c)).sort();
    assert.deepStrictEqual(missing, [], `Collections without a table (add them to supabase/migrations): ${missing.join(', ')}`);
  });

  test('every table has an lf_rules row (browser writes are refused without one)', () => {
    const missing = Array.from(tables).filter(t => !withRules.has(t)).sort();
    assert.deepStrictEqual(missing, [], `Tables without lf_rules rows: ${missing.join(', ')}`);
  });

  test('WORKSPACE_SCOPED_COLLECTIONS matches the collections useLedgerData subscribes to', () => {
    const ledgerContent = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useLedgerData.ts'), 'utf8');
    const subscribed = new Set<string>();
    for (const m of ledgerContent.matchAll(/collection\(db,\s*['"]([a-zA-Z0-9_]+)['"]\)/g)) subscribed.add(m[1]);
    for (const m of ledgerContent.matchAll(/doc\(db,\s*['"]([a-zA-Z0-9_]+)['"]/g)) subscribed.add(m[1]);

    const expectedScoped = Array.from(subscribed).filter(c => c !== 'users' && c !== 'workspaces' && c !== 'auditLogs');
    const scopedSet = new Set<string>(WORKSPACE_SCOPED_COLLECTIONS);
    const missingFromScoped = expectedScoped.filter(c => !scopedSet.has(c));
    assert.deepStrictEqual(missingFromScoped, [],
      `Subscribed collections missing from WORKSPACE_SCOPED_COLLECTIONS: ${missingFromScoped.join(', ')}`);
    const expectedSet = new Set(expectedScoped);
    const missingFromSubscribed = WORKSPACE_SCOPED_COLLECTIONS.filter(c => !expectedSet.has(c));
    assert.deepStrictEqual(missingFromSubscribed, [],
      `WORKSPACE_SCOPED_COLLECTIONS entries missing from useLedgerData.ts subscriptions: ${missingFromSubscribed.join(', ')}`);

    const withoutTable = WORKSPACE_SCOPED_COLLECTIONS.filter(c => !tables.has(c));
    assert.deepStrictEqual(withoutTable, [], `Scoped collections without a table: ${withoutTable.join(', ')}`);
  });
});
