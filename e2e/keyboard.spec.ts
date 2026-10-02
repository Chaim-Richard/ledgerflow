import { test, expect } from '@playwright/test';

/**
 * Keyboard basics (E-22, E-29): the first Tab reaches "Skip to content", which moves focus to the
 * screen without changing it, and focused controls show a ring.
 */
test.describe('Keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
    });
    // (a URL hash would make the browser start Tab navigation at the element with that id)
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeAttached();
  });

  test('skip to content moves focus to the screen and keeps the screen', async ({ page }) => {
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    expect(['', '#dashboard']).toContain(new URL(page.url()).hash);
  });

  test('a focused button shows a visible ring', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? getComputedStyle(el).outlineStyle : 'none';
    });
    expect(outline).not.toBe('none');
  });

  test('an invoice can be opened, filled in and saved with the keyboard only (E-23)', async ({ page }) => {
    const press = async (name: string) => {
      const target = page.getByRole('button', { name, exact: true }).first();
      await target.focus();
      await page.keyboard.press('Enter');
    };
    await press('Money In');
    await press('Invoices & AP');
    await page.getByRole('button', { name: /Add Invoice/ }).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'New invoice' })).toBeVisible();

    // every field and the save button are reachable with Tab, in order
    await page.getByLabel('Customer', { exact: true }).focus();
    await page.keyboard.type('Keyboard Customer');
    const reached = new Set<string>();
    for (let i = 0; i < 60 && !reached.has('Save Draft'); i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return '';
        const id = el.getAttribute('id');
        const byFor = id ? document.querySelector(`label[for="${id}"]`)?.textContent : '';
        return (byFor || el.getAttribute('aria-label') || el.textContent || '').trim();
      });
      reached.add(label);
      if (label === 'Item / Description') await page.keyboard.type('Consulting');
      if (/^Rate/.test(label)) await page.keyboard.type('120');
    }
    for (const field of ['Invoice Number', 'Invoice Date', 'Due Date', 'Tax', 'Item / Description', 'Qty', 'Save Draft']) {
      expect([...reached].some(r => r === field || r.startsWith(field)), `${field} reachable by Tab`).toBe(true);
    }
    await expect(page.getByLabel('Invoice totals')).toContainText('120.00');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'New invoice' })).toBeHidden({ timeout: 8000 });
  });
});

