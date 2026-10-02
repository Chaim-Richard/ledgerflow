/**
 * Tables screen readers can use (E-05, E-21): every <table> names itself with a <caption>
 * (visually hidden with sr-only where the screen already shows a heading), and every header
 * cell says what it heads (scope="col" in <thead>, scope="row" for row headers).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap(name => {
  const p = path.join(dir, name);
  if (fs.statSync(p).isDirectory()) return name === 'tests' ? [] : walk(p);
  return name.endsWith('.tsx') ? [p] : [];
});

/** The opening tag starting at `start` (JSX braces may contain ">"). */
function openingTag(text: string, start: number): string {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

const files = walk('src').map(f => ({ f, text: fs.readFileSync(f, 'utf8') }));
const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

describe('tables', () => {
  test('every <table> has a <caption>', () => {
    const missing: string[] = [];
    for (const { f, text } of files) {
      for (const m of text.matchAll(/<table\b/g)) {
        const tag = openingTag(text, m.index!);
        if (!/^\s*<caption\b/.test(text.slice(m.index! + tag.length))) missing.push(`${f}:${lineOf(text, m.index!)}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  test('every <th> has a scope', () => {
    const missing: string[] = [];
    for (const { f, text } of files) {
      for (const m of text.matchAll(/<th(?=[\s>])/g)) {
        if (!/\bscope=/.test(openingTag(text, m.index!))) missing.push(`${f}:${lineOf(text, m.index!)}`);
      }
    }
    assert.deepEqual(missing, []);
  });
});
