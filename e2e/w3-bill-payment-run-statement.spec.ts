import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { mountJourney, remountJourney, setLedgerField, settleStyles } from './support/journeyFixture';

/**
 * F-42 · W3 (RELEASE_GATE): bill → posting → payment run → vendor statement, in the browser.
 *
 * Worked figures (USD, September 2026; all money in cents):
 *   bill 9001 Supplier Ltd, dated 2026-09-08, due 2026-09-20 …  60,000 (600.00)
 *   bill 9002 Supplier Ltd, dated 2026-09-10, due 2026-09-25 …  25,000 (250.00)
 *   bill 9003 Cleaning Co,  dated 2026-09-11, due 2026-09-22 …  10,000 (100.00)  no bank details
 *
 * Payment run "bills due by 2026-09-30", paid on 2026-09-28 from Bank 1000:
 *   one payment per vendor: Supplier Ltd 85,000 (9001 + 9002), Cleaning Co 10,000 (9003)
 *   → "2 payments to 2 vendors for 3 bills: $950.00"; Cleaning Co is flagged for missing bank details.
 *   Bank file: Supplier line 850.00 with its IBAN and routing code; Cleaning Co line 100.00, no account.
 *
 * Vendor statement for Supplier Ltd, 2026-09-01 … 2026-09-30:
 *   opening 0.00 · bill 9001 600.00 (running 600.00) · bill 9002 250.00 (running 850.00)
 *   payment 850.00 (running 0.00) · ending outstanding 0.00
 *
 * Bills are seeded as already posted (the bill form and the journal are covered elsewhere). The server
 * replies are stubbed and the store update that the live subscription would deliver is applied by the test.
 */

/** Splits CSV text into records, honouring quoted fields with commas and doubled quotes. */
function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { record.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field); field = '';
      if (record.some(c => c !== '')) records.push(record);
      record = [];
    } else field += ch;
  }
  record.push(field);
  if (record.some(c => c !== '')) records.push(record);
  return records;
}

const WORKSPACE = 'w3-browser';
const SUPPLIER = {
  id: 'vendor-supplier', uid: 'journey-user', workspaceId: WORKSPACE, name: 'Supplier Ltd', email: 'ap@supplier.example.test',
  bankDetails: { accountName: 'Supplier Ltd Operating', accountNumber: 'GB82 WEST 1234 5698 7654 32', routingCode: 'WESTGB2L' },
};
const CLEANING = { id: 'vendor-cleaning', uid: 'journey-user', workspaceId: WORKSPACE, name: 'Cleaning Co' };
const BANK = { id: 'bank-1000', uid: 'journey-user', workspaceId: WORKSPACE, code: '1000', name: 'Bank 1000', type: 'asset', category: 'Cash' };

function bill(id: string, number: string, vendor: { id: string; name: string }, date: string, dueDate: string, amountCents: number, status = 'pending', amountPaidCents = 0) {
  return { id, uid: 'journey-user', workspaceId: WORKSPACE, number, vendorId: vendor.id, vendorName: vendor.name, status, date, dueDate, amountCents, amountPaidCents, currency: 'USD', lines: [] };
}

const BILLS = [
  bill('bill-9001', '9001', SUPPLIER, '2026-09-08', '2026-09-20', 60000),
  bill('bill-9002', '9002', SUPPLIER, '2026-09-10', '2026-09-25', 25000),
  bill('bill-9003', '9003', CLEANING, '2026-09-11', '2026-09-22', 10000),
];

