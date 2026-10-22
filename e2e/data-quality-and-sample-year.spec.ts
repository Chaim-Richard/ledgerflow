import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mountJourney, settleStyles } from './support/journeyFixture';
import { buildSampleBusinessYear } from '../src/lib/sampleBusinessYear';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const;

test.describe('Data Quality Checks & 12-Month Sample Year Benchmark', () => {
  test('full app navigation mounts Data Quality Checks and 12-Month Sample Year & Speed cleanly', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
    });

    await page.goto('/');
    const guestButton = page.locator('button', { hasText: 'Continue as Guest' });
    if (await guestButton.isVisible({ timeout: 2500 }).catch(() => false)) {
      await guestButton.click();
    }
    await page.waitForSelector('text="Overview"', { timeout: 15000 });

    await page.locator('button:has-text("Reports")').first().click();

    const dqTab = page.locator('button:has-text("Data Quality Checks")').first();
    await expect(dqTab).toBeVisible({ timeout: 10000 });
    await dqTab.click();
    await expect(page.getByRole('heading', { name: 'Data quality checks' })).toBeVisible();
    await settleStyles(page);
    const axeDq = await new AxeBuilder({ page }).analyze();
    expect(axeDq.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);

    const benchTab = page.locator('button:has-text("12-Month Sample Year & Speed")').first();
    await expect(benchTab).toBeVisible({ timeout: 10000 });
    await benchTab.click();
    await expect(page.getByRole('heading', { name: /12-month sample business & report speed/i })).toBeVisible();
    await expect(page.getByText(/All 12 months verified/)).toBeVisible();
    await page.getByLabel('Volume scale').selectOption('2');
    await expect(page.getByText(/All 12 months verified/)).toBeVisible();
    await settleStyles(page);
    const axeBench = await new AxeBuilder({ page }).analyze();
    expect(axeBench.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });

  for (const vp of VIEWPORTS) {
    test(`seeded 12-month sample business surfaces A-194/196/197 findings in Data Quality, Data Health & Speed (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const sample = buildSampleBusinessYear({ year: 2026, scale: 1 });
      const reqAccountId = sample.workspace.dimensions?.[0]?.requiredOn?.accountIds?.[0] || sample.accounts[0].id;
      const cashAccountId = sample.accounts.find(a => a.type === 'asset')?.id || sample.accounts[1].id;
      const unlabelledEntry = {
        ...sample.transactions[0],
        id: 'tx-unlabelled-check',
        date: '2026-06-15',
        description: 'Unlabelled warehouse utility expense',
        lines: [
          { accountId: reqAccountId, accountName: 'Operating Expense', debitCents: 18_500, creditCents: 0 },
          { accountId: cashAccountId, accountName: 'Operating Checking', debitCents: 0, creditCents: 18_500 },
        ],
      };

      const journey = await mountJourney(page, {
        workspaceId: sample.workspace.id,
        ledger: {
          accounts: sample.accounts,
          transactions: [...sample.transactions, unlabelledEntry],
          customers: sample.customers,
          vendors: sample.vendors,
          invoices: sample.invoices,
          bills: sample.bills,
          payments: sample.payments,
          inventory: sample.inventory,
          bankLines: sample.bankLines,
          reconciliations: sample.reconciliations,
          recurring: [],
        },
        mounts: [
          { module: '/src/components/reporting/DataQualityReportView.tsx' },
          { module: '/src/components/reporting/SampleYearBenchmarkReportView.tsx' },
          { module: '/src/components/system/DataHealthView.tsx' },
        ],
      });

      await page.evaluate(async ({ dimensions, taxProfiles, dimensionNodes }) => {
        const [{ useAuthStore }, { useLedgerStore }] = await Promise.all([
          import('/src/stores/useAuthStore.ts'),
          import('/src/stores/useLedgerStore.ts'),
        ]);
        const current = useAuthStore.getState();
        useAuthStore.setState({
          workspaces: current.workspaces.map(ws => ({ ...ws, dimensions, taxProfiles })),
        } as never);
        useLedgerStore.setState({ dimensionNodes } as never);
      }, {
        dimensions: sample.workspace.dimensions,
        taxProfiles: sample.workspace.taxProfiles,
        dimensionNodes: sample.dimensionNodes,
      });

      expect(journey.errors).toEqual([]);

      const dqSection = page.getByRole('region', { name: 'Data quality checks' });
      await expect(dqSection.getByRole('heading', { name: 'Data quality checks' })).toBeVisible();
      await expect(dqSection.getByText('Unlabelled warehouse utility expense')).toBeVisible();
      await expect(dqSection.getByText(/••••0119/).first()).toBeVisible();

      await dqSection.getByLabel('Check group').selectOption('items');
      await expect(dqSection.getByRole('heading', { name: 'Items missing unit cost or selling price (3)' })).toBeVisible();
      await dqSection.getByLabel('Check group').selectOption('all');

      const benchSection = page.getByRole('region', { name: 'Sample business year and report speed' });
      await expect(benchSection.getByText(/All 12 months verified/)).toBeVisible();

      await settleStyles(page);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
    });
  }
});
