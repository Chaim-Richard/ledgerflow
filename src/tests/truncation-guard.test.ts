import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Truncation Guard Suite (AA-05)', () => {
  test('every onSnapshot in useLedgerData carrying a limit() must record truncation', () => {
    const filePath = join(process.cwd(), 'src/hooks/useLedgerData.ts');
    const content = readFileSync(filePath, 'utf-8');

    // Find each onSnapshot call
    const lines = content.split('\n');
    let checkedCount = 0;
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.includes('onSnapshot(') && (line.includes('limit(') || lines.slice(i, i + 5).join(' ').includes('limit('))) {
        // Collect callback block until next handler or closing
        let block = '';
        let braceCount = 0;
        let started = false;
        for (let j = i; j < Math.min(i + 30, lines.length); j++) {
          block += lines[j] + '\n';
          if (lines[j].includes('{')) {
            braceCount += (lines[j].match(/{/g) || []).length;
            started = true;
          }
          if (lines[j].includes('}')) {
            braceCount -= (lines[j].match(/}/g) || []).length;
          }
          if (started && braceCount <= 0) {
            break;
          }
        }

        checkedCount++;
        const recordsTruncation =
          block.includes('setCollectionTruncated') ||
          block.includes('setIsDataTruncated');

        assert.ok(
          recordsTruncation,
          `onSnapshot carrying limit() at line ${i + 1} does not record truncation! Block:\n${block}`
        );
      }
      i++;
    }

    assert.ok(checkedCount >= 15, `Expected at least 15 onSnapshot listeners with limit() in useLedgerData.ts, found ${checkedCount}`);
  });

  test('static capped getDocs queries in useLedgerData also record truncation', () => {
    const filePath = join(process.cwd(), 'src/hooks/useLedgerData.ts');
    const content = readFileSync(filePath, 'utf-8');

    // Check slow-moving queries like taxRates, customTemplates, partners, autoRules, rulePatterns, dimensionNodes
    const staticCollections = ['taxRates', 'customTemplates', 'partners', 'autoRules', 'rulePatterns', 'dimensionNodes'];
    for (const coll of staticCollections) {
      assert.ok(
        content.includes(`setCollectionTruncated('${coll}'`),
        `Static query for ${coll} must record truncation via setCollectionTruncated`
      );
    }
  });
});
