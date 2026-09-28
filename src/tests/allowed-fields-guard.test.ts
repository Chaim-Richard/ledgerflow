/**
 * The database guard refuses a whole document when it has one field outside the table's allowed
 * list. That silently broke adding customers (status), applying templates (chartAccounts.role)
 * and saving the time zone. So: every field of the app's model for such a table must be allowed,
 * unless it is written only by the server (which the guard does not check) and listed here.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrationsSql, ruleArrays } from './helpers/migrations';

const typesSource = fs.readFileSync('src/types.ts', 'utf8');

/** Top-level field names of `export interface Name { ... }` in src/types.ts. */
function interfaceFields(name: string): string[] {
  const start = typesSource.search(new RegExp(`export interface ${name}\\b[^{]*\\{`));
  assert.ok(start >= 0, `interface ${name} not found`);
  let i = typesSource.indexOf('{', start) + 1;
  let depth = 1;
  let line = '';
  const fields: string[] = [];
  for (; i < typesSource.length && depth > 0; i++) {
    const ch = typesSource[i];
    if (ch === '\n') {
      const m = depth === 1 ? line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/) : null;
      if (m) fields.push(m[1]);
      line = '';
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 1 || (depth === 2 && ch === '{')) line += ch;
  }
  return fields;
}

// table → [model, fields written only through the server]
const TABLES: Record<string, [string, string[]]> = {
  customers: ['Customer', []],
  chartAccounts: ['ChartAccount', []],
  projects: ['Project', []],
  supportTickets: ['SupportTicket', []],
  // credit notes and vendor credits are saved through POST /api/v1/transactions/bulk
  creditNotes: ['CreditNote', ['exchangeRate', 'tags', 'metadata']],
  vendorCredits: ['VendorCredit', ['exchangeRate', 'tags', 'metadata']],
  // numberingSeries lives in its own collection; the field on the model is a legacy read path
  workspaces: ['Workspace', ['numberingSeries']],
  notifications: ['AppNotification', []],
};

describe('Allowed fields match the app model', () => {
  const sql = migrationsSql();
  for (const [table, [model, serverOnly]] of Object.entries(TABLES)) {
    test(`${table}: every ${model} field can be saved`, () => {
      const { allowed } = ruleArrays(table, sql);
      assert.ok(allowed.length > 0, `no allowed list found for ${table}`);
      const missing = interfaceFields(model).filter(f => !allowed.includes(f) && !serverOnly.includes(f));
      assert.deepEqual(missing, [], `${table} refuses these ${model} fields: ${missing.join(', ')}`);
    });
  }
});
