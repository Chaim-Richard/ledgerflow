/** Starting tax codes for a new workspace: Israel's VAT is 18% (since 1 Jan 2025). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDefaultTaxRates, getDefaultTaxConfig } from '../lib/taxRateDefaults';

test('Israel starts at 18% VAT', () => {
  assert.equal(getDefaultTaxConfig('il').defaultRate, 0.18);
  const [standard] = generateDefaultTaxRates('IL');
  assert.equal(standard.rate, 0.18);
  assert.match(standard.name, /\(18%\)/);
});
