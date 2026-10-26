/**
 * Independent audit Pass A — AF-001 durable bank cursor.
 * The route's pagination helper (syncAllPages) already has executable tests in
 * plaid-sync-cursor.test.ts. This test pins the DURABILITY CONTRACT around it: the /sync route
 * advances syncCursor in the banks document while the route itself never writes bankLines, and
 * neither browser caller persists the returned added/modified/removed rows on the "Sync Feed"
 * path. When server-side durable ingestion is implemented (the fix, owned by AI #1), these
 * assertions must change deliberately and this audit entry closed.
 * Evidence: audit/function-audit/AF-001-bank-cursor-durability.md
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('AF-001-F1: /sync persists syncCursor but the route writes no bankLines', () => {
  const route = read('src/server/routes/plaidRoutes.ts');
  // the cursor is advanced inside the per-bank success update, before the HTTP response is sent
  assert.match(route, /syncCursor:\s*nextCursor/, 'cursor advancement still present');
  assert.match(route, /doc\.ref\.update\(\{[\s\S]*syncCursor/, 'cursor saved in the banks doc update');
  // no durable ingestion of the downloaded rows exists in the route
  assert.equal(/collection\(["']bankLines["']\)/.test(route), false, 'route must not write bankLines until durable ingestion exists');
  assert.equal(/bankLines/.test(route), false, 'no bankLines reference at all in the plaid route today');
});

test('AF-001-F2: the Banking screen "Sync Feed" path never persists returned rows', () => {
  const banking = read('src/components/banking/Banking.tsx');
  assert.match(banking, /fetch\('\/api\/v1\/plaid\/sync'/, 'the sync call exists');
  // the payload fields exist in the response but only toasts are derived from them
  assert.equal(/data\.transactions|data\.modified|data\.removed/.test(banking), false,
    'OBSERVED GAP: returned added/modified/removed rows are not consumed or persisted on this screen');
});

test('AF-001-F3: the legacy feed importer ignores modified/removed and only stages added rows for review', () => {
  const importer = read('src/components/ledger/BankFeedImport.tsx');
  assert.match(importer, /fetch\('\/api\/v1\/plaid\/sync'/, 'the importer calls sync');
  assert.match(importer, /data\.transactions\s*\|\|\s*\[\]/, 'only added rows are mapped into the review list');
  assert.equal(/data\.modified|data\.removed/.test(importer), false,
    'OBSERVED GAP: bank-side modifications and deletions are never applied');
  assert.match(importer, /accountId:\s*'offset-bank'/, 'legacy importer still emits the hardcoded offset-bank account id');
});

test('AF-001-F4: a healthy sync with zero changes still reports success:false in the JSON contract', () => {
  const route = read('src/server/routes/plaidRoutes.ts');
  assert.match(route, /success:\s*transactions\.length\s*>\s*0/,
    'OBSERVED CONTRACT: zero-change sync responds success:false even though the cursor advanced fine');
});
