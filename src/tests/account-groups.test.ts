/**
 * Account groups (K-14), the pure half: the tree a report shows, the subtotals, and the rules that
 * decide which parent an account may take (same type, no loop, at most three levels). Every number
 * here is worked out by hand; the point of the subtotal cases is that a group never adds a figure —
 * the section total is the same with the groups as without them.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_GROUP_MAX_DEPTH,
  accountGroupDepth,
  accountGroupIds,
  accountGroupLayout,
  accountParentLinks,
  accountParentProblem,
  accountSubtreeDepth,
  allowedParentAccounts,
  groupSubtotals,
  hasAccountGroups,
  rowsInsideExpandedGroups,
  toggleAccountGroup,
  visibleGroupRows,
} from '../lib/accountGroups';
import { computeBalanceSheet, computeProfitAndLoss } from '../server/reports/computeReports';
import { statementColumnCsv, statementFigures, statementRows } from '../lib/reportColumns';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { ChartAccount } from '../types';

/** Overheads 6000 holds Rent 6100 and Utilities 6200, which holds Electricity 6210; Salaries 6500 stands alone. */
const expenses: ChartAccount[] = [
  makeChartAccount({ id: 'overhead', code: '6000', name: 'Overheads', type: 'expense' }),
  makeChartAccount({ id: 'rent', code: '6100', name: 'Rent', type: 'expense', parentId: 'overhead' }),
  makeChartAccount({ id: 'utilities', code: '6200', name: 'Utilities', type: 'expense', parentId: 'overhead' }),
  makeChartAccount({ id: 'electricity', code: '6210', name: 'Electricity', type: 'expense', parentId: 'utilities' }),
  makeChartAccount({ id: 'salaries', code: '6500', name: 'Salaries', type: 'expense' }),
];
const byId = (id: string) => expenses.find(account => account.id === id)!;

/** Hand-written spend for those five accounts, in cents. */
const spend: Record<string, number> = {
  overhead: 500,
  rent: 12000,
  utilities: 300,
  electricity: 7000,
  salaries: 90000,
};
const spendOf = (account: ChartAccount) => ({ amount: spend[account.id] || 0 });

describe('the rows a report shows', () => {
  test('a parent, its children indented under it and a subtotal for the group', () => {
    const rows = accountGroupLayout(expenses);
    assert.deepEqual(
      rows.map(row => [row.key, row.depth, row.hasChildren, row.label]),
      [
        ['overhead', 0, true, 'Overheads'],
        ['rent', 1, false, 'Rent'],
        ['utilities', 1, true, 'Utilities'],
        ['electricity', 2, false, 'Electricity'],
        ['subtotal:utilities', 1, false, 'Total Utilities'],
        ['subtotal:overhead', 0, false, 'Total Overheads'],
        ['salaries', 0, false, 'Salaries'],
      ],
    );
    assert.deepEqual(
      rows.map(row => row.kind),
      ['account', 'account', 'account', 'account', 'subtotal', 'subtotal', 'account'],
    );
    // a row says which groups hide it, so a report can collapse one level only
    assert.deepEqual(rows[3].collapsedBy, ['overhead', 'utilities']);
    assert.deepEqual(rows[4].collapsedBy, ['overhead', 'utilities']);
    assert.deepEqual(rows[5].collapsedBy, ['overhead']);
    assert.deepEqual(rows[6].collapsedBy, []);
    assert.deepEqual(accountGroupIds(rows), ['overhead', 'utilities']);
  });

  test('the subtotal is the parent and everything inside it, and the section total does not move', () => {
    const subtotals = groupSubtotals(expenses, spendOf);
    assert.deepEqual([...subtotals.keys()].sort(), ['overhead', 'utilities']);
    assert.deepEqual(subtotals.get('utilities'), { amount: 300 + 7000 });
    assert.deepEqual(subtotals.get('overhead'), { amount: 500 + 12000 + 300 + 7000 });
    // what a report shows at the top level: the outer group's subtotal and the account with no group
    const shownAtTopLevel = subtotals.get('overhead')!.amount + spend.salaries;
    const sectionTotal = Object.values(spend).reduce((sum, cents) => sum + cents, 0);
    assert.equal(sectionTotal, 109800);
    assert.equal(shownAtTopLevel, sectionTotal);
  });

  test('a subtotal carries every figure of the row, so a trial balance keeps both sides', () => {
    const lines = [
      { id: 'overhead', name: 'Overheads', code: '6000', type: 'expense', parentId: undefined, debit: 500, credit: 0 },
      { id: 'rent', name: 'Rent', code: '6100', type: 'expense', parentId: 'overhead', debit: 12000, credit: 200 },
      { id: 'utilities', name: 'Utilities', code: '6200', type: 'expense', parentId: 'overhead', debit: 7300, credit: 0 },
    ];
    const subtotals = groupSubtotals(lines, line => ({ debit: line.debit, credit: line.credit }));
    assert.deepEqual(subtotals.get('overhead'), { debit: 500 + 12000 + 7300, credit: 200 });
    assert.equal(subtotals.get('overhead')!.debit, lines.reduce((sum, line) => sum + line.debit, 0));
    assert.equal(subtotals.get('overhead')!.credit, lines.reduce((sum, line) => sum + line.credit, 0));
  });

  test('a chart with no groups is the same sorted list it was, with no subtotal rows', () => {
    const flat = expenses.map(account => ({ ...account, parentId: undefined }));
    assert.equal(hasAccountGroups(flat), false);
    assert.deepEqual(accountGroupLayout(flat).map(row => row.key), ['overhead', 'rent', 'utilities', 'electricity', 'salaries']);
    assert.deepEqual(accountGroupIds(accountGroupLayout(flat)), []);
    assert.equal(groupSubtotals(flat, spendOf).size, 0);
    assert.equal(hasAccountGroups(expenses), true);
  });

  test('a report keeps its own order, and a group still holds its children together', () => {
    const bySpend = accountGroupLayout(expenses, (a, b) => spendOf(b).amount - spendOf(a).amount);
    assert.deepEqual(
      bySpend.map(row => row.key),
      // Salaries (90000) is the biggest top-level account, so it comes first; inside Overheads the
      // bigger Rent comes before Utilities, and the subtotals stay under their own group
      ['salaries', 'overhead', 'rent', 'utilities', 'electricity', 'subtotal:utilities', 'subtotal:overhead'],
    );
  });
});

