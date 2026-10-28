/**
 * C-94: a loading report shows its own shape, not a spinner. The skeleton announces one polite
 * status, keeps the decoration out of the accessibility tree, and the report shell uses it for every
 * report instead of the old spinning icon.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import ReportSkeleton from '../components/reporting/ReportSkeleton';

afterEach(() => cleanup());

describe('The report loading skeleton', () => {
  test('a loading report announces one status and shows placeholder rows', () => {
    const { container } = render(<ReportSkeleton rows={5} columns={3} label="Loading report records…" />);
    const status = screen.getByRole('status');
    assert.match(status.textContent || '', /Loading report records…/);
    assert.equal(status.getAttribute('aria-busy'), null, 'a busy live region can hold its own announcement back');
    // one header row plus the five placeholder rows, three cells each
    assert.equal(container.querySelectorAll('[aria-hidden="true"] [style]').length, 6);
    assert.equal(screen.queryAllByRole('status').length, 1, 'one live region, not one per row');
  });

  test('the placeholder bars stay out of the accessibility tree', () => {
    const { container } = render(<ReportSkeleton rows={2} columns={2} />);
    const decoration = container.querySelector('[aria-hidden="true"]');
    assert.ok(decoration, 'the bars are decoration for the eye');
    assert.equal(decoration!.querySelectorAll('[role],table,th,td').length, 0, 'no fake table or fake roles');
    assert.match((screen.getByRole('status').textContent || ''), /Loading the report/, 'a default label is always spoken');
  });

  test('the report shell loads every report with the skeleton, not a spinner', () => {
    const source = readFileSync('src/components/reporting/Reports.tsx', 'utf8');
    assert.match(source, /fallback=\{<ReportSkeleton/, 'the report area uses the skeleton');
    assert.equal(/animate-spin/.test(source), false, 'no spinner is left in the report area');
    const pack = readFileSync('src/components/reporting/reportPack/ReportPackDialog.tsx', 'utf8');
    assert.match(pack, /ReportSkeleton/, 'the slowest read in reports — preparing the pack — shows it too');
    assert.match(pack, /role="status"[^>]*>Reading all selected reports/, 'the status text stays for screen readers');
  });
});
