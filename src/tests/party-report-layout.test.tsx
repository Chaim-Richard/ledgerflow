/**
 * Report tables (I-14): the header stays in view while scrolling and a totals row adds up the
 * money columns over the rows shown (after search).
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Users } from 'lucide-react';
import { PartyReportLayout } from '../components/reporting/PartyReportLayout';

type Row = { id: string; name: string; balanceCents: number; paidCents: number };
const rows: Row[] = [
  { id: 'a', name: 'Acme', balanceCents: 12_500, paidCents: 1_000 },
  { id: 'b', name: 'Beta', balanceCents: -2_500, paidCents: 4_000 },
];

function renderReport(data: Row[], sumKeys?: Array<keyof Row & string>) {
  return render(
    <PartyReportLayout<Row>
      title="Balances" description="d" icon={Users} totalLabel="Due" totalAmountCents={0}
      exportFilename="x.csv" onExportCSV={() => {}} searchTerm="" onSearchChange={() => {}}
      columns={[
        { key: 'name', header: 'Customer' },
        { key: 'paidCents', header: 'Paid', align: 'right' },
        { key: 'balanceCents', header: 'Balance', align: 'right' },
      ]}
      data={data} getRowId={r => r.id} sumKeys={sumKeys}
    />,
  );
}

describe('Report table', () => {
  afterEach(() => cleanup());

  test('a totals row adds up the chosen money columns over the rows shown', () => {
    const { container } = renderReport(rows, ['paidCents', 'balanceCents']);
    const foot = container.querySelector('tfoot');
    assert.ok(foot);
    const cells = within(foot as HTMLElement).getAllByRole('cell').map(c => c.textContent);
    assert.deepEqual(cells, ['Total (2)', '$50.00', '$100.00']);
  });

  test('no totals row when none is asked for or nothing is shown', () => {
    assert.equal(renderReport(rows).container.querySelector('tfoot'), null);
    cleanup();
    assert.equal(renderReport([], ['balanceCents']).container.querySelector('tfoot'), null);
  });

  test('the header row stays at the top while the table scrolls', () => {
    renderReport(rows, ['balanceCents']);
    const thead = screen.getByRole('columnheader', { name: 'Customer' }).closest('thead');
    assert.match(thead?.className || '', /sticky top-0/);
  });
});