describe('collapsing a group', () => {
  test('hiding a group leaves its own row and the rest of the report', () => {
    const rows = accountGroupLayout(expenses);
    const collapsed = toggleAccountGroup(new Set<string>(), 'overhead');
    assert.deepEqual(visibleGroupRows(rows, collapsed).map(row => row.key), ['overhead', 'salaries']);
    assert.deepEqual(
      visibleGroupRows(rows, toggleAccountGroup(collapsed, 'overhead')).map(row => row.key),
      rows.map(row => row.key),
    );
  });

  test('hiding the inner group leaves the outer one open, and the figures alone', () => {
    const rows = accountGroupLayout(expenses);
    const collapsed = toggleAccountGroup(new Set<string>(), 'utilities');
    assert.deepEqual(
      visibleGroupRows(rows, collapsed).map(row => row.key),
      ['overhead', 'rent', 'utilities', 'subtotal:overhead', 'salaries'],
    );
    // the outer subtotal is still the whole group: collapsing hides rows, it never changes a figure
    assert.deepEqual(groupSubtotals(expenses, spendOf).get('overhead'), { amount: 19800 });
  });

  test('the chart of accounts keeps children hidden until it opens a group', () => {
    const rows = accountGroupLayout(expenses);
    assert.deepEqual(rowsInsideExpandedGroups(rows, new Set()).map(row => row.key), ['overhead', 'salaries']);
    // opening Overheads shows its children; Utilities is still closed, so Electricity and the
    // "Total Utilities" row stay hidden and Overheads' own subtotal is the whole group
    assert.deepEqual(
      rowsInsideExpandedGroups(rows, new Set(['overhead'])).map(row => row.key),
      ['overhead', 'rent', 'utilities', 'subtotal:overhead', 'salaries'],
    );
    assert.deepEqual(
      rowsInsideExpandedGroups(rows, new Set(['overhead', 'utilities'])).map(row => row.key),
      rows.map(row => row.key),
    );
  });
});

