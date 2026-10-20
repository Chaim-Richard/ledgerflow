import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { captured, mountJourney, remountJourney, setLedgerField, settleStyles } from './support/journeyFixture';

/**
 * G-24 · W1 (RELEASE_GATE): New books to first invoice, in the browser.
 *
 * Exercises all five steps of W1 against real application screens:
 *   1. Company details (`SetupWizard` step 0: business name, home currency, fiscal start month)
 *   2. Choose chart of accounts (`SetupWizard` step 1: template selection -> apply-template)
 *   3. Opening balances (`SetupWizard` step 2: $5,000.00 cash matched against Opening Balance Equity)
 *   4. Create first invoice (`InvoiceModal`: customer, service line, revenue account -> Send Invoice)
 *   5. View customer statement (`StatementView`: $2,500.00 open balance, zero horizontal scroll, axe clean)
 */

const WORKSPACE = 'w1-browser';
const BANK = {
  id: 'acc-1000',
  uid: 'journey-user',
  workspaceId: WORKSPACE,
  code: '1000',
  name: 'Operating Checking',
  type: 'asset' as const,
  category: 'Cash',
};
const EQUITY = {
  id: 'acc-3900',
  uid: 'journey-user',
  workspaceId: WORKSPACE,
  code: '3900',
  name: 'Opening Balance Equity',
  type: 'equity' as const,
  category: 'Equity',
};
const REVENUE = {
  id: 'acc-4000',
  uid: 'journey-user',
  workspaceId: WORKSPACE,
  code: '4000',
  name: 'Advisory Revenue',
  type: 'revenue' as const,
  category: 'Revenue',
};
const CUSTOMER = {
  id: 'cust-first',
  uid: 'journey-user',
  workspaceId: WORKSPACE,
  name: 'Northstar Studio LLC',
  email: 'billing@northstar.example.test',
};

