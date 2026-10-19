import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, render, screen } from '@testing-library/react';
afterEach(() => cleanup());
import { GoldenYearFixturesPanel } from '../components/reporting/GoldenYearFixturesSection';
import { verifyGoldenYearFixtures } from '../lib/goldenYearFixtures';

test('A-198/A-199 screen: both years are shown with their checked periods', () => {
  render(<GoldenYearFixturesPanel result={verifyGoldenYearFixtures()} />);
  assert.ok(screen.getByRole('heading', { name: 'Full-year golden scenarios' }));
  assert.ok(screen.getByText(/All 6 Israeli periods and 4 Texas quarters match the worked figures/));
  // the period rows (not only the headings) are on the screen
  assert.ok(screen.getByText('2026-01'));
  assert.ok(screen.getByText('2026-Q4'));
  // the year totals row exists in both tables
  assert.equal(screen.getAllByText('Year').length >= 2, true);
  // the limits are stated where a reader of the numbers will see them
  assert.ok(screen.getByText((_c, el) => el?.tagName === 'P' && /state base rate only/.test(el.textContent ?? '') && /never be read as the full amount due/.test(el.textContent ?? '')));
});

test('A-198/A-199 screen: a mismatch names the period, never hides it', () => {
  render(<GoldenYearFixturesPanel result={{
    ilPeriods: 6, txQuarters: 4,
    failures: [
      { id: 'A-198 2026-05', detail: 'toPayCents: worked -234000, library says 0' },
      { id: 'A-199 2026-Q3', detail: 'taxCollectedCents: worked 145833, library says 145834' },
    ],
  }} />);
  assert.match(screen.getByText(/2 full-year check\(s\) fail/).textContent ?? '', /2 full-year/);
  assert.ok(screen.getByText('A-198 2026-05: toPayCents: worked -234000, library says 0'));
  assert.ok(screen.getByText('A-199 2026-Q3: taxCollectedCents: worked 145833, library says 145834'));
  // both named rows say they fail beside the row itself
  assert.equal(screen.getAllByText('Fails — see above').length, 2);
});

test('A-106 screen: the 1099 thresholds appear with the 2026 change', () => {
  render(<GoldenYearFixturesPanel result={verifyGoldenYearFixtures()} />);
  assert.ok(screen.getByRole('heading', { name: /US 1099 reporting thresholds by year/ }));
  assert.ok(screen.getAllByText('1099-NEC box 1 (nonemployee compensation)').length >= 2);
  assert.ok(screen.getAllByText('$600.00').length >= 2); // the $600 rows
  assert.ok(screen.getAllByText('$2,000.00').length >= 2); // the $2,000 rows
  assert.ok(screen.getByText(/did not change with the 2026 increase/));
});