describe('saved links that cannot be used', () => {
  test('a loop is cut instead of walked: both accounts stay in the list', () => {
    const looped = [
      makeChartAccount({ id: 'one', code: '6000', name: 'One', type: 'expense', parentId: 'two' }),
      makeChartAccount({ id: 'two', code: '6100', name: 'Two', type: 'expense', parentId: 'one' }),
    ];
    assert.equal(accountParentLinks(looped).size, 1, 'one of the two links is cut');
    const rows = accountGroupLayout(looped);
    assert.deepEqual(rows.map(row => row.key).sort(), ['one', 'subtotal:two', 'two']);
    assert.equal(rows.filter(row => row.kind === 'account' && row.depth === 0).length, 1, 'one of them is a top-level account again');
  });

  test('a longer loop (a → b → c → b) is cut once and every account is still shown', () => {
    const looped = [
      makeChartAccount({ id: 'a', code: '6000', name: 'A', type: 'expense', parentId: 'b' }),
      makeChartAccount({ id: 'b', code: '6100', name: 'B', type: 'expense', parentId: 'c' }),
      makeChartAccount({ id: 'c', code: '6200', name: 'C', type: 'expense', parentId: 'b' }),
    ];
    const rows = accountGroupLayout(looped);
    assert.deepEqual(rows.filter(row => row.kind === 'account').map(row => row.key).sort(), ['a', 'b', 'c']);
    assert.equal(rows.filter(row => row.depth === 0 && row.kind === 'account').length, 1);
  });

  test('an account is never its own parent, and a parent that is gone leaves it at the top level', () => {
    const selfParented = [makeChartAccount({ id: 'self', code: '6000', name: 'Self', type: 'expense', parentId: 'self' })];
    assert.equal(accountParentLinks(selfParented).size, 0);
    assert.deepEqual(accountGroupLayout(selfParented).map(row => [row.key, row.depth]), [['self', 0]]);
    const ghost = [makeChartAccount({ id: 'child', code: '6100', name: 'Child', type: 'expense', parentId: 'deleted-account' })];
    assert.equal(hasAccountGroups(ghost), false);
    assert.deepEqual(accountGroupLayout(ghost).map(row => [row.key, row.depth]), [['child', 0]]);
  });

  test('a child of an account that is not in the list stays visible (an archived parent, a partial chart)', () => {
    const partial = [
      makeChartAccount({ id: 'rent', code: '6100', name: 'Rent', type: 'expense', parentId: 'overhead' }),
      makeChartAccount({ id: 'salaries', code: '6500', name: 'Salaries', type: 'expense' }),
    ];
    assert.deepEqual(accountGroupLayout(partial).map(row => row.key), ['rent', 'salaries']);
  });

  test('a repeated id in the list is one row', () => {
    assert.deepEqual(accountGroupLayout([byId('rent'), byId('rent')]).map(row => row.key), ['rent']);
  });
});

