// Coverage across unit-test shards (audit 22 Oct, §7.1): each shard writes an lcov file
// (node --test --experimental-test-coverage --test-reporter=lcov); this merges them — a line, branch or
// function counts as covered when any shard covered it — and applies the same thresholds the single run
// applied (--test-coverage-lines/branches/functions in package.json "test:cov").
//
//   node scripts/coverage-merge.mjs --lines=75 --branches=72 --functions=73 coverage/shard-*.lcov
//
// Exit 1 when a total is under its threshold, or when no lcov file was given (a gate never passes empty).
import fs from 'node:fs';

/** Parse lcov text into { file: { lines: Map, branches: Map, functions: Map } } (hit counts). */
export function parseLcov(text, into = new Map()) {
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      const file = line.slice(3);
      current = into.get(file) || { lines: new Map(), branches: new Map(), functions: new Map(), linesFound: 0 };
      current.fnda = 0;
      current.fnKeys = [];
      current.fnOnLine = new Map();
      current.brOnLine = new Map();
      into.set(file, current);
    } else if (!current) {
      continue;
    } else if (line.startsWith('DA:')) {
      const [n, hits] = line.slice(3).split(',');
      current.lines.set(n, Math.max(current.lines.get(n) || 0, Number(hits) || 0));
    } else if (line.startsWith('BRDA:')) {
      // Node numbers blocks with a running counter per file, so the same branch has another block number in a shard that
      // ran other functions of the file; it is the same branch as the one in the same place on the same line
      const [n, , , taken] = line.slice(5).split(',');
      const key = `${n}#${current.brOnLine.get(n) || 0}`;
      current.brOnLine.set(n, (current.brOnLine.get(n) || 0) + 1);
      current.branches.set(key, Math.max(current.branches.get(key) || 0, taken === '-' ? 0 : Number(taken) || 0));
    } else if (line.startsWith('LF:')) {
      current.linesFound = Math.max(current.linesFound, Number(line.slice(3)) || 0);
    } else if (line.startsWith('FN:')) {
      // a function is known by its line and its place among the functions on that line (names repeat: anonymous ones)
      const n = line.slice(3).split(',')[0];
      current.fnKeys.push(`${n}#${current.fnOnLine.get(n) || 0}`);
      current.fnOnLine.set(n, (current.fnOnLine.get(n) || 0) + 1);
    } else if (line.startsWith('FNDA:')) {
      // FNDA records follow the FN records in the same order
      const key = current.fnKeys[current.fnda++] ?? `?${current.fnda}`;
      const hits = Number(line.slice(5).split(',')[0]) || 0;
      current.functions.set(key, Math.max(current.functions.get(key) || 0, hits));
    } else if (line === 'end_of_record') {
      current = null;
    }
  }
  return into;
}

/**
 * Totals over every file: { lines, branches, functions } each as { covered, total, pct }. Lines are counted as Node
 * counts them for its own threshold: every line of the file (LF), with a line that has no DA record (a comment, a
 * blank line) counted as covered.
 */
export function totals(files) {
  const sum = { lines: [0, 0], branches: [0, 0], functions: [0, 0] };
  for (const f of files.values()) {
    const total = Math.max(f.linesFound, f.lines.size);
    const uncovered = [...f.lines.values()].filter(hits => hits === 0).length;
    sum.lines[0] += total - uncovered;
    sum.lines[1] += total;
    for (const kind of ['branches', 'functions']) {
      for (const hits of f[kind].values()) { sum[kind][1]++; if (hits > 0) sum[kind][0]++; }
    }
  }
  return Object.fromEntries(Object.entries(sum).map(([k, [covered, total]]) => [k, { covered, total, pct: total ? (covered / total) * 100 : 100 }]));
}

function main(argv) {
  const thresholds = {};
  const inputs = [];
  for (const arg of argv) {
    const m = /^--(lines|branches|functions)=(\d+(?:\.\d+)?)$/.exec(arg);
    if (m) thresholds[m[1]] = Number(m[2]);
    else inputs.push(arg);
  }
  if (inputs.length === 0) { console.error('coverage-merge: no lcov files given'); return 1; }
  const files = new Map();
  for (const input of inputs) parseLcov(fs.readFileSync(input, 'utf8'), files);
  if (files.size === 0) { console.error('coverage-merge: the lcov files list no source file'); return 1; }
  const t = totals(files);
  let failed = false;
  console.log(`coverage over ${inputs.length} shard(s), ${files.size} files:`);
  for (const [kind, { covered, total, pct }] of Object.entries(t)) {
    const min = thresholds[kind];
    const ok = min === undefined || pct >= min;
    if (!ok) failed = true;
    console.log(`  ${kind.padEnd(9)} ${pct.toFixed(2).padStart(6)}%  (${covered}/${total})${min === undefined ? '' : `  threshold ${min}%${ok ? '' : '  ✖ BELOW'}`}`);
  }
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
