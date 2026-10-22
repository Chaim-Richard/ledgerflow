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

      // D-51: the tested dialogs keep keyboard focus in the real tab order and expose the shared
      // visible focus ring. Exercise both ends, not just the initial autofocus.
      const focusable = dialog.locator([
        'button:not([disabled]):visible',
        'input:not([disabled]):visible',
        'select:not([disabled]):visible',
        'textarea:not([disabled]):visible',
        'a[href]:visible',
        '[tabindex]:not([tabindex="-1"]):visible',
      ].join(', '));
      const focusableCount = await focusable.count();
      expect(focusableCount, `${d.name} needs at least two keyboard stops`).toBeGreaterThanOrEqual(2);
      const first = focusable.first();
      const second = focusable.nth(1);
      const last = focusable.nth(focusableCount - 1);
      await first.focus();
      await page.keyboard.press('Tab');
      await expect(second).toBeFocused();
      const visibleFocus = await second.evaluate(element => ({
        keyboard: element.matches(':focus-visible'),
        outlineWidth: Number.parseFloat(getComputedStyle(element).outlineWidth),
        outlineStyle: getComputedStyle(element).outlineStyle,
        boxShadow: getComputedStyle(element).boxShadow,
        outlineColor: getComputedStyle(element).outlineColor,
      }));
      expect(visibleFocus.keyboard, `${d.name} next tab stop is keyboard-focused`).toBe(true);
      const indicator = await second.evaluate(element => {
        const style = getComputedStyle(element);
        const outline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2
          && style.outlineColor !== 'rgba(0, 0, 0, 0)' && style.outlineColor !== 'transparent';
        const colors = [...style.boxShadow.matchAll(/rgba?\(([^)]+)\)/g)].map(match => match[1].split(',').map(part => Number.parseFloat(part.trim())));
        const shadow = colors.some(parts => parts.slice(0, 3).some(channel => channel > 0) && (parts.length < 4 || parts[3] > 0));
        return outline || shadow;
      });
      expect(indicator, `${d.name} has a visible keyboard focus indicator (${JSON.stringify(visibleFocus)})`).toBe(true);
      await page.keyboard.press('Shift+Tab');
      await expect(first).toBeFocused();
      await last.focus();
      await page.keyboard.press('Tab');
      await expect(first).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(last).toBeFocused();

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
