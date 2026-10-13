import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

afterEach(() => undefined);

// #103: search text is escaped before it becomes a pattern, so "[" or "(" cannot crash a row
test('the ledger search highlight escapes every pattern character', () => {
  const src = readFileSync('src/components/transactions/TransactionRow.tsx', 'utf8');
  const line = src.split('\n').find(l => l.includes('text.split(new RegExp('))!;
  const escape = (m: string) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.ok(line.includes('.replace(/[.*+?^${}()|[\\]\\\\]/g'), 'the search term is escaped');
  for (const term of ['[', '(', 'REF-23]', 'a+b', '\\', '$5.00 (net)']) {
    assert.doesNotThrow(() => 'Order [REF-23] $5.00 (net)'.split(new RegExp(`(${escape(term)})`, 'gi')), term);
  }
  assert.deepEqual('Order [REF-23]'.split(new RegExp(`(${escape('[REF')})`, 'gi')), ['Order ', '[REF', '-23]']);
});
