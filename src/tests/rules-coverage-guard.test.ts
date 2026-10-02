import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WORKSPACE_SCOPED_COLLECTIONS } from '../constants/collections';
import { documentTables, tablesWithRules } from './helpers/migrations';
import { LEDGER_COLLECTIONS } from '../lib/ledgerCollections';

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

  test('WORKSPACE_SCOPED_COLLECTIONS covers what the browser loads, and every entry is loaded or explained', () => {
    const ledgerContent = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useLedgerData.ts'), 'utf8');
    const loaded = new Set<string>(Object.values(LEDGER_COLLECTIONS).map(spec => spec.collection));
    for (const m of ledgerContent.matchAll(/collection\(db,\s*['"]([a-zA-Z0-9_]+)['"]\)/g)) loaded.add(m[1]);
    for (const m of ledgerContent.matchAll(/doc\(db,\s*['"]([a-zA-Z0-9_]+)['"]/g)) loaded.add(m[1]);

    const expectedScoped = Array.from(loaded).filter(c => c !== 'users' && c !== 'workspaces' && c !== 'auditLogs');
    const scopedSet = new Set<string>(WORKSPACE_SCOPED_COLLECTIONS);
    const missingFromScoped = expectedScoped.filter(c => !scopedSet.has(c));
    assert.deepStrictEqual(missingFromScoped, [],
      `Loaded collections missing from WORKSPACE_SCOPED_COLLECTIONS: ${missingFromScoped.join(', ')}`);
    // Workspace data the browser doesn't keep in the store (the purge still deletes it)
    const NOT_LOADED_BY_BROWSER: Record<string, string> = {
      periods: 'period close runs on the server (/periods routes)',
      invites: 'Team settings reads invites from the server',
      workspaceShards: 'server-side counters',
      billingLedgerTraces: 'written by the billing routes on the server',
      supportTickets: 'no screen reads them',
      supportMessages: 'no screen reads them',
    };
    const unexplained = WORKSPACE_SCOPED_COLLECTIONS.filter(c => !loaded.has(c) && !NOT_LOADED_BY_BROWSER[c]);
    assert.deepStrictEqual(unexplained, [],
      `WORKSPACE_SCOPED_COLLECTIONS entries the browser doesn't load and no reason given: ${unexplained.join(', ')}`);

    const withoutTable = WORKSPACE_SCOPED_COLLECTIONS.filter(c => !tables.has(c));
    assert.deepStrictEqual(withoutTable, [], `Scoped collections without a table: ${withoutTable.join(', ')}`);
  });
});
