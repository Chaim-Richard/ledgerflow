import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WORKSPACE_SCOPED_COLLECTIONS } from '../constants/collections';

describe('Firestore Rules Coverage Structural Guard (P-1)', () => {
  test('Every subscribed and protected collection has a dedicated rule block in firestore.rules without duplicates', () => {
    const rulesPath = path.join(process.cwd(), 'firestore.rules');
    const ledgerPath = path.join(process.cwd(), 'src/hooks/useLedgerData.ts');

    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    const ledgerContent = fs.readFileSync(ledgerPath, 'utf8');

    // 1. Parse SUBSCRIBED collections from src/hooks/useLedgerData.ts
    const subscribedCollections = new Set<string>();
    const collRegex = /collection\(db,\s*['"]([a-zA-Z0-9_]+)['"]\)/g;
    let match: RegExpExecArray | null;
    while ((match = collRegex.exec(ledgerContent)) !== null) {
      subscribedCollections.add(match[1]);
    }
    // Also include document listeners like doc(db, 'users', ...)
    const docRegex = /doc\(db,\s*['"]([a-zA-Z0-9_]+)['"]/g;
    while ((match = docRegex.exec(ledgerContent)) !== null) {
      subscribedCollections.add(match[1]);
    }

    // 2. Parse HAS_BLOCK from firestore.rules (match /collectionName/{id})
    const blockRegex = /match\s+\/([a-zA-Z0-9_]+)\/\{/g;
    const hasBlockList: string[] = [];
    while ((match = blockRegex.exec(rulesContent)) !== null) {
      const coll = match[1];
      if (coll !== 'databases') {
        hasBlockList.push(coll);
      }
    }
    const hasBlockSet = new Set(hasBlockList);

    // 3. Parse PROTECTED collections from isProtectedCollection in firestore.rules
    const protMatch = rulesContent.match(/function\s+isProtectedCollection\(name\)\s*\{\s*return\s+name\s+in\s+(\[[^\]]+\]);/);
    assert.ok(protMatch, 'isProtectedCollection helper function must be defined in firestore.rules');
    const protectedCollections: string[] = JSON.parse(protMatch[1]);
    const protectedSet = new Set(protectedCollections);

    // 4. ASSERT: no collection appears in HAS_BLOCK twice
    const seenBlocks = new Set<string>();
    const duplicateBlocks: string[] = [];
    for (const coll of hasBlockList) {
      if (seenBlocks.has(coll)) {
        duplicateBlocks.push(coll);
      }
      seenBlocks.add(coll);
    }
    assert.deepStrictEqual(duplicateBlocks, [], `Duplicate collection rule blocks found in firestore.rules: ${duplicateBlocks.join(', ')}`);

    // 5. ASSERT: every SUBSCRIBED collection is in HAS_BLOCK
    const missingSubscribed = Array.from(subscribedCollections).filter(c => !hasBlockSet.has(c));
    assert.deepStrictEqual(
      missingSubscribed,
      [],
      `Subscribed collections in useLedgerData.ts missing dedicated rules block in firestore.rules: ${missingSubscribed.join(', ')}`
    );

    // 6. ASSERT: every PROTECTED collection is in HAS_BLOCK (protected + no block = total lockout)
    const missingProtected = protectedCollections.filter(c => !hasBlockSet.has(c));
    assert.deepStrictEqual(
      missingProtected,
      [],
      `Protected collections in isProtectedCollection() missing dedicated rules block (TOTAL LOCKOUT): ${missingProtected.join(', ')}`
    );

    // 7. ASSERT: every SUBSCRIBED collection is in isProtectedCollection()
    const missingSubscribedFromProtected = Array.from(subscribedCollections).filter(c => !protectedSet.has(c));
    assert.deepStrictEqual(
      missingSubscribedFromProtected,
      [],
      `Subscribed collections in useLedgerData.ts missing from isProtectedCollection() in firestore.rules: ${missingSubscribedFromProtected.join(', ')}`
    );

    // 8. ASSERT: WORKSPACE_SCOPED_COLLECTIONS in src/constants/collections.ts matches subscribed collections in useLedgerData.ts
    const scopedSet = new Set(WORKSPACE_SCOPED_COLLECTIONS);
    const expectedScoped = Array.from(subscribedCollections).filter(c => c !== 'users' && c !== 'workspaces' && c !== 'auditLogs');

    const missingFromScoped = expectedScoped.filter(c => !scopedSet.has(c as any));
    assert.deepStrictEqual(
      missingFromScoped,
      [],
      `Subscribed collections in useLedgerData.ts missing from WORKSPACE_SCOPED_COLLECTIONS in src/constants/collections.ts: ${missingFromScoped.join(', ')}`
    );
  });
});