test('W3 browser: bills are paid in one run per vendor, the bank file is right, and the vendor statement clears', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });

  const paidBy = new Map<string, string>();
  const { errors, requests } = await mountJourney(page, {
    workspaceId: WORKSPACE,
    ledger: { accounts: [BANK], vendors: [SUPPLIER, CLEANING], bills: BILLS, payments: [], customers: [], invoices: [] },
    mounts: [{ module: '/src/components/purchases/PaymentRunDialog.tsx', props: { bills: BILLS, vendors: [SUPPLIER, CLEANING] } }],
    api: request => {
      if (!request.url.endsWith('/api/v1/payments') || request.method !== 'POST') return null;
      const body = request.body as { vendorId: string; amountCents: number };
      const id = `pay-${body.vendorId}`;
      paidBy.set(body.vendorId, id);
      return { status: 201, json: { id, status: 'posted' } };
    },
  });

  // 1. The run lists the three bills due by the chosen date, the totals, and the missing bank details.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Payment run', exact: true })).toBeVisible();
  await dialog.getByLabel('Bills due by').fill('2026-09-30');
  await dialog.getByLabel('Pay on').fill('2026-09-28');
  await expect(dialog.getByText('3 bills due by 2026-09-30')).toBeVisible();
  await expect(dialog.getByText('2 payments to 2 vendors for 3 bills: $950.00', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('No bank details for Cleaning Co');

  // 2. Pay and download the bank file. The two server payments carry the exact amounts and allocations.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Pay and download bank file', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('payment-run-2026-09-28.csv');

  await expect.poll(() => requests.filter(r => r.url.endsWith('/api/v1/payments')).length).toBe(2);
  const posted = requests.filter(r => r.url.endsWith('/api/v1/payments')).map(r => r.body as Record<string, unknown>);
  expect(posted[0]).toMatchObject({
    workspaceId: WORKSPACE, paymentDate: '2026-09-28', amountCents: 85000, paymentMethod: 'bank_transfer',
    vendorId: SUPPLIER.id, entityName: 'Supplier Ltd', cashAccountId: BANK.id,
    allocations: [
      { documentId: 'bill-9001', documentType: 'bill', amountCents: 60000 },
      { documentId: 'bill-9002', documentType: 'bill', amountCents: 25000 },
    ],
  });
  expect(posted[1]).toMatchObject({
    amountCents: 10000, vendorId: CLEANING.id, entityName: 'Cleaning Co',
    allocations: [{ documentId: 'bill-9003', documentType: 'bill', amountCents: 10000 }],
  });

  // The bank file: one line per vendor payment; Supplier's line has its account and routing; Cleaning Co has none.
  const csv = readFileSync(await download.path(), 'utf8').replace(/^\uFEFF/, '');
  const records = parseCsv(csv);
  expect(records[0]).toEqual(['Payee', 'Account name', 'Account number / IBAN', 'Routing / sort code / BIC', 'Amount', 'Currency', 'Payment date', 'Reference']);
  expect(records).toHaveLength(3);
  expect(records[1].slice(0, 7)).toEqual(['Supplier Ltd', 'Supplier Ltd Operating', 'GB82WEST12345698765432', 'WESTGB2L', '850.00', 'USD', '2026-09-28']);
  expect(records[1][7]).toContain('9001');
  expect(records[1][7]).toContain('9002');
  expect(records[2].slice(0, 7)).toEqual(['Cleaning Co', 'Cleaning Co', '', '', '100.00', 'USD', '2026-09-28']);
  expect(records[2][7]).toContain('9003');

  // 3. Once recorded, the bills leave the run: nothing is left to pay twice.
  await expect(dialog.getByText('0 payments to 0 vendors for 0 bills: $0.00', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Pay and download bank file', exact: true })).toBeDisabled();

  // 4. The live store receives the two payments and the paid bills; then the vendor statement is read.
  const payments = [
    { id: 'pay-vendor-supplier', uid: 'journey-user', workspaceId: WORKSPACE, direction: 'made', status: 'posted', contactId: SUPPLIER.id, date: '2026-09-28', amountCents: 85000, reference: 'PR-0928-01', paymentMethod: 'bank_transfer', currency: 'USD' },
    { id: 'pay-vendor-cleaning', uid: 'journey-user', workspaceId: WORKSPACE, direction: 'made', status: 'posted', contactId: CLEANING.id, date: '2026-09-28', amountCents: 10000, reference: 'PR-0928-02', paymentMethod: 'bank_transfer', currency: 'USD' },
  ];
  await setLedgerField(page, 'payments', payments);
  await setLedgerField(page, 'bills', [
    bill('bill-9001', '9001', SUPPLIER, '2026-09-08', '2026-09-20', 60000, 'paid', 60000),
    bill('bill-9002', '9002', SUPPLIER, '2026-09-10', '2026-09-25', 25000, 'paid', 25000),
    bill('bill-9003', '9003', CLEANING, '2026-09-11', '2026-09-22', 10000, 'paid', 10000),
  ]);
  await remountJourney(page, [{ module: '/src/components/reporting/StatementView.tsx', props: { startDate: '2026-09-01', endDate: '2026-09-30' } }]);

  await page.getByRole('button', { name: 'Vendor Statement', exact: true }).click();
  await expect(page.getByRole('combobox').filter({ has: page.locator('option[value="vendor-supplier"]') })).toHaveValue(SUPPLIER.id);

  const table = page.getByRole('table', { name: 'Account statement' });
  await expect(table).toBeVisible();
  const rows = await table.locator('tbody tr').evaluateAll(trs =>
    trs.map(tr => Array.from(tr.querySelectorAll('td')).map(cell => (cell.textContent ?? '').trim())),
  );
  expect(rows).toEqual([
    ['2026-09-01', 'Opening Balance Brought Forward', '$0.00'],
    ['2026-09-08', 'Bill', '#9001', '$600.00', '-', '$600.00'],
    ['2026-09-10', 'Bill', '#9002', '$250.00', '-', '$850.00'],
    ['2026-09-28', 'Payment', '#PR-0928-01', '-', '$850.00', '$0.00'],
  ]);
  await expect(page.getByText('Ending Outstanding Balance', { exact: true }).locator('xpath=following-sibling::div[1]')).toHaveText(/^\$0\.00$/);

  // The statement passes serious/critical axe checks in the light theme.
  await settleStyles(page);
  const axe = await new AxeBuilder({ page }).include('table[aria-label], table').analyze();
  const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  await testInfo.attach('w3-vendor-statement-axe', { body: JSON.stringify(axe.violations, null, 2), contentType: 'application/json' });
  expect(serious, JSON.stringify(serious.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([]);

  expect(errors).toEqual([]);
});
