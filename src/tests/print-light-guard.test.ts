/**
 * G-21: printed pages and PDFs are always light — white paper, dark ink —
 * whatever theme is on screen (the dark theme's pale text would print faint
 * on paper). The override lives in the @media print blocks of src/index.css
 * (the whole app) and src/components/reporting/reportPack/reportPack.css
 * (report packs). The browser spec that first covered G-21 was not merged,
 * so this guard is the lock: if the print rules are dropped or weakened,
 * this test fails.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/** The bodies of every `@media print { ... }` block, brace-matched so nested @page rules stay inside. */
function printBlocks(css: string): string {
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf('@media print', from);
    if (at === -1) break;
    const open = css.indexOf('{', at);
    let depth = 0;
    let i = open;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    bodies.push(css.slice(open + 1, i));
    from = i + 1;
  }
  return bodies.join('\n');
}

const indexPrint = printBlocks(fs.readFileSync('src/index.css', 'utf8'));
const packPrint = printBlocks(
  fs.readFileSync('src/components/reporting/reportPack/reportPack.css', 'utf8'),
);

describe('print is always light (G-21)', () => {
  test('the app print block re-declares the theme selectors with a light scheme', () => {
    assert.match(indexPrint, /\.dark[^{]*\{[^}]*color-scheme:\s*light/);
    assert.match(indexPrint, /\[data-theme="dark"\]/);
  });

  test('paper variables are white and text ink is dark in print', () => {
    assert.match(indexPrint, /--surface:\s*#FFFFFF/);
    assert.match(indexPrint, /--panel:\s*#FFFFFF/);
    assert.match(indexPrint, /--ink:\s*#FFFFFF/);
    assert.match(indexPrint, /--text:\s*#0E2229/);
  });

  test('the page body prints on white, with no background image and dark text', () => {
    assert.match(indexPrint, /body\s*\{[^}]*background:\s*#FFFFFF\s*!important/);
    assert.match(indexPrint, /body\s*\{[^}]*background-image:\s*none\s*!important/);
    assert.match(indexPrint, /body\s*\{[^}]*color:\s*#0E2229\s*!important/);
  });

  test('dark-mode utility classes cannot leak into print', () => {
    assert.match(
      indexPrint,
      /\[class\*="dark:bg-"\][^{]*\{[^}]*background-color:\s*#FFFFFF\s*!important/,
    );
    assert.match(indexPrint, /\[class\*="dark:text-"\][^{]*\{[^}]*color:\s*#0E2229\s*!important/);
  });

  test('print carries no shadows', () => {
    assert.match(indexPrint, /\*\s*\{[^}]*box-shadow:\s*none\s*!important/);
    assert.match(indexPrint, /\*\s*\{[^}]*text-shadow:\s*none\s*!important/);
  });

  test('report packs print on white with dark ink', () => {
    assert.match(packPrint, /\.report-pack-overlay\s*\{[^}]*background:\s*#FFFFFF\s*!important/);
    assert.match(packPrint, /\.report-pack-overlay\s*\{[^}]*color:\s*#0E2229\s*!important/);
    assert.match(packPrint, /\.report-pack-paper[^{]*\{[^}]*background:\s*#FFFFFF\s*!important/);
    assert.match(packPrint, /\.report-pack-paper[^{]*\{[^}]*color:\s*#0E2229\s*!important/);
  });
});
