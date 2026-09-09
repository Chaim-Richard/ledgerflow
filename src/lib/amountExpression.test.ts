import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAmountExpression } from './amountExpression';
import { TruthEngine } from '../modules/integrity/TruthEngine';

describe('amountExpression tests', () => {
  it('evaluates simple addition', () => {
    assert.equal(evaluateAmountExpression('10 + 20'), 3000);
  });

  it('evaluates expression with parenthesis and division', () => {
    assert.equal(evaluateAmountExpression('(40 + 5) / 3'), 1500);
  });

  it('evaluates division with exact half-up cent rounding', () => {
    // 100 / 3 = 33.3333... -> 3333 cents
    assert.equal(evaluateAmountExpression('100 / 3'), 3333);
    // 100 / 3 * 2 = 66.6666... -> 6667 cents
    assert.equal(evaluateAmountExpression('100 / 3 * 2'), 6667);
  });

  it('evaluates subtraction and decimals', () => {
    assert.equal(evaluateAmountExpression('120.50 - 20.25'), 10025);
  });

  it('evaluates unary minus', () => {
    assert.equal(evaluateAmountExpression('-15.50 + 5'), -1050);
  });

  it('rejects division by zero explicitly', () => {
    assert.throws(
      () => evaluateAmountExpression('100 / 0'),
      /Division by zero/
    );
  });

  it('rejects expressions exceeding max length', () => {
    const longExpr = '1 + '.repeat(30) + '1';
    assert.throws(
      () => evaluateAmountExpression(longExpr),
      /Expression length exceeds/
    );
  });

  it('rejects excessive parenthesis depth', () => {
    const deepExpr = '(((((((((((((1)))))))))))))';
    assert.throws(
      () => evaluateAmountExpression(deepExpr),
      /Parenthesis depth exceeds/
    );
  });
});

describe('TruthEngine integration with amount expressions', () => {
  it('parses arithmetic expressions', () => {
    assert.equal(TruthEngine.parseAmountToCents('100 / 3 * 2'), 6667);
    assert.equal(TruthEngine.parseAmountToCents('(40 + 5) / 3'), 1500);
  });

  it('preserves parenthesized negatives when no arithmetic operators exist', () => {
    assert.equal(TruthEngine.parseAmountToCents('(123.45)'), -12345);
  });

  it('applies CR and DR suffixes to expressions', () => {
    assert.equal(TruthEngine.parseAmountToCents('(10 + 5) CR'), -1500);
    assert.equal(TruthEngine.parseAmountToCents('(10 + 5) DR'), 1500);
  });

  it('handles standard decimal strings normally', () => {
    assert.equal(TruthEngine.parseAmountToCents('1,234.56'), 123456);
    assert.equal(TruthEngine.parseAmountToCents('$45.00'), 4500);
  });
});
