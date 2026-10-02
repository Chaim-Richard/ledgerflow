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

  it('signed amounts say the direction in text, not only colour (E-26)', async () => {
    const { formatSignedAmount } = await import('../lib/utils');
    assert.equal(formatSignedAmount(150000, 'in', 'USD'), '+$1,500.00');
    assert.equal(formatSignedAmount(-2550, 'out', 'USD'), '\u2212$25.50');
    assert.equal(formatSignedAmount(2550, 'none', 'USD'), '$25.50');
  });

  it('ensures no src components call formatCurrency with / 100', () => {
    const srcDir = path.resolve(__dirname, '../components');
    // Pattern to catch formatCurrency with division by 100
    const pattern = /formatCurrency\([^)]*\/\s*100/;
    const violations = scanDirForPattern(srcDir, pattern, ['.ts', '.tsx']);

    assert.deepStrictEqual(violations, []);
  });

  it('no screen formats cents by hand with toLocaleString (use formatCurrency: workspace currency, right decimals)', () => {
    const srcDir = path.resolve(__dirname, '../components');
    const violations = scanDirForPattern(srcDir, /\/\s*100\)\.toLocaleString\(/, ['.tsx']);
    assert.deepStrictEqual(violations, []);
  });

  it('no text puts a literal $ before cents divided by 100 (template text or JSX)', () => {
    const srcDir = path.resolve(__dirname, '../components');
    // the admin panel's platform quotas are billed in US dollars
    const allowed = new Set(['SystemCommandCenter.tsx']);
    const pattern = /\$\$\{[^}]*\/\s*100\b|(^|[^$\w`])\$\{\(+[^}]*\/\s*100\)\.to(Fixed|LocaleString)/;
    const violations = scanDirForPattern(srcDir, pattern, ['.tsx']).filter(v => !allowed.has(path.basename(v.file)));
    assert.deepStrictEqual(violations, []);
  });

  it('no screen prints a hard-coded $ in front of its own division by 100 (workspace currency ignored)', () => {
    const srcDir = path.resolve(__dirname, '../components');
    // JSX like  ${(amountCents / 100).toFixed(2)}  — a literal dollar sign, then cents turned into units by hand
    const pattern = /(^|[^`])\$\{\(?[A-Za-z_][A-Za-z0-9_.?]*\s*\/\s*100\b/;
    const violations = scanDirForPattern(srcDir, pattern, ['.tsx']).filter(v => !v.match.includes('`'));
    assert.deepStrictEqual(violations, []);
  });
});
