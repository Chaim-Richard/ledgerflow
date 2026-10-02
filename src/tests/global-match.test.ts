/**
 * Reconciliation matching (findGlobalOptimalMatch, Hungarian algorithm). It used to hang on a
 * single strong match (its arrays were one element short; found by Codex during C-4). Each case
 * must finish quickly and pick the assignment with the largest total score, compared with
 * brute force on small inputs.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { findGlobalOptimalMatch } from '../lib/algorithms';

type Source = { id: string; scoreMap: Map<string, number> };
const source = (id: string, scores: Record<string, number>): Source => ({ id, scoreMap: new Map(Object.entries(scores)) });
const total = (sources: Source[], matches: Map<string, string>) =>
  [...matches].reduce((s, [src, tgt]) => s + (sources.find(x => x.id === src)!.scoreMap.get(tgt) || 0), 0);

/** Best total over every way to give each source at most one distinct target. */
function bruteForce(sources: Source[], targets: string[]): number {
  let best = 0;
  const walk = (i: number, usedTargets: Set<string>, sum: number) => {
    if (i === sources.length) { best = Math.max(best, sum); return; }
    walk(i + 1, usedTargets, sum); // leave this one unmatched
    for (const t of targets) {
      if (usedTargets.has(t)) continue;
      const w = sources[i].scoreMap.get(t) || 0;
      if (w <= 0) continue;
      usedTargets.add(t);
      walk(i + 1, usedTargets, sum + w);
      usedTargets.delete(t);
    }
  };
  walk(0, new Set(), 0);
  return best;
}

describe('Reconciliation matching', { timeout: 5000 }, () => {
  test('one strong match (used to hang)', () => {
    const matches = findGlobalOptimalMatch([source('bank', { ledger: 195 })], ['ledger']);
    assert.deepEqual([...matches], [['bank', 'ledger']]);
  });

  test('takes the best total, not the greedy first pick', () => {
    // greedy would give a→x (90) and leave b with nothing; best is a→y + b→x = 80 + 85
    const sources = [source('a', { x: 90, y: 80 }), source('b', { x: 85 })];
    const matches = findGlobalOptimalMatch(sources, ['x', 'y']);
    assert.equal(matches.get('a'), 'y');
    assert.equal(matches.get('b'), 'x');
  });

  test('more sources than targets and the other way round; zero scores are not matches', () => {
    const many = [source('a', { x: 10 }), source('b', { x: 30 }), source('c', {})];
    assert.deepEqual([...findGlobalOptimalMatch(many, ['x'])], [['b', 'x']]);
    const few = findGlobalOptimalMatch([source('a', { x: 5, y: 7, z: 0 })], ['x', 'y', 'z']);
    assert.deepEqual([...few], [['a', 'y']]);
    assert.equal(findGlobalOptimalMatch([source('a', { x: 0 })], ['x']).size, 0);
  });

  test('optimal on random inputs (brute force check), every target used once', () => {
    let seed = 7;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let round = 0; round < 200; round++) {
      const n = 1 + Math.floor(rand() * 5);
      const m = 1 + Math.floor(rand() * 5);
      const targets = Array.from({ length: m }, (_, j) => `t${j}`);
      const sources = Array.from({ length: n }, (_, i) => source(`s${i}`, Object.fromEntries(
        targets.filter(() => rand() < 0.7).map(t => [t, Math.floor(rand() * 200)]),
      )));
      const matches = findGlobalOptimalMatch(sources, targets);
      assert.equal(new Set(matches.values()).size, matches.size, 'a target is used twice');
      assert.equal(total(sources, matches), bruteForce(sources, targets), `round ${round}`);
    }
  });
});
