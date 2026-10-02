/** Drill-down (I-16): a breadcrumb back to the report, and it behaves as a dialog. */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DrillDownModal from '../components/layout/DrillDownModal';

describe('Drill-down', () => {
  afterEach(() => cleanup());

  test('shows where it came from; the breadcrumb goes back', () => {
    let closed = 0;
    render(<DrillDownModal isOpen onClose={() => { closed++; }} accountName="Rent" transactions={[]} formatCurrency={c => String(c)} from="Profit & Loss" />);
    assert.ok(screen.getByRole('dialog', { name: 'Rent' }));
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    assert.match(crumb.textContent || '', /Profit & Loss › Rent/);
    fireEvent.click(screen.getByRole('button', { name: 'Profit & Loss' }));
    assert.equal(closed, 1);
  });

  test('no breadcrumb when the caller does not say where it came from', () => {
    render(<DrillDownModal isOpen onClose={() => {}} accountName="Rent" transactions={[]} formatCurrency={c => String(c)} />);
    assert.equal(screen.queryByRole('navigation', { name: 'Breadcrumb' }), null);
  });
});
