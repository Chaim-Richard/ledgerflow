import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
afterEach(() => cleanup());
import { GOLDEN_BILLS, GOLDEN_INVOICES, verifyGoldenFixtures } from '../lib/tax/goldenFixtures';
import { GoldenTaxFixturesPanel } from '../components/reporting/GoldenTaxFixturesReportView';

test('A-146/A-147 screen: all fixtures shown as matching when tables agree', () => {
  render(<GoldenTaxFixturesPanel invoices={GOLDEN_INVOICES} bills={GOLDEN_BILLS} failures={verifyGoldenFixtures().failures} />);
  assert.ok(screen.getByRole('heading', { name: 'Golden tax fixtures' }));
  assert.match(screen.getByRole('status').textContent ?? '', /All 80 fixtures match/);
  assert.ok(screen.getByText('GF-INV-01'));
  assert.ok(screen.getByText('GF-BILL-30'));
  assert.ok(screen.getByText((_c, el) => el?.tagName === 'P' && /state base rate only/.test(el.textContent ?? '') && /never be read as the full amount/.test(el.textContent ?? '')));
});

test('A-146/A-147 screen: a failing fixture is named, never hidden', () => {
  render(<GoldenTaxFixturesPanel invoices={GOLDEN_INVOICES} bills={GOLDEN_BILLS}
    failures={[{ id: 'GF-INV-01', detail: 'line 1: fixture says 0.17/1700, tables say 0.18/1800' }]} />);
  assert.ok(screen.getByRole('alert'));
  assert.match(screen.getByRole('alert').textContent ?? '', /1 fixture check\(s\) fail/);
  assert.ok(screen.getByText(/GF-INV-01: line 1/));
});
