import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLcov, totals } from './coverage-merge.mjs';

// Two shards loaded the same file: a line, branch or function counts as covered when either shard covered it.
const shard1 = `TN:
SF:src/a.ts
FN:1,f
FN:5,(anonymous)
FN:9,(anonymous)
FNDA:1,f
FNDA:0,(anonymous)
FNDA:0,(anonymous)
BRDA:2,0,0,1
BRDA:2,0,1,0
DA:1,1
DA:2,1
DA:3,0
DA:5,0
LF:10
end_of_record
`;
const shard2 = `TN:
SF:src/a.ts
FN:1,f
FN:5,(anonymous)
FN:9,(anonymous)
FNDA:0,f
FNDA:0,(anonymous)
FNDA:2,(anonymous)
BRDA:2,0,0,0
BRDA:2,0,1,-
DA:1,0
DA:2,0
DA:3,4
DA:5,0
LF:10
end_of_record
SF:src/b.ts
FNDA:1,g
DA:1,1
LF:1
end_of_record
`;

test('a shard alone: lines without a DA record count as covered, as Node counts them', () => {
  const t = totals(parseLcov(shard1));
  assert.deepEqual([t.lines.covered, t.lines.total], [8, 10], '10 lines, 2 with zero hits');
  assert.deepEqual([t.branches.covered, t.branches.total], [1, 2]);
  assert.deepEqual([t.functions.covered, t.functions.total], [1, 3]);
});

test('merged: covered in any shard is covered; the two anonymous functions stay two', () => {
  const files = parseLcov(shard2, parseLcov(shard1));
  const t = totals(files);
  assert.deepEqual([t.lines.covered, t.lines.total], [9 + 1, 11], 'only line 5 uncovered; b.ts adds one covered line');
  assert.deepEqual([t.branches.covered, t.branches.total], [1, 2], "'-' (never reached) is not covered");
  assert.deepEqual([t.functions.covered, t.functions.total], [3, 4], 'f from shard 1, the second anonymous from shard 2, g');
});

test('the thresholds in "coverage:gate" are the same as the single run\'s in "test:cov"', async () => {
  const { default: pkg } = await import('../package.json', { with: { type: 'json' } });
  for (const kind of ['lines', 'branches', 'functions']) {
    const single = new RegExp(`--test-coverage-${kind}=(\\d+)`).exec(pkg.scripts['test:cov'])?.[1];
    const gate = new RegExp(`--${kind}=(\\d+)`).exec(pkg.scripts['coverage:gate'])?.[1];
    assert.ok(single, `test:cov sets ${kind}`);
    assert.equal(gate, single, `${kind}: coverage:gate ${gate} vs test:cov ${single}`);
  }
});

test('the same branch numbered differently in two shards is one branch (Node numbers blocks per run)', () => {
  // shard A ran the function on line 21; shard B did not, so its line-22 branch got block number 2 instead of 3
  const a = 'SF:src/c.ts\nBRDA:1,0,0,5\nBRDA:21,2,0,0\nBRDA:22,3,0,0\nBRDA:22,3,1,4\nend_of_record\n';
  const b = 'SF:src/c.ts\nBRDA:1,0,0,5\nBRDA:22,2,0,7\nBRDA:22,2,1,0\nend_of_record\n';
  const t = totals(parseLcov(b, parseLcov(a)));
  assert.deepEqual([t.branches.covered, t.branches.total], [3, 4], 'lines 1, 21, 22 (two branches): both of line 22 covered across the shards');
});
