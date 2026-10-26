import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildReportWorkbook,
  currentReportExportContext,
  reportTitleRows,
} from '../lib/excelExport';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';

const context = {
  title: 'Profit & Loss',
  entity: '=cmd|demo',
  period: '2026-01-01 to 2026-01-31',
  basis: 'Accrual',
  currency: 'USD',
  generatedAt: '2026-10-26T12:00:00.000Z',
};

test('C-87: one header block, formula-safe, above the column headings', async () => {
  const rows = reportTitleRows(context);
  assert.equal(rows.length, 7);
  assert.equal(rows[0][0], 'Profit & Loss');
  assert.equal(rows[1][0], "Entity: '=cmd|demo", 'a formula-like entity name is escaped');
  assert.equal(rows[2][0], 'Period: 2026-01-01 to 2026-01-31');
  assert.equal(rows[3][0], 'Basis: Accrual');
  assert.equal(rows[4][0], 'Currency: USD');
  assert.equal(rows[5][0], 'Generated at: 2026-10-26T12:00:00.000Z');

  const workbook = await buildReportWorkbook(
    [{ header: 'Account', key: 'account', width: 30 }, { header: 'Amount', key: 'amount', width: 20 }],
    [{ account: 'Sales', amount: 12.5 }],
    { sheetName: 'Statement', reportContext: context },
  );
  const sheet = workbook.worksheets[0];
  const text = (row: number) => (sheet.getRow(row).values as unknown[]).slice(1).map(String);
  assert.deepEqual(text(1), ['Profit & Loss']);
  assert.deepEqual(text(2), ["Entity: '=cmd|demo"]);
  assert.deepEqual(text(6), ['Generated at: 2026-10-26T12:00:00.000Z']);
  assert.deepEqual(text(8), ['Account', 'Amount'], 'column headings follow the standard block');
  assert.deepEqual(text(9), ['Sales', '12.5'], 'object rows still resolve by column key');
});

test('the export context reads the signed-in workspace, with no report rows', () => {
  const workspace = setComponentWorkspace();
  useAuthStore.setState({ workspaces: [{ ...workspace, name: 'בית הספרים', currency: 'ILS' }] });
  const actual = currentReportExportContext('Trial Balance', 'As of 2026-10-26', 'Accrual posted entries', '2026-10-26T12:00:00.000Z');
  assert.deepEqual(actual, {
    title: 'Trial Balance',
    entity: 'בית הספרים',
    period: 'As of 2026-10-26',
    basis: 'Accrual posted entries',
    currency: 'ILS',
    generatedAt: '2026-10-26T12:00:00.000Z',
  });
});

test('every report Excel export names the standard header block', () => {
  const callers: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !full.endsWith(path.join('lib', 'excelExport.ts'))) {
        const source = fs.readFileSync(full, 'utf8');
        if (/exportToExcel(?:Helper)?\(/.test(source)) callers.push(full);
      }
    }
  };
  walk('src');
  assert.ok(callers.length >= 5, `expected the report export callers, saw ${callers.length}`);
  const missing = callers.filter(file => {
    const source = fs.readFileSync(file, 'utf8');
    return !/reportTitleRows\(currentReportExportContext|reportContext:/.test(source);
  });
  assert.deepEqual(missing, [], `Excel report exports without the standard header: ${missing.join(', ')}`);
});
