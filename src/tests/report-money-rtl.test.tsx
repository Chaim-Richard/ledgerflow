import { stubFetch } from './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import PartyAgingReportView from '../components/reporting/PartyAgingReportView';
import { StatementColumns } from '../components/ledger/StatementColumns';
import { setComponentWorkspace, markComponentCollectionsLoaded } from './helpers/componentFixtures';
import { makeChartAccount, makeCustomer, makeInvoice, makeTransaction } from './fixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { formatCurrency } from '../lib/utils';
import { csvMoney, toCsv } from '../lib/csvExport';
import { computeProfitAndLoss } from '../server/reports/computeReports';

afterEach(() => { cleanup(); useLedgerStore.setState({ baseCurrency: 'USD' }); });
function setup(negativeStyle: 'minus' | 'accounting') {
  stubFetch(404);
  const workspace = setComponentWorkspace();
  useAuthStore.setState({ workspaces: [{ ...workspace, currency: 'ILS', moneyDisplay: { locale: 'he-IL', negativeStyle } }] });
  window.__ledgerBaseCurrency = 'ILS';
  markComponentCollectionsLoaded('customers', 'vendors', 'invoices', 'bills');
  useLedgerStore.setState({ baseCurrency: 'ILS', isDataTruncated: false, truncatedCollections: {}, vendors: [], bills: [] });
}
function isolated(element: Element) {
  assert.equal(element.tagName, 'BDI');
  assert.equal(element.getAttribute('dir'), 'auto');
  assert.equal((element as HTMLElement).style.unicodeBidi, 'isolate');
}

for (const style of ['minus', 'accounting'] as const) {
  test(`he-IL ${style}: report account and totals isolate the exact negative money string; CSV keeps numeric cents`, () => {
    setup(style);
    const accounts = [makeChartAccount({ id: 'cash' }), makeChartAccount({ id: 'sales', name: 'מכירות Sales', type: 'income', category: 'Revenue' })];
    const transactions = [makeTransaction({ date: '2024-02-15', totalAmountCents: 123456, lines: [{ accountId: 'cash', amountCents: -123456 }, { accountId: 'sales', amountCents: 123456 }] })];
    const total = computeProfitAndLoss(accounts, transactions, '2024-02-01', '2024-02-29');
    const view = render(<div dir="rtl"><StatementColumns kind="pl" title="Profit and Loss" accounts={accounts} transactions={transactions}
      startDate="2024-02-01" endDate="2024-02-29" compare={false} mode="total" onModeChange={() => {}}
      showPercent onPercentChange={() => {}} totalData={total} previousTotalData={total} totalAuthoritative
      formatMoney={formatCurrency} onSort={() => {}} onDrillDown={() => {}} /></div>);
    for (const name of ['מכירות Sales', 'Net income']) {
      const row = view.getByRole('row', { name: new RegExp(name) });
      const amount = row.querySelector('td.text-right bdi')!;
      isolated(amount);
      assert.equal(amount.textContent, formatCurrency(-123456));
      assert.match(amount.textContent || '', /1,234\.56/);
      assert.ok(amount.textContent?.includes('₪'));
      if (style === 'accounting') assert.ok(amount.textContent?.startsWith('(') && amount.textContent.endsWith(')'));
      else assert.ok(amount.textContent?.includes('-'));
    }
    assert.ok(toCsv(['שם', 'Amount'], [['מכירות Sales', csvMoney(-123456)]]).includes('"-1234.56"'));
  });
}

test('Hebrew receivables rows, grand totals and actual document-detail amounts remain isolated and right-aligned', () => {
  setup('accounting');
  useLedgerStore.setState({ customers: [makeCustomer({ name: 'לקוח Customer' })], invoices: [makeInvoice({ number: 'חשבונית-12', amountCents: 123456, currency: 'ILS', dueDate: '2024-01-31' })] });
  const view = render(<div dir="rtl"><PartyAgingReportView side="customer" /></div>);
  const row = view.getByRole('row', { name: /לקוח Customer/ });
  const amount = Array.from(row.querySelectorAll('td.text-right bdi')).find(cell => cell.textContent === formatCurrency(123456))!;
  isolated(amount);
  const total = view.getByRole('row', { name: /Grand Total/ });
  for (const money of total.querySelectorAll('bdi')) { isolated(money); assert.ok(money.parentElement?.classList.contains('text-right')); }
  fireEvent.click(within(row).getByRole('button', { name: 'Open לקוח Customer' }));
  const dialog = view.getByRole('dialog');
  assert.ok(within(dialog).getByText('#חשבונית-12'));
  const displays = Array.from(dialog.querySelectorAll('bdi')).filter(cell => cell.textContent === formatCurrency(123456));
  assert.equal(displays.length, 4, 'owed, document total, still owed and all-documents total');
  displays.forEach(isolated);
});
