import test from 'node:test';
import assert from 'node:assert/strict';
import { GOLDEN_BILLS, GOLDEN_INVOICES, goldenCsvRows, recomputeInvoice, verifyGoldenFixtures } from '../lib/goldenTaxFixtures';

test('A-146: exactly 50 golden invoices, IL and US only (PLAN §15)', () => {
  assert.equal(GOLDEN_INVOICES.length, 50);
  assert.equal(GOLDEN_INVOICES.filter(c => c.country === 'IL').length, 25);
  assert.equal(GOLDEN_INVOICES.filter(c => c.country === 'US').length, 25);
  assert.ok(GOLDEN_INVOICES.every(c => c.country === 'IL' || c.country === 'US'));
  assert.equal(new Set(GOLDEN_INVOICES.map(c => c.id)).size, 50);
});

test('A-147: exactly 30 golden bills, IL withholding and US 1099 only', () => {
  assert.equal(GOLDEN_BILLS.length, 30);
  assert.equal(GOLDEN_BILLS.filter(b => b.country === 'IL').length, 15);
  assert.equal(GOLDEN_BILLS.filter(b => b.country === 'US').length, 15);
  assert.equal(new Set(GOLDEN_BILLS.map(b => b.id)).size, 30);
});

test('A-146/A-147: every fixture matches the dated tables it names', () => {
  const result = verifyGoldenFixtures();
  assert.deepEqual(result, { invoices: 50, bills: 30, failures: [] });
});

test('A-146: hand-checked spots — IL rate change, Eilat, TX, rounding', () => {
  const byId = new Map(GOLDEN_INVOICES.map(c => [c.id, c]));
  // ₪100 at 17% (2024) = ₪17; at 18% (2025-01-01) = ₪18
  assert.equal(byId.get('GF-INV-01')!.expectedTaxTotalCents, 1700);
  assert.equal(byId.get('GF-INV-06')!.expectedTaxTotalCents, 1800);
  assert.equal(byId.get('GF-INV-03')!.expectedTaxTotalCents, 567); // 3333 × 17% = 566.61 → 567
  assert.equal(byId.get('GF-INV-12')!.expectedTaxTotalCents, 0); // Eilat
  const tx = GOLDEN_INVOICES.find(c => c.country === 'US' && c.place === 'TX' && c.treatment === 'standard')!;
  assert.equal(tx.lines[0].expectedRate, 0.0625);
  assert.deepEqual(recomputeInvoice(tx)[0], { rate: 0.0625, taxCents: tx.lines[0].expectedTaxCents });
});

test('A-147: hand-checked spots — IL default vs certificate, 1099 threshold years', () => {
  const byId = new Map(GOLDEN_BILLS.map(b => [b.id, b]));
  assert.equal(byId.get('GF-BILL-01')!.expectedWithheldCents, 30000); // (₪1,180−₪180 VAT) × 30%
  assert.equal(byId.get('GF-BILL-02')!.expectedWithheldCents, 0); // exemption certificate
  assert.equal(byId.get('GF-BILL-16')!.expectedReportable, true); // 2025 NEC exactly $600
  assert.equal(byId.get('GF-BILL-17')!.expectedReportable, false); // $599.99
  assert.equal(byId.get('GF-BILL-19')!.expectedReportable, false); // 2026 NEC $1,500 < $2,000
  assert.equal(byId.get('GF-BILL-20')!.expectedReportable, true); // 2026 NEC exactly $2,000
});

test('A-146/A-147: totals add up and CSV covers every case', () => {
  for (const c of GOLDEN_INVOICES) {
    const net = c.lines.reduce((s, l) => s + l.netCents, 0);
    assert.equal(net + c.expectedTaxTotalCents, c.expectedGrossCents, c.id);
  }
  assert.equal(goldenCsvRows().length, 80);
});
