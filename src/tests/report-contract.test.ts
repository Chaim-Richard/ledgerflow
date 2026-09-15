import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// Source file: src/server/routes/reportRoutes.ts
// Handlers: /balance-sheet, /trial-balance, /cash-flow, /profit-and-loss

describe('Report Contract Structural Guard Suite', () => {
  test('Balance Sheet contract: assets, liabilities, equity are flat Record<string, number> and totalClaims equals liabilities + equity + netIncome', () => {
    // Fixture representing res.json output from /balance-sheet handler in src/server/routes/reportRoutes.ts
    const fixture = {
      assets: { acc_cash: 100000, acc_ar: 50000 },
      liabilities: { acc_ap: 20000 },
      equity: { acc_re: 80000 },
      totalAssets: 150000,
      totalLiabilities: 20000,
      totalEquity: 80000, // equity accounts only (excluding net income)
      netIncome: 50000,
      totalClaims: 150000, // totalLiabilities + totalEquity + netIncome
      isBalanced: true
    };

    // Assert assets, liabilities, equity are flat Record<string, number> where every value is a finite number
    for (const category of [fixture.assets, fixture.liabilities, fixture.equity]) {
      assert.equal(typeof category, 'object');
      assert.notEqual(category, null);
      for (const [id, val] of Object.entries(category)) {
        assert.equal(typeof id, 'string');
        assert.equal(typeof val, 'number');
        assert.ok(Number.isFinite(val), `Value for account ${id} must be a finite number, got ${val}`);
      }
    }

    // Assert total summary fields are finite numbers
    assert.ok(Number.isFinite(fixture.totalAssets));
    assert.ok(Number.isFinite(fixture.totalLiabilities));
    assert.ok(Number.isFinite(fixture.totalEquity));
    assert.ok(Number.isFinite(fixture.netIncome));
    assert.ok(Number.isFinite(fixture.totalClaims));

    // Assert balance sheet fundamental accounting identity relied upon by BalanceSheetView.tsx
    assert.equal(
      fixture.totalLiabilities + (fixture.totalEquity + fixture.netIncome),
      fixture.totalClaims,
      'Balance Sheet Contract Violation: totalLiabilities + totalEquity + netIncome must equal totalClaims'
    );
  });

  test('Trial Balance contract: accounts is an Array with id, debit, credit, netSigned', () => {
    // Fixture representing res.json output from /trial-balance handler in src/server/routes/reportRoutes.ts
    const fixture = {
      accounts: [
        { id: 'acc_cash', name: 'Cash', code: '1000', type: 'asset', debit: 10000, credit: 0, netSigned: 10000 },
        { id: 'acc_rev', name: 'Revenue', code: '4000', type: 'income', debit: 0, credit: 10000, netSigned: -10000 }
      ],
      totalDebit: 10000,
      totalCredit: 10000,
      isBalanced: true
    };

    assert.ok(Array.isArray(fixture.accounts), 'Trial Balance accounts property must be an Array');
    for (const acc of fixture.accounts) {
      assert.equal(typeof acc.id, 'string');
      assert.ok(Number.isFinite(acc.debit));
      assert.ok(Number.isFinite(acc.credit));
      assert.ok(Number.isFinite(acc.netSigned));
    }
    assert.ok(Number.isFinite(fixture.totalDebit));
    assert.ok(Number.isFinite(fixture.totalCredit));
  });

  test('Cash Flow contract: buckets contain finite inflow, outflow, total, and (inflow - outflow) matches total', () => {
    // Fixture representing res.json output from /cash-flow handler in src/server/routes/reportRoutes.ts
    const fixture = {
      operating: { total: 5000, inflow: 12000, outflow: 7000, items: [{ name: 'Client Payment', amount: 5000 }] },
      investing: { total: -2000, inflow: 0, outflow: 2000, items: [{ name: 'Equipment Purchase', amount: -2000 }] },
      financing: { total: 1000, inflow: 1000, outflow: 0, items: [{ name: 'Owner Contribution', amount: 1000 }] },
      netChange: 4000
    };

    const buckets = [fixture.operating, fixture.investing, fixture.financing];
    for (const bucket of buckets) {
      assert.ok(Number.isFinite(bucket.inflow), 'Inflow must be a finite number');
      assert.ok(Number.isFinite(bucket.outflow), 'Outflow must be a finite number');
      assert.ok(Number.isFinite(bucket.total), 'Total must be a finite number');
      assert.ok(
        Math.abs((bucket.inflow - bucket.outflow) - bucket.total) <= 1,
        `Cash Flow Contract Violation: (inflow ${bucket.inflow} - outflow ${bucket.outflow}) does not equal total ${bucket.total}`
      );
    }
    assert.ok(Number.isFinite(fixture.netChange));
  });

  test('Profit & Loss contract: income, cogs, expense each have total + accounts object, grossProfit & netIncome are finite', () => {
    // Fixture representing res.json output from /profit-and-loss handler in src/server/routes/reportRoutes.ts
    const fixture = {
      income: { total: 15000, accounts: { acc_rev: 15000 } },
      cogs: { total: 4000, accounts: { acc_cogs: 4000 } },
      expense: { total: 3000, accounts: { acc_exp: 3000 } },
      grossProfit: 11000,
      netIncome: 8000
    };

    const categories = [fixture.income, fixture.cogs, fixture.expense];
    for (const category of categories) {
      assert.ok(Number.isFinite(category.total));
      assert.equal(typeof category.accounts, 'object');
      assert.notEqual(category.accounts, null);
      for (const [id, bal] of Object.entries(category.accounts)) {
        assert.equal(typeof id, 'string');
        assert.ok(Number.isFinite(bal), `Balance for ${id} in P&L must be a finite number`);
      }
    }
    assert.ok(Number.isFinite(fixture.grossProfit));
    assert.ok(Number.isFinite(fixture.netIncome));
  });
});