describe('choosing a parent', () => {
  test('an account of another type is refused', () => {
    const cash = makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset' });
    const chart = [...expenses, cash];
    const problem = accountParentProblem(chart, cash, 'overhead');
    assert.match(problem || '', /one type of account/);
    assert.match(problem || '', /Overheads is "expense", Cash is "asset"/);
    assert.equal(
      accountParentProblem(chart, byId('rent'), 'cash'),
      'A group holds one type of account: Cash is "asset", Rent is "expense"',
    );
  });

  test('a loop is refused: a parent cannot be inside the account it would join', () => {
    assert.equal(accountParentProblem(expenses, byId('overhead'), 'electricity'), 'Electricity is already inside Overheads');
    assert.equal(accountParentProblem(expenses, byId('overhead'), 'rent'), 'Rent is already inside Overheads');
    assert.equal(accountParentProblem(expenses, byId('overhead'), 'overhead'), 'An account cannot be inside itself');
  });

  test(`at most ${ACCOUNT_GROUP_MAX_DEPTH} levels: a subtree that would make a fourth is refused`, () => {
    const travel = makeChartAccount({ id: 'travel', code: '6600', name: 'Travel', type: 'expense' });
    const fuel = makeChartAccount({ id: 'fuel', code: '6610', name: 'Fuel', type: 'expense', parentId: 'travel' });
    const chart = [...expenses, travel, fuel];
    // Travel + Fuel is two levels; under Utilities (already level 2) that would be four
    assert.match(accountParentProblem(chart, travel, 'utilities') || '', /at most 3 levels deep/);
    assert.match(accountParentProblem(chart, travel, 'utilities') || '', /would take 4/);
    // under Overheads (level 1) the same two levels are exactly three, which is allowed
    assert.equal(accountParentProblem(chart, travel, 'overhead'), null);
    // Electricity is already level 3, so nothing can go inside it
    assert.match(accountParentProblem(chart, fuel, 'electricity') || '', /at most 3 levels deep/);
    assert.equal(accountParentProblem(chart, fuel, 'rent'), null, 'a third level is fine');
    assert.equal(accountSubtreeDepth(accountParentLinks(chart), 'travel'), 2);
    assert.equal(accountSubtreeDepth(accountParentLinks(chart), 'fuel'), 1);
  });

  test('a chart imported deeper than the rule allows is still shown, never dropped', () => {
    const meter = makeChartAccount({ id: 'meter', code: '6211', name: 'Meter rental', type: 'expense', parentId: 'electricity' });
    const deep = [...expenses, meter];
    assert.equal(accountGroupDepth(accountParentLinks(deep), 'meter'), 4);
    assert.equal(accountParentProblem(deep, meter, 'utilities'), null, 'moving up inside its own group is allowed');
    assert.equal(accountParentProblem(deep, byId('overhead'), 'meter'), 'Meter rental is already inside Overheads');
    assert.deepEqual(
      accountGroupLayout(deep).filter(row => row.kind === 'account').map(row => [row.key, row.depth]),
      [['overhead', 0], ['rent', 1], ['utilities', 1], ['electricity', 2], ['meter', 3], ['salaries', 0]],
    );
  });

  test('a parent that is not in the chart is refused, and taking an account back to the top level is not', () => {
    assert.equal(accountParentProblem(expenses, byId('rent'), 'not-an-account'), 'That parent is not an account in this chart');
    assert.equal(accountParentProblem(expenses, byId('rent'), ''), null);
    assert.equal(accountParentProblem(expenses, byId('rent'), null), null);
    assert.equal(accountParentProblem(expenses, byId('rent'), undefined), null);
  });

  test('an account that is not saved yet is checked the same way', () => {
    const draft = { id: '', name: 'Cleaning', type: 'expense' };
    assert.equal(accountParentProblem(expenses, draft, 'overhead'), null);
    assert.equal(accountParentProblem(expenses, draft, 'utilities'), null);
    assert.equal(accountSubtreeDepth(accountParentLinks(expenses), ''), 1);
    assert.match(accountParentProblem(expenses, { id: '', name: 'Van', type: 'asset' }, 'overhead') || '', /one type of account/);
  });

  test('the picker offers the accounts that are allowed, and nobody else', () => {
    // Overheads and the accounts inside it are three levels already, so nothing may go inside them
    assert.deepEqual(allowedParentAccounts(expenses, byId('overhead')).map(account => account.id), []);
    assert.deepEqual(
      allowedParentAccounts(expenses, byId('salaries')).map(account => account.id),
      ['overhead', 'rent', 'utilities'],
      'Electricity is level 3, so a fourth level is not offered',
    );
    assert.deepEqual(
      allowedParentAccounts(expenses, byId('electricity')).map(account => account.id),
      ['overhead', 'rent', 'utilities', 'salaries'],
      'in code order, itself and its own parents left out',
    );
  });
});

