import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Money dialogs with a keyboard and a screen reader (E-08…E-20): each opens as a dialog named by
 * its title, focus is inside, axe finds nothing (contrast has its own test), Escape closes it.
 */
async function open(page: Page, group: string, screen: string) {
  const g = page.getByRole('button', { name: group, exact: true }).first();
  if (await g.isVisible()) await g.click();
  await page.getByRole('button', { name: screen, exact: true }).first().click();
}

const dialogs: Array<{ name: string; title: RegExp; show: (p: Page) => Promise<void> }> = [
  { name: 'invoice', title: /New invoice/, show: async p => { await open(p, 'Money In', 'Invoices & AP'); await p.getByRole('button', { name: /Add Invoice/ }).first().click(); } },
  { name: 'customer', title: /Add Customer/, show: async p => { await open(p, 'Money In', 'Invoices & AP'); await p.getByRole('button', { name: /Customers/ }).first().click(); await p.getByRole('button', { name: /Add Customer/ }).first().click(); } },
  { name: 'bill', title: /Record New Bill/, show: async p => { await open(p, 'Money Out', 'Purchases'); await p.getByRole('button', { name: /Record Bill/ }).first().click(); } },
  { name: 'vendor', title: /Add Vendor/, show: async p => { await open(p, 'Money Out', 'Purchases'); await p.getByRole('button', { name: /Vendors/ }).first().click(); await p.getByRole('button', { name: /Add Vendor|New Vendor/ }).first().click(); } },
  { name: 'credit note', title: /Credit Note/, show: async p => { await open(p, 'Transactions', 'Credit Notes & Vendor Credits'); await p.getByRole('button', { name: /New Credit Note/ }).first().click(); } },
];

test.describe('Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
    });
    await page.goto('/');
    await page.waitForSelector('text="Overview"', { timeout: 15000 });
  });

  test('command palette: Ctrl+K opens it with the cursor in the search box', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const search = page.getByRole('textbox', { name: 'Search commands or enter a transaction' });
    await expect(search).toBeVisible();
    await expect(search).toBeFocused();
    await page.keyboard.type('rep');
    await expect(search).toHaveValue('rep');
  });

  for (const d of dialogs) {
    test(`${d.name}: a named dialog, focus inside, no accessibility problems, Escape closes`, async ({ page }) => {
      await d.show(page);
      const dialog = page.getByRole('dialog', { name: d.title });
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(600); // entrance animation
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
      const results = await new AxeBuilder({ page }).include('[role="dialog"]').disableRules(['color-contrast']).analyze();
      expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  }

  test('estimate form: no accessibility problems (E-16)', async ({ page }) => {
    await open(page, 'Money In', 'Estimates & Quotes');
    await page.getByRole('button', { name: /New Estimate/ }).first().click();
    const form = page.locator('form', { hasText: 'Create New Quote / Estimate' });
    await expect(form).toBeVisible();
    const results = await new AxeBuilder({ page }).include('form').disableRules(['color-contrast']).analyze();
    expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
});