test('W1 browser: sets up company, chart, and opening balances, sends the first invoice, and verifies the customer statement', async ({ page }, testInfo) => {
  test.setTimeout(120000);

  const { errors, requests } = await mountJourney(page, {
    workspaceId: WORKSPACE,
    ledger: {
      accounts: [BANK, EQUITY, REVENUE],
      customers: [CUSTOMER],
      invoices: [],
      payments: [],
      bills: [],
      vendors: [],
    },
    mounts: [
      {
        module: '/src/components/onboarding/SetupWizard.tsx',
        props: { onStarted: '__capture:started', onDone: '__capture:done' },
      },
    ],
    api: (req) => {
      if (req.url.endsWith(`/api/v1/workspaces/${WORKSPACE}/apply-template`) && req.method === 'POST') {
        return { status: 200, json: { applied: true } };
      }
      if (req.url.endsWith(`/api/v1/workspaces/${WORKSPACE}/opening-balances`) && req.method === 'POST') {
        return { status: 200, json: { debitsCents: 500000, equityCents: 500000 } };
      }
      if (req.url.endsWith(`/api/v1/workspaces/${WORKSPACE}/next-number`) && req.method === 'POST') {
        return { status: 200, json: { number: '1001' } };
      }
      return null;
    },
  });

  // 1. Company details (SetupWizard step 0)
  await expect(page.getByRole('heading', { name: 'Set up your books' })).toBeVisible();
  await page.locator('#setup-name').fill('Rimon & Co Advisory');
  await page.locator('#setup-fiscal').selectOption('1');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // 2. Choose chart of accounts (SetupWizard step 1)
  await expect(page.getByRole('heading', { name: 'Chart of accounts' })).toBeVisible();
  await page.locator('#tpl-consulting').check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => requests.some((r) => r.url.endsWith('/apply-template'))).toBe(true);

  // 3. Record opening balances (SetupWizard step 2 -> step 3)
  await expect(page.getByRole('heading', { name: 'Opening balances' })).toBeVisible();
  await page.locator('#setup-start').fill('2026-09-01');
  await page.locator(`#ob-${BANK.id}`).fill('5000.00');
  await expect(page.getByText(/Debits \$5,000\.00 = credits \$5,000\.00\./)).toBeVisible();
  await page.getByRole('button', { name: 'Record opening balances', exact: true }).click();

  await expect.poll(() => requests.some((r) => r.url.endsWith('/opening-balances'))).toBe(true);
  expect(requests.find((r) => r.url.endsWith('/opening-balances'))?.body).toMatchObject({
    date: '2026-09-01',
    balances: [{ accountId: BANK.id, amountCents: 500000 }],
  });

  await expect(page.getByRole('heading', { name: 'Your books are set up' })).toBeVisible();
  await page.getByRole('button', { name: 'Create the first invoice', exact: true }).click();
  await expect.poll(async () => (await captured(page, 'done')).length).toBe(1);

  // 4. Create and send the first invoice (InvoiceModal)
  await remountJourney(page, [
    {
      module: '/src/components/sales/InvoiceModal.tsx',
      props: {
        isOpen: true,
        customers: [CUSTOMER],
        accounts: [REVENUE],
        onSave: '__capture:savedInvoice',
      },
    },
  ]);

  await expect(page.getByRole('heading', { name: 'New invoice', exact: true })).toBeVisible();
  await page.locator('#inv-customer').fill(CUSTOMER.name);
  await page.locator('#inv-number').fill('1001');
  await page.locator('#inv-date').fill('2026-09-10');
  await page.locator('#inv-due-date').fill('2026-10-10');
  await page.locator('#inv-item-desc-0').fill('September financial setup & monthly retainer');
  await page.locator('#inv-item-qty-0').fill('1');
  await page.locator('#inv-item-rate-0').fill('2500.00');
  await page.locator('#inv-item-acc-0').fill(REVENUE.name);
  await page.getByRole('button', { name: 'Send Invoice', exact: true }).click();

  await expect.poll(async () => (await captured(page, 'savedInvoice')).length).toBe(1);
  const savedArgs = (await captured(page, 'savedInvoice'))[0]?.[0] as Record<string, unknown>;
  expect(savedArgs).toMatchObject({
    number: '1001',
    customerId: CUSTOMER.id,
    customerName: CUSTOMER.name,
    date: '2026-09-10',
    dueDate: '2026-10-10',
    status: 'sent',
    amountCents: 250000,
  });

  // 5. View the customer statement and check worked balance, layout, and accessibility
  await remountJourney(page, [
    {
      module: '/src/components/reporting/StatementView.tsx',
      props: { startDate: '2026-09-01', endDate: '2026-09-30' },
    },
  ]);
  await setLedgerField(page, 'invoices', [
    {
      id: 'inv-1001',
      uid: 'journey-user',
      workspaceId: WORKSPACE,
      number: '1001',
      customerId: CUSTOMER.id,
      customerName: CUSTOMER.name,
      status: 'sent',
      date: '2026-09-10',
      dueDate: '2026-10-10',
      amountCents: 250000,
      amountPaidCents: 0,
      currency: 'USD',
      items: savedArgs.items as unknown[],
    },
  ]);

  await expect(page.getByRole('table', { name: 'Account statement' })).toBeVisible();
  const rows = await page.getByRole('table', { name: 'Account statement' }).locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').trim())),
  );
  expect(rows).toEqual([
    ['2026-09-01', 'Opening Balance Brought Forward', '$0.00'],
    ['2026-09-10', 'Invoice', '#1001', '$2,500.00', '-', '$2,500.00'],
  ]);

  const ending = page.getByText('Ending Outstanding Balance', { exact: true }).locator('xpath=following-sibling::div[1]');
  await expect(ending).toHaveText(/2,500\.00$/);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await settleStyles(page);
  const axe = await new AxeBuilder({ page }).include('table[aria-label], table').analyze();
  const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  await testInfo.attach('w1-statement-axe', {
    body: JSON.stringify(axe.violations, null, 2),
    contentType: 'application/json',
  });
  expect(serious).toEqual([]);
  expect(errors).toEqual([]);
});
