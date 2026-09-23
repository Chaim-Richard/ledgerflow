import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { formatCurrency } from '../lib/utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function scanDirForPattern(dir: string, pattern: RegExp, extensions: string[]): { file: string; line: number; match: string }[] {
  const results: { file: string; line: number; match: string }[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'tests') {
        results.push(...scanDirForPattern(fullPath, pattern, extensions));
      }
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          results.push({
            file: fullPath,
            line: index + 1,
            match: line.trim()
          });
        }
      });
    }
  }

  return results;
}

describe('Money Format Guard', () => {
  it('formats cents correctly without double division (123456 -> $1,234.56)', () => {
    // formatCurrency expects cents
    assert.equal(formatCurrency(123456, 'USD'), '$1,234.56');
    assert.equal(formatCurrency(0, 'USD'), '$0.00');
    assert.equal(formatCurrency(100, 'USD'), '$1.00');
    assert.equal(formatCurrency(50, 'USD'), '$0.50');
  });

  it('ensures no src components call formatCurrency with / 100', () => {
    const srcDir = path.resolve(__dirname, '../components');
    // Pattern to catch formatCurrency with division by 100
    const pattern = /formatCurrency\([^)]*\/\s*100/;
    const violations = scanDirForPattern(srcDir, pattern, ['.ts', '.tsx']);

    assert.deepStrictEqual(violations, []);
  });
});
