import test from 'node:test';
import assert from 'node:assert/strict';
import { getCeiling, tightenCeiling } from './eslint-warning-ratchet.mjs';

const pkg = () => ({ scripts: { 'lint:eslint': 'eslint . --max-warnings 212', test: 'echo ok' } });

test('preserves the existing 212 warning ceiling', () => {
  assert.equal(getCeiling(pkg()), 212);
  assert.equal(getCeiling({ scripts: { 'lint:eslint': 'eslint . --max-warnings=212' } }), 212);
});

test('automatically lowers the ceiling on an improvement only', () => {
  const original = pkg();
  const result = tightenCeiling(original, 190);
  assert.equal(result.changed, true);
  assert.equal(result.ceiling, 190);
  assert.equal(result.pkg.scripts['lint:eslint'], 'eslint . --max-warnings 190');
  assert.equal(result.pkg.scripts.test, 'echo ok');
  assert.equal(original.scripts['lint:eslint'], 'eslint . --max-warnings 212');
});

test('equal warning count is a no-op', () => {
  const original = pkg();
  const result = tightenCeiling(original, 212);
  assert.equal(result.changed, false);
  assert.equal(result.pkg, original);
});

test('never increases the budget or accepts invalid input', () => {
  assert.throws(() => tightenCeiling(pkg(), 213), /Refusing/);
  assert.throws(() => tightenCeiling(pkg(), -1), /Invalid warning count/);
  assert.throws(() => tightenCeiling(pkg(), 1.5), /Invalid warning count/);
  assert.throws(() => getCeiling({ scripts: { 'lint:eslint': 'eslint .' } }), /missing --max-warnings/);
});
