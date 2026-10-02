/**
 * lineAmount(line, tx) already returns the base-currency amount (it applies the line's or the
 * entry's exchange rate). Multiplying its result by a rate again overstated foreign-currency
 * entries in the Pivot Sheet and its export (L-153). This guard fails on `lineAmount(...) * …`.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap(name => {
  const p = path.join(dir, name);
  if (fs.statSync(p).isDirectory()) return name === 'tests' || name === 'node_modules' ? [] : walk(p);
  return /\.(ts|tsx)$/.test(name) ? [p] : [];
});

// a lineAmount(...) call (one level of nested parentheses), optionally `|| 0` and a closing
// parenthesis, followed by `*`
const MULTIPLIED = /lineAmount\((?:[^()]|\([^()]*\))*\)(?:\s*\|\|\s*0)?\s*\)?\s*\*/;

describe('lineAmount is never converted twice', () => {
  test('no lineAmount(...) result is multiplied by a rate', () => {
    const offenders: string[] = [];
    for (const file of [...walk('src'), 'server.ts']) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (MULTIPLIED.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    assert.deepEqual(offenders, []);
  });

  test('the pattern catches the old Pivot Sheet line and leaves plain sums alone', () => {
    assert.ok(MULTIPLIED.test('const c = Math.round((lineAmount(line, t) || 0) * txRate);'));
    assert.ok(MULTIPLIED.test('formatDecimal(Math.round((lineAmount(l, t) || 0) * (t.exchangeRate || 1)))'));
    assert.ok(!MULTIPLIED.test('.reduce((s, l) => s + Math.abs(lineAmount(l, tx)), 0) || Math.abs(Math.round((tx.totalAmountCents || 0) * (tx.exchangeRate || 1)));'));
    assert.ok(!MULTIPLIED.test('const amt = lineAmount(l, t);'));
  });
});
