import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccountRole } from '../lib/accountUtils';
import { BUSINESS_TEMPLATES } from '../lib/businessTemplates';
import { LedgerEngine } from '../kernel/ledger/LedgerEngine';
import { ChartAccount } from '../types';

describe('FX Currency Rounding & Role Resolution', () => {
  it('identifies fx_rounding by role or subtype without naive name guessing', () => {
    const validRoundingAcc: ChartAccount = {
      id: 'acc-fx-1',
      uid: 'u-1',
      workspaceId: 'ws-1',
      balanceCents: 0,
      name: 'Custom Rounding Ledger',
      type: 'expense',
      category: 'Rounding Differences',
      subtype: 'rounding',
      code: '8999'
    };
    assert.equal(resolveAccountRole(validRoundingAcc), 'fx_rounding');

    const explicitRoleAcc: ChartAccount = {
      id: 'acc-fx-2',
      uid: 'u-1',
      workspaceId: 'ws-1',
      balanceCents: 0,
      name: 'Any Name Whatsoever',
      type: 'expense',
      category: 'Other Expense',
      code: '8998',
      role: 'fx_rounding'
    };
    assert.equal(resolveAccountRole(explicitRoleAcc), 'fx_rounding');

    // Negative case: an account named "FX Hedging" or "Exchange Desk" should NOT be fx_rounding if not configured as such
    const regularFxExpense: ChartAccount = {
      id: 'acc-fx-3',
      uid: 'u-1',
      workspaceId: 'ws-1',
      balanceCents: 0,
      name: 'FX Hedging Fees',
      type: 'expense',
      category: 'Financial Fees',
      code: '6500'
    };
    assert.equal(resolveAccountRole(regularFxExpense), 'expense');
  });

  it('guarantees all business templates include an fx_rounding account', () => {
    for (const [key, template] of Object.entries(BUSINESS_TEMPLATES)) {
      const roundingAcc = template.accounts.find(a => resolveAccountRole(a as unknown as Parameters<typeof resolveAccountRole>[0]) === 'fx_rounding');
      assert.ok(roundingAcc, `Template '${key}' is missing default fx_rounding account`);
      assert.equal(roundingAcc.code, '8999');
    }
  });

  it('LedgerEngine throws an error if FX rounding difference exists but no fx_rounding account is present', () => {
    const accountsWithoutRounding: ChartAccount[] = [
      { id: 'acc-bank-1', uid: 'u-1', workspaceId: 'ws-test', balanceCents: 0, name: 'Checking USD', type: 'asset', category: 'Cash', code: '1010' },
      { id: 'acc-rev-1', uid: 'u-1', workspaceId: 'ws-test', balanceCents: 0, name: 'Sales Revenue', type: 'revenue', category: 'Revenue', code: '4000' }
    ];

    // Multi-currency transaction where lines sum to zero in foreign currency, but rounding drift occurs in base currency
    const tx = {
      id: 'tx-fx-drift',
      workspaceId: 'ws-test',
      status: 'posted',
      date: '2026-09-01',
      totalAmountCents: 100,
      currency: 'EUR',
      exchangeRate: 1.085,
      lines: [
        { accountId: 'acc-bank-1', amountCents: 100, currency: 'EUR', exchangeRate: 1.083 },
        { accountId: 'acc-rev-1', amountCents: -100, currency: 'EUR', exchangeRate: 1.087 }
      ]
    };

    assert.throws(() => {
      LedgerEngine.computeDimensionalBalances(accountsWithoutRounding, [tx as unknown as Parameters<typeof LedgerEngine.computeDimensionalBalances>[1][number]]);
    }, /no FX rounding account/i);
  });
});
