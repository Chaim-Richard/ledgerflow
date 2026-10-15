import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentMethodCsvAmount } from '../lib/paymentMethodCsvAmount';

test('E-23 exports money in the currency minor-unit scale, not a hard-coded two-decimal scale', () => {
  assert.equal(paymentMethodCsvAmount(1234, 'USD'), '12.34');
  assert.equal(paymentMethodCsvAmount(1234, 'JPY'), '1234');
  assert.equal(paymentMethodCsvAmount(1234, 'BHD'), '1.234');
  assert.equal(paymentMethodCsvAmount(5, 'KWD'), '0.005');
  assert.equal(paymentMethodCsvAmount(-101, 'USD'), '-1.01');
  assert.equal(paymentMethodCsvAmount(0, 'JPY'), '0');
});

test('E-23 exports safe large integers exactly and rejects unsafe numeric totals', () => {
  assert.equal(paymentMethodCsvAmount(Number.MAX_SAFE_INTEGER, 'USD'), '90071992547409.91');
  assert.throws(() => paymentMethodCsvAmount(Number.MAX_SAFE_INTEGER + 1, 'USD'), /Unsafe/);
  assert.throws(() => paymentMethodCsvAmount(1.5, 'USD'), /Unsafe/);
  assert.throws(() => paymentMethodCsvAmount(2, 'NOT-A-CURRENCY'), /Invalid/);
});
