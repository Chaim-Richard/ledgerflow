import { test, expect, type Page } from '@playwright/test';

/**
 * The transaction list on a normal desktop screen: rows are drawn (the list was 0 px high), the
 * header fits on one line (the layout was one column short), the footer's balance check is right,
 * and a column switched off in the Columns menu stays off after a reload (I-13).
 */
async function openAllTransactions(page: Page) {
  await page.locator('[data-testid="nav-transactions"]').first().click();
  await page.locator('[data-testid="filtered-totals-bar"]').waitFor({ timeout: 15000 });
  // the default view (cash accounts) is empty in the demo books: switch it off, clear filters
  const view = page.locator('button[aria-pressed="true"]').first();
  if (await view.isVisible()) await view.click({ force: true });
  const clear = page.getByRole('button', { name: 'Clear All' });
  if (await clear.isVisible()) await clear.click({ force: true });
}

test.describe('Transaction list', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
    });
    await page.goto('/');
    await page.waitForSelector('text="Overview"', { timeout: 15000 });
    const cookies = page.getByRole('button', { name: 'Essential Only' });
    if (await cookies.isVisible()) await cookies.click();
  });

  test('rows are drawn, the header is one line, balanced books say so', async ({ page }) => {
    await openAllTransactions(page);
    await expect(page.locator('[data-testid="tx-amount"]')).toHaveCount(2);
    expect((await page.getByTestId('tx-header').boundingBox())!.height).toBeLessThan(70);
    await expect(page.getByText('Consensus Balanced')).toBeVisible();
  });

  test('the search is in the address and a shared link opens it (I-17)', async ({ page }) => {
    await page.goto('/?search=Acme#transactions');
    await page.locator('[data-testid="filtered-totals-bar"]').waitFor({ timeout: 15000 });
    await expect(page.getByRole('textbox', { name: /^(Search within view|Deep search ledger)/ })).toHaveValue('Acme');
    await page.getByRole('textbox', { name: /^(Search within view|Deep search ledger)/ }).fill('AWS');
    await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('AWS');
  });

  test('a column switched off stays off after a reload', async ({ page }) => {
    await openAllTransactions(page);
    await expect(page.getByRole('button', { name: 'Filter by project' })).toBeAttached();
    await page.getByRole('button', { name: /^Columns$/ }).click();
    await page.getByLabel('Project', { exact: true }).uncheck();
    await expect(page.getByRole('button', { name: 'Filter by project' })).toHaveCount(0);
    await page.reload();
    await page.locator('[data-testid="nav-transactions"]').first().waitFor({ timeout: 15000 });
    await openAllTransactions(page);
    await expect(page.getByRole('button', { name: 'Filter by project' })).toHaveCount(0);
    await expect(page.locator('[data-testid="tx-amount"]')).toHaveCount(2);
  });
});
