import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { DuplicateContactReviewPanel } from '../components/reporting/DuplicateContactReviewReportView';
import { findDuplicateContactCandidates } from '../lib/contactDuplicateReview';

afterEach(() => cleanup());

const flushReportTable = async () => {
  await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
};

test('A-135 review screen shows customer/vendor suggestions and never offers an automatic merge', async () => {
  const report = findDuplicateContactCandidates([
    { id: 'c1', kind: 'customer', name: 'Acme Ltd', email: 'office@acme.test' },
    { id: 'v1', kind: 'vendor', name: 'Acme Limited', email: 'OFFICE@ACME.TEST' },
    { id: 'c2', kind: 'customer', name: 'North Shore' },
    { id: 'v2', kind: 'vendor', name: 'North-Shore' },
  ]);
  render(<DuplicateContactReviewPanel report={report} />);
  await flushReportTable();

  assert.ok(screen.getByRole('heading', { name: 'Duplicate contact review' }));
  assert.match(screen.getByRole('table').textContent || '', /Same email/);
  assert.match(screen.getByRole('table').textContent || '', /Weak name suggestion/);
  assert.equal(screen.queryByRole('button', { name: /merge/i }), null);
  fireEvent.change(screen.getByLabelText('Match evidence'), { target: { value: 'name-only' } });
  assert.match(screen.getByRole('table').textContent || '', /North Shore/);
  assert.doesNotMatch(screen.getByRole('table').textContent || '', /Acme Ltd/);
});

test('A-135 review screen disables export for incomplete history and states the limitation', async () => {
  const report = findDuplicateContactCandidates([
    { id: 'c1', kind: 'customer', name: 'Same Contact' },
    { id: 'c2', kind: 'customer', name: 'Same-Contact' },
  ]);
  render(<DuplicateContactReviewPanel report={report} partial />);
  await flushReportTable();
  assert.ok(screen.getByRole('alert').textContent?.includes('capped or failed'));
  assert.equal((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled, true);
});
