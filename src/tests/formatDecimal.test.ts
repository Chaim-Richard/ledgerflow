import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { formatDecimal } from '../lib/utils.js';

describe('formatDecimal tests', () => {
  test('formats positive cents', () => {
    assert.equal(formatDecimal(1005), '10.05');
  });
  test('formats negative cents', () => {
    assert.equal(formatDecimal(-1005), '-10.05');
  });
  test('formats zero', () => {
    assert.equal(formatDecimal(0), '0.00');
  });
  test('formats single digit cents', () => {
    assert.equal(formatDecimal(5), '0.05');
    assert.equal(formatDecimal(-5), '-0.05');
  });
  test('formats invalid', () => {
    assert.equal(formatDecimal(NaN), '0.00');
    assert.equal(formatDecimal(null as any), '0.00');
  });
});
