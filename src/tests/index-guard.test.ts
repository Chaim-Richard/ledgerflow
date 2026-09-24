import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasWorkspaceFieldIndex, migrationsSql } from './helpers/migrations';

describe('Database index guard', () => {
  test('every ordered workspace list in useLedgerData.ts has a (workspace_id, field) index', () => {
    const hookSource = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useLedgerData.ts'), 'utf-8');
    const sql = migrationsSql();
    const required: { collection: string; field: string }[] = [];
    for (const line of hookSource.split('\n')) {
      if (line.includes('collection(db,') && line.includes('orderBy(') && line.includes('...filter')) {
        const coll = line.match(/collection\(db,\s*'([^']+)'\)/);
        const order = line.match(/orderBy\('([^']+)'/);
        if (coll && order) required.push({ collection: coll[1], field: order[1] });
      }
    }
    assert.ok(required.length > 0, 'Should find at least some ordered queries');
    for (const req of required) {
      assert.ok(hasWorkspaceFieldIndex(req.collection, req.field, sql),
        `Missing index on ${req.collection} (workspace_id, (data->>'${req.field}')) in supabase/migrations`);
    }
  });
});
