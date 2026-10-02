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
});
