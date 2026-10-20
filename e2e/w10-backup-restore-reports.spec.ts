import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { mountJourney, remountJourney, setLedgerField, settleStyles } from './support/journeyFixture';

/**
 * F-46 · W10 (RELEASE_GATE): Backup, restore, and reports match, in the browser.
 *
 * Worked figures (USD, October 2026):
 *   - Original books:
 *       1) 2026-10-02 Owner investment: Debit Cash (1000) $10,000.00 / Credit Capital (3000) $10,000.00
 *       2) 2026-10-08 Retainer revenue: Debit Cash (1000)  $4,200.00 / Credit Revenue (4000)  $4,200.00
 *       3) 2026-10-12 Office rent:      Debit Rent (5000)  $1,200.00 / Credit Cash (1000)     $1,200.00
 *     -> Net Profit: $3,000.00 | Cash: $13,000.00 | Capital: $10,000.00 | Trial Balance: $14,200.00 = $14,200.00
 *   - Export verified SHA-256 JSON backup from `BackupExportSettings` ("Export JSON Backup")
 *   - Mutate live books with an erroneous $2,750.00 expense so reports diverge ($250.00 net profit)
 *   - Upload the downloaded backup file into `Restore backup file`, verify `/restore` restores the
 *     exact pre-backup ledger, and prove P&L, Balance Sheet, and Trial Balance match pre-backup figures.
 */

const WORKSPACE = 'w10-browser';

const ACCOUNTS = [
  { id: 'acc-1000', uid: 'journey-user', workspaceId: WORKSPACE, code: '1000', name: 'Operating Cash', type: 'asset', category: 'Cash' },
  { id: 'acc-3000', uid: 'journey-user', workspaceId: WORKSPACE, code: '3000', name: 'Owner Capital', type: 'equity', category: 'Equity' },
  { id: 'acc-4000', uid: 'journey-user', workspaceId: WORKSPACE, code: '4000', name: 'Consulting Revenue', type: 'revenue', category: 'Revenue' },
  { id: 'acc-5000', uid: 'journey-user', workspaceId: WORKSPACE, code: '5000', name: 'Office Rent', type: 'expense', category: 'Operating Expenses' },
];

const ORIGINAL_TRANSACTIONS = [
  {
    id: 'tx-cap',
    uid: 'journey-user',
    workspaceId: WORKSPACE,
    date: '2026-10-02',
    description: 'Initial owner capital',
    type: 'deposit',
    status: 'completed',
    amountCents: 1000000,
    lines: [
      { accountId: 'acc-1000', accountName: 'Operating Cash', debitCents: 1000000, creditCents: 0 },
      { accountId: 'acc-3000', accountName: 'Owner Capital', debitCents: 0, creditCents: 1000000 },
    ],
  },
  {
    id: 'tx-rev',
    uid: 'journey-user',
    workspaceId: WORKSPACE,
    date: '2026-10-08',
    description: 'October advisory retainer',
    type: 'deposit',
    status: 'completed',
    amountCents: 420000,
    lines: [
      { accountId: 'acc-1000', accountName: 'Operating Cash', debitCents: 420000, creditCents: 0 },
      { accountId: 'acc-4000', accountName: 'Consulting Revenue', debitCents: 0, creditCents: 420000 },
    ],
  },
  {
    id: 'tx-rent',
    uid: 'journey-user',
    workspaceId: WORKSPACE,
    date: '2026-10-12',
    description: 'October studio rent',
    type: 'expense',
    status: 'completed',
    amountCents: 120000,
    lines: [
      { accountId: 'acc-5000', accountName: 'Office Rent', debitCents: 120000, creditCents: 0 },
      { accountId: 'acc-1000', accountName: 'Operating Cash', debitCents: 0, creditCents: 120000 },
    ],
  },
];

const ERRONEOUS_TRANSACTION = {
  id: 'tx-corrupt',
  uid: 'journey-user',
  workspaceId: WORKSPACE,
  date: '2026-10-15',
  description: 'Accidental duplicate rent posting',
  type: 'expense',
  status: 'completed',
  amountCents: 275000,
  lines: [
    { accountId: 'acc-5000', accountName: 'Office Rent', debitCents: 275000, creditCents: 0 },
    { accountId: 'acc-1000', accountName: 'Operating Cash', debitCents: 0, creditCents: 275000 },
  ],
};

