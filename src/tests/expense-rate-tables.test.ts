/**
 * A-75 + A-76: the dated per-country rate tables against the authorities' own published figures.
 * Every row carries validFrom/validTo and a source; nothing is invented and nothing converts.
 *
 * Worked figures (from the authorities' pages):
 *   UK car, 5 Apr 2026: £0.45/mi (2011/12–2025/26 tier, 25p over 10,000 miles in the tax year)
 *   UK car, 6 Apr 2026: £0.55/mi (2026/27, set 21 May 2026 and backdated)
 *   US car, 1 Jul 2023: $0.655/mi (IRS Notice 2023-03) — A-108's row is the US source of truth
 *   US M&IE, 1 Jan 2026: $68.00/day (GSA FY2026 standard CONUS); 1 Oct 2026: $68.00 (FY2027)
 *   UK full day, today: £25.00 (HMRC benchmark scale, 15-hour/24-hour rate since 6 Apr 2016)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MILEAGE_RATE_ROWS, PER_DIEM_ROWS, mileageRateFor, perDiemRateFor,
  rateTextFromThousandths, rateSuggestionText,
} from '../lib/tax/expenseRateTables';
import { US_MILEAGE_RATES } from '../lib/tax/usMileageRates';

test('A-75 every mileage row has a period, a source and a unit, and rows do not overlap', () => {
  for (const r of MILEAGE_RATE_ROWS) {
    assert.match(r.validFrom, /^\d{4}-\d{2}-\d{2}$/, `${r.country} ${r.vehicle} has a validFrom`);
    assert.ok(r.source.authority && r.source.url && r.source.retrieved, `${r.country} ${r.vehicle} names its source`);
    assert.ok(['mi', 'km'].includes(r.unit));
    assert.ok(r.rateThousandths > 0);
    assert.equal(r.source.status, 'calculation');
  }
  for (const country of ['US', 'GB'] as const) {
    for (const vehicle of ['car', 'motorcycle', 'bicycle'] as const) {
      const rows = MILEAGE_RATE_ROWS.filter(r => r.country === country && r.vehicle === vehicle)
        .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
      for (let i = 1; i < rows.length; i += 1) {
        assert.ok(rows[i - 1].validTo, `a later ${country} ${vehicle} row means the earlier one has an end`);
        assert.ok(rows[i - 1].validTo! < rows[i].validFrom, `${country} ${vehicle} rows do not overlap`);
      }
    }
  }
});

test('A-75 worked figures: UK cars 45p until 5 Apr 2026 and 55p from 6 Apr 2026; the US is A-108\'s table', () => {
  const before = mileageRateFor({ country: 'GB', date: '2026-04-05', unit: 'mi', currency: 'GBP' });
  assert.equal(before?.rateText, '0.45');
  assert.match(before?.row.note || '', /25p for each mile after/);
  const after = mileageRateFor({ country: 'GB', date: '2026-04-06', unit: 'mi', currency: 'GBP' });
  assert.equal(after?.rateText, '0.55');
  assert.equal(mileageRateFor({ country: 'GB', date: '2011-04-05', unit: 'mi', currency: 'GBP' }), null, 'before the table starts there is no row');

  for (const day of ['2020-06-01', '2022-03-01', '2022-08-01', '2023-07-01', '2025-03-01', '2026-06-01']) {
    const us = mileageRateFor({ country: 'US', date: day, unit: 'mi', currency: 'USD' });
    const a108 = US_MILEAGE_RATES.find(r => r.validFrom <= day && (!r.validTo || r.validTo >= day));
    assert.equal(us?.row.rateThousandths, a108?.rateThousandths, `US row for ${day} is A-108's own row`);
    assert.equal(us?.rateText, rateTextFromThousandths(a108?.rateThousandths || 0));
  }
  assert.equal(mileageRateFor({ country: 'US', date: '2023-07-01', unit: 'mi', currency: 'USD' })?.rateText, '0.655');
});

test('A-75 a per-mile row never fills a per-km line and a foreign currency is shown, never converted', () => {
  const km = mileageRateFor({ country: 'GB', date: '2026-04-06', unit: 'km', currency: 'GBP' });
  assert.equal(km?.matchesUnit, false);
  assert.equal(km?.rateText, '0.55', 'the rate is still shown');
  const usd = mileageRateFor({ country: 'GB', date: '2026-04-06', unit: 'mi', currency: 'USD' });
  assert.equal(usd?.matchesCurrency, false);
  const text = rateSuggestionText(usd!, '2026-04-06');
  assert.match(text, /no conversion is made/);
  assert.match(text, /HM Revenue & Customs/);
  const kmText = rateSuggestionText(km!, '2026-04-06');
  assert.match(kmText, /does not fill this kilometre line/);
});

test('A-76 worked figures: US M&IE $68.00 across the GSA fiscal years; UK full day £25.00', () => {
  assert.deepEqual(
    ['2025-01-15', '2025-12-01', '2026-10-21'].map(d => perDiemRateFor({ country: 'US', date: d, currency: 'USD' })?.dailyText),
    ['68.00', '68.00', '68.00'],
  );
  const fyEdge = perDiemRateFor({ country: 'US', date: '2026-09-30', currency: 'USD' });
  assert.equal(fyEdge?.row.validTo, '2026-09-30');
  assert.match(fyEdge?.row.note || '', /FY2026/);
  const today = perDiemRateFor({ country: 'GB', date: '2026-10-21', currency: 'GBP' });
  assert.equal(today?.dailyText, '25.00');
  assert.match(today?.row.note || '', /£5.00 one meal/);
  assert.equal(perDiemRateFor({ country: 'US', date: '2024-09-30', currency: 'USD' }), null, 'before FY2025 there is no row');
  assert.equal(perDiemRateFor({ country: 'FR', date: '2026-10-21', currency: 'EUR' }), null, 'countries without a verified row are absent');
});

test('A-76 every per-diem row has a period, a source and says what it covers', () => {
  for (const r of PER_DIEM_ROWS) {
    assert.match(r.validFrom, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(r.source.authority && r.source.url && r.source.retrieved);
    assert.equal(r.source.status, 'calculation');
    assert.ok(r.dailyCents > 0 && r.area.length > 0);
    assert.ok(r.note, 'the note says what the allowance covers and what it does not');
  }
  assert.match(rateSuggestionText(perDiemRateFor({ country: 'US', date: '2026-01-01', currency: 'USD' })!, '2026-01-01'), /fills the rate while the field is empty/);
});
