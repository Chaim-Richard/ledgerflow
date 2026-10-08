/**
 * The group summary account by account (Z-20): accounts are one line across the companies by code,
 * else by name; a code with different names says both; each section at its rate; zero balances and
 * unknown accounts make no line; lines come in report order.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupAccountLines, lineKey, type MemberAccounts } from '../server/reports/groupAccounts';

const empty = { income: {}, cogs: {}, expense: {}, asset: {}, liability: {}, equity: {} };

test('by code, else by name; both names said; each company\'s figure at its section\'s rate', () => {
  const a: MemberAccounts = {
    workspaceId: 'A', rate: () => 1,
    accounts: [{ id: 'a1', name: 'Sales', code: '4000' }, { id: 'a2', name: 'Bank fees', code: '' }, { id: 'a3', name: 'Cash', code: '1000' }, { id: 'a4', name: 'Idle', code: '9' }],
    sections: { ...empty, income: { a1: 500 }, expense: { a2: 30 }, asset: { a3: 1000, a4: 0, gone: 5 } },
  };
  const b: MemberAccounts = {
    workspaceId: 'B', rate: s => (s === 'asset' ? 2 : s === 'income' ? 1.5 : 1),
    accounts: [{ id: 'b1', name: 'Revenue', code: '4000' }, { id: 'b2', name: 'bank  Fees' }, { id: 'b3', name: 'Cash', code: '1000' }],
    sections: { ...empty, income: { b1: 100 }, expense: { b2: 10 }, asset: { b3: 333 } },
    extraEquity: { profit: 0, cta: 7 },
  };
  assert.deepEqual(groupAccountLines([a, b]).map(l => [l.section, l.code, l.name, l.alsoNamed, l.byMember, l.total]), [
    ['income', '4000', 'Sales', ['Revenue'], { A: 500, B: 150 }, 650],
    ['expense', undefined, 'Bank fees', ['bank  Fees'], { A: 30, B: 10 }, 40],
    ['asset', '1000', 'Cash', undefined, { A: 1000, B: 666 }, 1666],
    ['equity', undefined, 'Translation difference', undefined, { B: 7 }, 7],
  ]);
  assert.equal(lineKey('asset', { name: 'Cash ', code: ' 1000' }), 'asset|code:1000');
  assert.equal(lineKey('asset', { name: '  Petty   cash' }), 'asset|name:petty cash');
});
