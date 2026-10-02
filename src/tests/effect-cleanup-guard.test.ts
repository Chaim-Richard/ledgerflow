/**
 * Timers started in an effect are cleared when the effect ends (AD-02): an effect whose own body
 * calls setTimeout / setInterval must return a cleanup. (Delays awaited inside async work, e.g.
 * `await new Promise(r => setTimeout(r, ms))`, don't count: nothing fires after unmount.)
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.join(process.cwd(), 'src');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'tests' || e.name === 'server' ? [] : files(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

function timerWithoutCleanup(file: string, text = fs.readFileSync(file, 'utf8')): number[] {
  if (!/useEffect|useLayoutEffect/.test(text) || !/set(Timeout|Interval)/.test(text)) return [];
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines: number[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && /^(React\.)?use(Layout)?Effect$/.test(node.expression.getText(sf))) {
      const fn = node.arguments[0];
      if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isBlock(fn.body)) {
        let startsTimer = false;
        let returnsCleanup = false;
        const scan = (n: ts.Node, depth: number) => {
          // timers inside a Promise executor that is awaited are delays, not callbacks after unmount
          if (ts.isNewExpression(n) && n.expression.getText(sf) === 'Promise') return;
          if (ts.isCallExpression(n) && /^(window\.)?set(Timeout|Interval)$/.test(n.expression.getText(sf))) startsTimer = true;
          if (ts.isReturnStatement(n) && depth === 0 && n.expression) returnsCleanup = true;
          const nested = ts.isFunctionLike(n);
          n.forEachChild(c => scan(c, nested ? depth + 1 : depth));
        };
        fn.body.statements.forEach(st => scan(st, 0));
        if (startsTimer && !returnsCleanup) lines.push(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1);
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return lines;
}

describe('Effects clean up their timers (AD-02)', () => {
  test('no effect starts a timer without returning a cleanup', () => {
    const problems = files(ROOT).flatMap(f => timerWithoutCleanup(f).map(l => `${path.relative(ROOT, f)}:${l}`));
    assert.deepEqual(problems, []);
  });

  test('the detector catches a timer without cleanup and accepts the right forms', () => {
    const src = `
      useEffect(() => { const t = setTimeout(go, 100); }, []);
      useEffect(() => { const t = setTimeout(go, 100); return () => clearTimeout(t); }, []);
      useEffect(() => { (async () => { await new Promise(r => setTimeout(r, 50)); go(); })(); }, []);
      useEffect(() => { const i = setInterval(tick, 1000); }, []);
    `;
    assert.deepEqual(timerWithoutCleanup('sample.tsx', src), [2, 5]);
  });
});

