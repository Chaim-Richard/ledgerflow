import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import MileageRatesReportView from '../components/reporting/MileageRatesReportView';

describe('Mileage rates report', () => {
  beforeEach(() => {});
  afterEach(() => cleanup());
  test('shows dated rows and the rate in force for a date', () => {
    render(<MileageRatesReportView />);
    const text = document.body.textContent || '';
    assert.match(text, /57\.5¢.*2020/);
    assert.match(text, /62\.5¢.*Jul.*2022/);
    assert.match(text, /65\.5¢.*2023/);
    assert.match(text, /70¢.*2025/);
    assert.match(text, /In force on/);
    // table has rows
    assert.ok(screen.getByRole('table'));
    assert.match(text, /IRS standard mileage rates/);
  });
});
