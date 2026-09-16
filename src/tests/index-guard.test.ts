import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Firestore Indexes Structural Guard (Task 2)', () => {
  test('Every ordered query in useLedgerData.ts has a matching composite index', () => {
    const hookSource = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useLedgerData.ts'), 'utf-8');
    const indexesSource = fs.readFileSync(path.join(process.cwd(), 'firestore.indexes.json'), 'utf-8');
    const indexesJson = JSON.parse(indexesSource);

    // Regex to find queries like: query(collection(db, 'X'), ...filter, orderBy('Y', 'desc'))
    // Note: filter is where('workspaceId', '==', workspaceId)
    
    // We can do this simpler by just matching the lines
    const lines = hookSource.split('\n');
    
    const requiredIndexes: { collection: string; field: string; }[] = [];

    for (const line of lines) {
      if (line.includes('collection(db,') && line.includes('orderBy(') && line.includes('...filter')) {
        const collMatch = line.match(/collection\(db,\s*'([^']+)'\)/);
        const orderMatch = line.match(/orderBy\('([^']+)'/);
        
        if (collMatch && orderMatch) {
          requiredIndexes.push({
            collection: collMatch[1],
            field: orderMatch[1]
          });
        }
      }
    }

    assert.ok(requiredIndexes.length > 0, 'Should find at least some ordered queries');

    for (const req of requiredIndexes) {
      // Find matching index
      const matchingIndex = indexesJson.indexes.find((idx: any) => {
        if (idx.collectionGroup !== req.collection) return false;
        if (idx.queryScope !== 'COLLECTION') return false;
        
        // Needs exactly workspaceId and the order field
        const hasWorkspaceId = idx.fields.some((f: any) => f.fieldPath === 'workspaceId');
        const hasOrderField = idx.fields.some((f: any) => f.fieldPath === req.field);
        
        return hasWorkspaceId && hasOrderField;
      });

      assert.ok(
        matchingIndex, 
        `Missing composite index for collection '${req.collection}' on fields ['workspaceId', '${req.field}'] in firestore.indexes.json`
      );
    }
  });
});
