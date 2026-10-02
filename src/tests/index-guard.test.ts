import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { hasWorkspaceFieldIndex, migrationsSql } from './helpers/migrations';
import { LEDGER_COLLECTIONS } from '../lib/ledgerCollections';

describe('Database index guard', () => {
  test('every ordered workspace list the browser loads has a (workspace_id, field) index', () => {
    const sql = migrationsSql();
    const required = Object.values(LEDGER_COLLECTIONS)
      .filter(spec => 'newestFirstBy' in spec && spec.newestFirstBy)
      .map(spec => ({ collection: spec.collection, field: (spec as { newestFirstBy: string }).newestFirstBy }));
    assert.ok(required.length > 0, 'Should find at least some ordered lists');
    for (const req of required) {
      assert.ok(hasWorkspaceFieldIndex(req.collection, req.field, sql),
        `Missing index on ${req.collection} (workspace_id, (data->>'${req.field}')) in supabase/migrations`);
    }
  });
});
