/** The shared CSV writer (F-22): every export goes through it. */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { csvMoney, toCsv } from '../lib/csvExport';
import { parseCsv } from '../lib/csv';

describe('toCsv', () => {
  test('commas, quotes, line breaks and # stay inside their cell; the file reads back the same', () => {
    const rows = [
      ['Acme, Inc.', 'Invoice #1001', 'He said "hi"', 'line 1\nline 2'],
      ['Café Ünïcode', 'שלום', '', null],
    ];
    const text = toCsv(['Name', 'Memo', 'Note', 'More'], rows);
    assert.deepEqual(parseCsv(text, ','), [
      ['Name', 'Memo', 'Note', 'More'],
      ['Acme, Inc.', 'Invoice #1001', 'He said "hi"', 'line 1\nline 2'],
      ['Café Ünïcode', 'שלום', '', ''],
    ]);
  });

  test('text a spreadsheet would run as a formula is neutralised; amounts are kept as numbers', () => {
    const [, row] = parseCsv(toCsv(['a', 'b', 'c', 'd', 'e'], [['=HYPERLINK("x")', '@SUM(A1)', '+1+1', csvMoney(-123456), 42]]), ',');
    assert.deepEqual(row, ["'=HYPERLINK(\"x\")", "'@SUM(A1)", "'+1+1", '-1234.56', '42']);
  });

  test('csvMoney writes cents as a plain decimal', () => {
    assert.equal(csvMoney(123450), '1234.50');
    assert.equal(csvMoney(-5), '-0.05');
    assert.equal(csvMoney(0), '0.00');
    assert.equal(csvMoney(undefined), '0.00');
  });
});

describe('guard: every CSV download goes through src/lib/csvExport.ts', () => {
  test('no screen builds its own CSV file or data: link', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap(name => {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) return name === 'tests' || name === 'server' ? [] : walk(p);
      return /\.(ts|tsx)$/.test(name) ? [p] : [];
    });
    const offenders = walk('src').filter(f => !f.endsWith(path.join('lib', 'csvExport.ts'))).filter(f => {
      const text = fs.readFileSync(f, 'utf8');
      const ownCsvFile = /data:text\/csv/.test(text) || (/type:\s*['"]text\/csv/.test(text) && /\.download\s*=|setAttribute\(\s*['"]download/.test(text));
      return ownCsvFile;
    });
    assert.deepEqual(offenders, [], 'use downloadCsv() from src/lib/csvExport.ts');
  });
});