test('W10 browser: exports SHA-256 JSON backup, mutates books, restores archive, and matches P&L, Balance Sheet, and Trial Balance', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });

  let restoredTransactions: unknown[] | null = null;

  const { errors, requests } = await mountJourney(page, {
    workspaceId: WORKSPACE,
    ledger: {
      accounts: ACCOUNTS,
      transactions: ORIGINAL_TRANSACTIONS,
      customers: [],
      vendors: [],
      invoices: [],
      bills: [],
      payments: [],
    },
    mounts: [{ module: '/src/components/reporting/Reports.tsx', props: {} }],
    api: (req) => {
      if (req.url.includes(`/api/v1/workspaces/${WORKSPACE}/export`)) {
        // Return 503 so BackupExportSettings executes its real browser WebCrypto SHA-256 archive generator
        return { status: 503, json: { error: 'offline-archive-mode' } };
      }
      if (req.url.endsWith(`/api/v1/workspaces/${WORKSPACE}/restore`) && req.method === 'POST') {
        const body = req.body as { transactions: unknown[] };
        restoredTransactions = body.transactions;
        return { status: 200, json: { restored: true, message: 'Workspace general ledger successfully restored from backup snapshot.' } };
      }
      if (req.url.includes('/api/v1/reports/')) {
        // Force Reports views to compute client-side directly from the live store ledger
        return { status: 503, json: { error: 'local-ledger-computation' } };
      }
      return null;
    },
  });

  // 1. Capture pre-backup P&L, Balance Sheet, and Trial Balance figures
  await expect(page.getByText('$4,200.00').first()).toBeVisible();
  await expect(page.getByText('$3,000.00').first()).toBeVisible();

  await page.getByRole('button', { name: 'Balance Sheet' }).click();
  await expect(page.getByText('$13,000.00').first()).toBeVisible();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();

  await page.getByRole('button', { name: 'Trial Balance' }).click();
  await expect(page.getByText('$14,200.00').first()).toBeVisible();

  // 2. Mount BackupExportSettings and export verified SHA-256 JSON archive
  await remountJourney(page, [{ module: '/src/components/platform/settings/BackupExportSettings.tsx', props: {} }]);
  await expect(page.getByRole('heading', { name: 'Backup & Export' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON Backup' }).click();
  const download = await downloadPromise;
  const archivePath = await download.path();
  expect(archivePath).toBeTruthy();
  const archiveJson = await readFile(archivePath!, 'utf8');
  const parsedArchive = JSON.parse(archiveJson);
  expect(parsedArchive.schemaVersion).toBe(1);
  expect(parsedArchive.metadata.checksum).toMatch(/^[a-f0-9]{64}$/);
  expect(parsedArchive.transactions).toHaveLength(3);

  // 3. Corrupt / mutate live ledger and confirm reports now diverge from pre-backup state
  await setLedgerField(page, 'transactions', [...ORIGINAL_TRANSACTIONS, ERRONEOUS_TRANSACTION]);
  await remountJourney(page, [{ module: '/src/components/reporting/Reports.tsx', props: {} }]);
  await page.getByRole('button', { name: 'Profit & Loss' }).click();
  await expect(page.getByText('$250.00').first()).toBeVisible();

  // 4. Restore from downloaded archive via BackupExportSettings file input (verifies SHA-256 checksum)
  await remountJourney(page, [{ module: '/src/components/platform/settings/BackupExportSettings.tsx', props: {} }]);
  await page.getByLabel('Restore backup file').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/json',
    buffer: Buffer.from(archiveJson, 'utf8'),
  });

  await expect.poll(() => requests.some((r) => r.url.endsWith(`/api/v1/workspaces/${WORKSPACE}/restore`))).toBe(true);
  expect(restoredTransactions).toHaveLength(3);
  await setLedgerField(page, 'transactions', restoredTransactions);

  // 5. Re-mount Reports and prove P&L, Balance Sheet, and Trial Balance match pre-backup figures identically
  await remountJourney(page, [{ module: '/src/components/reporting/Reports.tsx', props: {} }]);
  await page.getByRole('button', { name: 'Profit & Loss' }).click();
  await expect(page.getByText('$4,200.00').first()).toBeVisible();
  await expect(page.getByText('$3,000.00').first()).toBeVisible();

  await page.getByRole('button', { name: 'Balance Sheet' }).click();
  await expect(page.getByText('$13,000.00').first()).toBeVisible();
  await expect(page.getByText('$10,000.00').first()).toBeVisible();

  await page.getByRole('button', { name: 'Trial Balance' }).click();
  await expect(page.getByText('$14,200.00').first()).toBeVisible();

  await settleStyles(page);
  const axe = await new AxeBuilder({ page }).include('table').analyze();
  const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  await testInfo.attach('w10-trial-balance-axe', {
    body: JSON.stringify(axe.violations, null, 2),
    contentType: 'application/json',
  });
  expect(serious).toEqual([]);
  expect(errors).toEqual([]);
});