describe('the shared statement table (P&L and balance sheet columns)', () => {
  const chart = [
    makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' }),
    makeChartAccount({ id: 'current', code: '1100', name: 'Current assets', type: 'asset', category: 'Current Assets' }),
    makeChartAccount({ id: 'bank', code: '1200', name: 'Bank', type: 'asset', category: 'Cash', parentId: 'current' }),
    makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'income', category: 'Revenue' }),
    makeChartAccount({ id: 'products', code: '4100', name: 'Product sales', type: 'income', category: 'Revenue', parentId: 'sales' }),
    makeChartAccount({ id: 'services', code: '4200', name: 'Service sales', type: 'income', category: 'Revenue', parentId: 'sales' }),
    makeChartAccount({ id: 'rent', code: '6100', name: 'Rent', type: 'expense', category: 'Operating' }),
  ];
  /** Sales itself 50.00 into cash; products 300.00 and services 150.00 into the bank; rent 80.00 back out of the bank. */
  const ledger = [
    makeTransaction({ id: 'tx-1', date: '2026-03-01', status: 'completed', posted: true, lines: [{ accountId: 'cash', amountCents: 5000 }, { accountId: 'sales', amountCents: -5000 }] }),
    makeTransaction({ id: 'tx-2', date: '2026-03-02', status: 'completed', posted: true, lines: [{ accountId: 'bank', amountCents: 30000 }, { accountId: 'products', amountCents: -30000 }] }),
    makeTransaction({ id: 'tx-3', date: '2026-03-09', status: 'completed', posted: true, lines: [{ accountId: 'bank', amountCents: 15000 }, { accountId: 'services', amountCents: -15000 }] }),
    makeTransaction({ id: 'tx-4', date: '2026-03-15', status: 'completed', posted: true, lines: [{ accountId: 'rent', amountCents: 8000 }, { accountId: 'bank', amountCents: -8000 }] }),
  ];
  const period = { id: '2026-03', label: 'Mar 2026', startDate: '2026-03-01', endDate: '2026-03-31' };

  test('the P&L rows carry the group, its depth and a subtotal row, and the income total does not move', () => {
    const pl = computeProfitAndLoss(chart, ledger, period.startDate, period.endDate);
    const rows = statementRows(chart, pl);
    const income = rows.slice(rows.findIndex(row => row.id === 'heading:income'), rows.findIndex(row => row.id === 'total:income') + 1);
    assert.deepEqual(
      income.map(row => [row.id, row.depth || 0, Boolean(row.group), Boolean(row.subtotal)]),
      [
        ['heading:income', 0, false, false],
        ['account:sales', 0, true, false],
        ['account:products', 1, false, false],
        ['account:services', 1, false, false],
        ['group:sales', 0, false, true],
        ['total:income', 0, false, false],
      ],
    );
    const figures = statementFigures(pl, chart);
    assert.equal(figures.values['group:sales'], 5000 + 30000 + 15000);
    assert.equal(figures.values['total:income'], 50000, 'the section total is the report code\'s own');
    assert.equal(figures.values['account:services'], 15000);
    // the same chart without the groups: every figure the table can show is the same
    const flat = chart.map(account => ({ ...account, parentId: undefined }));
    const flatFigures = statementFigures(computeProfitAndLoss(flat, ledger, period.startDate, period.endDate), flat);
    for (const key of Object.keys(flatFigures.values)) assert.equal(figures.values[key], flatFigures.values[key], key);
  });

  test('the balance sheet rows group one type only, and total assets do not move', () => {
    const sheet = computeBalanceSheet(chart, ledger, period.endDate);
    const rows = statementRows(chart, sheet);
    const assets = rows.slice(rows.findIndex(row => row.id === 'heading:assets'), rows.findIndex(row => row.id === 'total:assets') + 1);
    assert.deepEqual(
      assets.map(row => [row.id, row.depth || 0, Boolean(row.subtotal)]),
      [
        ['heading:assets', 0, false],
        ['account:cash', 0, false],
        ['account:current', 0, false],
        ['account:bank', 1, false],
        ['group:current', 0, true],
        ['total:assets', 0, false],
      ],
    );
    const figures = statementFigures(sheet, chart);
    assert.equal(figures.values['group:current'], 37000, 'the group is the Bank: 300.00 + 150.00 - 80.00; Current assets itself has nothing posted on it');
    assert.equal(figures.values['account:cash'], 5000);
    assert.equal(figures.values['total:assets'], 5000 + 37000);
    assert.equal(sheet.totalAssets, 42000, 'the report code\'s own total, groups or not');
    assert.equal(sheet.isBalanced, true);
  });

  test('the columns CSV carries the subtotal it shows', () => {
    const pl = computeProfitAndLoss(chart, ledger, period.startDate, period.endDate);
    const rows = statementRows(chart, pl);
    const csv = statementColumnCsv(rows, [{ period, data: pl }], false, false, chart);
    assert.deepEqual(csv.rows.find(row => row[0] === 'Total Sales'), ['Total Sales', '', '500.00']);
    assert.deepEqual(csv.rows.find(row => row[0] === 'Product sales'), ['Product sales', '4100', '300.00']);
    assert.deepEqual(csv.rows.find(row => row[0] === 'Total Income'), ['Total Income', '', '500.00']);
  });
});
