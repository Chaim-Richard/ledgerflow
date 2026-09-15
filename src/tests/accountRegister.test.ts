import { describe, it, expect } from 'vitest';
import { calculateAccountRegisterBalances, visibleAccountRegisterEntries } from '../lib/accountRegister';

describe('accountRegister calculations', () => {
  it('correctly calculates newest-first running balances from opening + activity', () => {
    // Opening balance: $100.00 (10000 cents)
    // Three transactions:
    // Tx 1 (oldest): +$50.00 (5000 cents)
    // Tx 2 (middle): -$20.00 (-2000 cents)
    // Tx 3 (newest): -$10.00 (-1000 cents)
    // Total activity = 5000 + (-2000) + (-1000) = 2000 cents.
    // Ending balance = 10000 + 2000 = 12000 cents ($120.00).
    // newestAmountsMinor = [-1000, -2000, 5000]

    const result = calculateAccountRegisterBalances(
      10000,
      2000,
      [-1000, -2000, 5000]
    );

    expect(result.endingBalanceMinor).toBe(12000);
    // After Tx 3 (newest): 12000
    // After Tx 2: 12000 - (-1000) = 13000
    // After Tx 1: 13000 - (-2000) = 15000
    // Prior to Tx 1: 15000 - 5000 = 10000 (matches opening!)
    expect(result.runningNewestFirst).toEqual([12000, 13000, 15000]);
  });

  it('works correctly when newest list is paginated / truncated', () => {
    // Total historical activity is 50000 cents.
    // We only have the 2 newest transactions: [+500, -200]
    // Ending balance = 10000 + 50000 = 60000 cents.
    const result = calculateAccountRegisterBalances(
      10000,
      50000,
      [500, -200]
    );

    expect(result.endingBalanceMinor).toBe(60000);
    expect(result.runningNewestFirst).toEqual([60000, 59500]);
  });

  it('rejects unsafe integer inputs', () => {
    expect(() => calculateAccountRegisterBalances(1.5, 100, [100])).toThrow(TypeError);
    expect(() => calculateAccountRegisterBalances(100, NaN, [100])).toThrow(TypeError);
    expect(() => calculateAccountRegisterBalances(100, 100, [2.5])).toThrow(TypeError);
  });

  it('filters uncleared entries when unclearedOnly is true', () => {
    const entries = [
      { id: '1', isCleared: true, desc: 'A' },
      { id: '2', isCleared: false, desc: 'B' },
      { id: '3', desc: 'C' }
    ];

    expect(visibleAccountRegisterEntries(entries, false)).toHaveLength(3);
    expect(visibleAccountRegisterEntries(entries, true)).toEqual([
      { id: '2', isCleared: false, desc: 'B' },
      { id: '3', desc: 'C' }
    ]);
  });
});
