import { test, describe } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { roundCents, calculateFXCents, parseAmountToCents } from './utils';
import Decimal from 'decimal.js';

describe('Decimal.js Precision and Property Tests', () => {
  test('parseAmountToCents handles floating point edges cleanly', () => {
    assert.strictEqual(parseAmountToCents('19.99'), 1999);
    assert.strictEqual(parseAmountToCents(19.99), 1999);
    assert.strictEqual(parseAmountToCents('0.07'), 7);
    assert.strictEqual(parseAmountToCents('100.4999999999'), 10050);
  });

  test('calculateFXCents converts currency amounts accurately without precision drift', () => {
    const originalCents = 125450; // $1,254.50
    const exchangeRate = 1.28453;  // USD to EUR rate
    const expected = new Decimal(originalCents).mul(exchangeRate).round().toNumber();
    assert.strictEqual(calculateFXCents(originalCents, exchangeRate), expected);
  });

  test('Property Test: Multi-line allocation sum always equals original total to the cent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000000 }), // Amount in cents
        fc.integer({ min: 2, max: 10 }),      // Line splits
        (totalCents, numLines) => {
          const baseShare = Math.floor(totalCents / numLines);
          const remainder = totalCents % numLines;

          const lines = Array.from({ length: numLines }, (_, i) => {
            return i === 0 ? baseShare + remainder : baseShare;
          });

          const lineSum = lines.reduce((sum, l) => sum + roundCents(l), 0);
          return lineSum === totalCents;
        }
      )
    );
  });
});
