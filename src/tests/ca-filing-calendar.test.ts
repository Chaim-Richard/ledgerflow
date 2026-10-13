/**
 * A-51: Canada's consumption-tax filing calendar. Hand-checked from the CRA's and Revenu Québec's
 * published bands: GST/HST annual up to $1.5M, quarterly to $6M, monthly above, with the large
 * supplier's annual exclusion on the row; QST $1.2M/$6M; BC, SK and MB monthly with no band. The
 * pack writes one entity-period filing rule per row, with the band in the effect — a planning
 * answer, never a conclusion that an entity files on that period.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CA_FILING_CALENDAR, CA_FILING_TAXES, caFilingBandFor, caFilingRows, caFilingCalendarProblems } from '../lib/tax/caFilingCalendar';
import { caFilingPack } from '../lib/rules/packs/caFilingPack';
import { taxRulePackProblems } from '../lib/rules/packs/index';

test('the table holds to its own promises', () => {
  assert.deepEqual(caFilingCalendarProblems(), []);
  for (const tax of CA_FILING_TAXES) assert.ok(caFilingRows(tax).length >= 1, tax);
  for (const row of CA_FILING_CALENDAR) {
    assert.match(row.source, /^https:\/\//, row.tax);
    assert.match(row.validFrom, /^\d{4}-\d{2}-\d{2}$/, row.tax);
    assert.ok(row.due.length > 10, `${row.tax} ${row.frequency} says when it is due in the source's words`);
  }
});

test('GST/HST: the CRA bands pick exactly one frequency, boundaries on the lower one', () => {
  assert.equal(caFilingBandFor('GST/HST', 0)?.frequency, 'annual');
  assert.equal(caFilingBandFor('GST/HST', 150_000_000)?.frequency, 'annual', 'exactly $1.5M is still annual');
  assert.equal(caFilingBandFor('GST/HST', 150_000_001)?.frequency, 'quarterly');
  assert.equal(caFilingBandFor('GST/HST', 600_000_000)?.frequency, 'quarterly', 'exactly $6M is still quarterly');
  assert.equal(caFilingBandFor('GST/HST', 600_000_001)?.frequency, 'monthly');
  assert.equal(caFilingBandFor('GST/HST', 3_000_000_001)?.frequency, 'monthly');
  const annual = caFilingBandFor('GST/HST', 100_000_000);
  assert.match(annual?.note || '', /\$30M/, 'the large supplier exclusion is stated on the row, never hidden');
  assert.match(caFilingRows('GST/HST').find(r => r.frequency === 'quarterly')?.note || '', /not available to a large supplier/);
  assert.equal(caFilingBandFor('GST/HST', -5), undefined, 'a negative revenue is refused, not banded');
  assert.equal(caFilingBandFor('GST/HST', Number.NaN), undefined);
});

test('QST: the Revenu Québec bands; provincial sales taxes are monthly with no band', () => {
  assert.equal(caFilingBandFor('QST', 120_000_000)?.frequency, 'annual', 'exactly $1.2M is still annual');
  assert.equal(caFilingBandFor('QST', 120_000_001)?.frequency, 'quarterly');
  assert.equal(caFilingBandFor('QST', 600_000_001)?.frequency, 'monthly');
  assert.match(caFilingBandFor('QST', 100)?.due || '', /four months after the end of the fiscal year/);
  for (const tax of ['BC PST', 'SK PST', 'MB RST'] as const) {
    const rows = caFilingRows(tax);
    assert.equal(rows.length, 1, tax);
    assert.equal(rows[0].frequency, 'monthly');
    assert.equal(caFilingBandFor(tax, 1)?.province, rows[0].province);
  }
  assert.match(caFilingBandFor('BC PST', 1)?.due || '', /last day of the month after/);
  assert.match(caFilingBandFor('MB RST', 1)?.due || '', /20th of the month after/);
});

test('the pack writes one entity-period filing rule per row, with the band in the effect', () => {
  const pack = caFilingPack();
  assert.equal(pack.id, 'ca-filing-calendar');
  assert.equal(pack.rules.length, CA_FILING_CALENDAR.length);
  assert.deepEqual(taxRulePackProblems().filter(p => p.pack === 'ca-filing-calendar'), []);
  for (const rule of pack.rules) {
    assert.equal(rule.scope, 'entity-period', rule.id);
    assert.ok(rule.effect.kind === 'filing', rule.id);
    assert.ok(rule.when.some(c => c.attribute === 'country' && c.values?.includes('CA')), rule.id);
    assert.match(rule.source.url, /^https:\/\/(www\.canada\.ca|www\.revenuquebec\.ca|www2\.gov\.bc\.ca|www\.saskatchewan\.ca|taxation-finances\.gov\.mb\.ca)/, rule.id);
  }
  const gstAnnual = pack.rules.find(r => r.id === 'ca-filing-gst-hst-federal-annual');
  assert.ok(gstAnnual && gstAnnual.effect.kind === 'filing');
  assert.equal(gstAnnual.effect.frequency, 'yearly', "the filing effect's own vocabulary spells annual 'yearly'");
  assert.deepEqual(gstAnnual.effect.revenueBand, { minCents: null, maxCents: 150_000_000, currency: 'CAD' });
  assert.equal(gstAnnual.effect.tax, 'GST/HST');
  const qcMonthly = pack.rules.find(r => r.id === 'ca-filing-qst-qc-monthly');
  assert.ok(qcMonthly && qcMonthly.when.some(c => c.attribute === 'state' && c.values?.includes('QC')));
  const bc = pack.rules.find(r => r.id === 'ca-filing-bc-pst-bc-monthly');
  assert.ok(bc && bc.effect.kind === 'filing' && bc.effect.revenueBand === undefined, 'an unbanded row carries no band');
});
