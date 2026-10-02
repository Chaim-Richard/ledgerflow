/**
 * A store selector must return something that stays the same between reads. `useLedgerStore(s =>
 * s.transactions.filter(...))` makes a new array every time, so the store sees a change on every
 * read and React re-renders until it gives up: Income by Source crashed this way (L-158). Filter or
 * map in useMemo instead.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap(name => {
  const p = path.join(dir, name);
  if (fs.statSync(p).isDirectory()) return name === 'tests' ? [] : walk(p);
  return /\.(ts|tsx)$/.test(name) ? [p] : [];
});
// the selector body itself ends in .filter( / .map( ... (not a filter applied to what it returned)
const UNSTABLE = /use[A-Z]\w*Store\(\s*\(?\w+\)?\s*=>\s*(?:\([\w.?]+\s*(?:\|\||\?\?)\s*\[\]\)|[\w.?]+)\.(filter|map|slice|sort|concat|flatMap|reduce)\(/;

describe('store selectors', () => {
  test('no selector builds a new array (filter/map/sort/...) on every read', () => {
    const offenders: string[] = [];
    for (const f of walk('src')) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (UNSTABLE.test(line) && !/useShallow/.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    assert.deepEqual(offenders, []);
  });

  test('the pattern catches the old Income by Source selector', () => {
    assert.ok(UNSTABLE.test('const transactions = useLedgerStore(s => s.transactions.filter(isPostable));'));
    assert.ok(UNSTABLE.test('const xs = useLedgerStore(s => (s.invoices || []).map(i => i.id));'));
    assert.ok(!UNSTABLE.test('const transactions = useLedgerStore(s => s.transactions);'));
    assert.ok(!UNSTABLE.test('const accounts = useLedgerStore(s => s.accounts).filter(a => a.active);'));
  });
});
