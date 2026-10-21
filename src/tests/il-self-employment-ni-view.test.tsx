import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import IlSelfEmploymentNiReportView from '../components/reporting/IlSelfEmploymentNiReportView';

describe('Israel self-employed national insurance report', () => {
  afterEach(() => cleanup());
  test('shows the dated bands, both answers for an income, and the Authority example', () => {
    render(<IlSelfEmploymentNiReportView />);
    const text = document.body.textContent || '';
    assert.match(text, /2025-02-01/);
    assert.match(text, /2026-01-01/);
    assert.ok(screen.getByRole('table'), 'the bands are a table');
    // the Authority's example is on the screen and the default income reproduces it
    assert.match(text, /₪3,864/);
    const advance = document.body.querySelector('[data-figure="Advance, a month"]');
    assert.ok(advance, 'the advance line is shown');
    assert.match(advance.textContent || '', /₪1,366\.59/);
    const settlement = document.body.querySelector('[data-figure="Settlement, a quarter"]');
    assert.ok(settlement, 'the settlement line is shown');
    assert.match(settlement.textContent || '', /₪3,864\.01/);
    assert.match(settlement.textContent || '', /₪34,690\.20/);
    assert.match(text, /calculation status/i);
  });
  test('a year with no row says so instead of showing a figure', () => {
    render(<IlSelfEmploymentNiReportView />);
    fireEvent.change(screen.getByLabelText('Check date'), { target: { value: '2024-06-15' } });
    const text = document.body.textContent || '';
    assert.match(text, /No row of this table covers 2024-06-15/);
    assert.equal(document.body.querySelector('[data-figure="Advance, a month"]'), null);
  });
});
