import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { evaluateAmountExpression } from './amountExpression';
import { TruthEngine } from '../modules/integrity/TruthEngine';

describe('amountExpression tests', () => {
  test('evaluates simple addition', () => {
    assert.equal(evaluateAmountExpression('12.50 + 3.20'), 1570);
  });

  test('evaluates expression with parenthesis and division', () => {
    assert.equal(evaluateAmountExpression('(40 + 5) / 3'), 1500);
  });

  test('evaluates division with exact half-up cent rounding', () => {
    assert.equal(evaluateAmountExpression('100 / 3'), 3333);
    assert.equal(evaluateAmountExpression('100 / 3 * 2'), 6667);
  });

  test('evaluates subtraction and decimals', () => {
    assert.equal(evaluateAmountExpression('50.00 - 12.25'), 3775);
  });

  test('evaluates unary minus', () => {
    assert.equal(evaluateAmountExpression('-10 + 2'), -800);
  });

  test('rejects division by zero explicitly', () => {
    assert.throws(() => evaluateAmountExpression('100 / 0'), /Division by zero/);
  });

  test('rejects expressions exceeding max length', () => {
    const longExpr = '1 + '.repeat(30) + '1';
    assert.throws(() => evaluateAmountExpression(longExpr), /exceeds maximum length/);
  });

  test('rejects excessive parenthesis depth', () => {
    const deepParens = '((((((((((((( 1 )))))))))))))';
    assert.throws(() => evaluateAmountExpression(deepParens), /Parenthesis nesting depth/);
  });
});

describe('TruthEngine integration with amount expressions', () => {
  test('parses arithmetic expressions', () => {
    assert.equal(TruthEngine.parseAmountToCents('12.50 + 3.20'), 1570);
    assert.equal(TruthEngine.parseAmountToCents('(40+5)/3'), 1500);
    assert.equal(TruthEngine.parseAmountToCents('$100 / 2'), 5000);
  });

  test('preserves parenthesized negatives when no arithmetic operators exist', () => {
    assert.equal(TruthEngine.parseAmountToCents('(123.45)'), -12345);
  });

  test('applies CR and DR suffixes to expressions', () => {
    assert.equal(TruthEngine.parseAmountToCents('50 + 20 CR'), -7000);
    assert.equal(TruthEngine.parseAmountToCents('50 + 20 DR'), 7000);
  });

  test('handles standard decimal strings normally', () => {
    assert.equal(TruthEngine.parseAmountToCents('42.50'), 4250);
    assert.equal(TruthEngine.parseAmountToCents('-15.00'), -1500);
  });
});
