import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`VAT format guidance preserves the registration draft — ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(theme => {
        localStorage.setItem('isGuest', 'true');
        localStorage.setItem('has_seen_onboarding', 'true');
        localStorage.setItem('ledgerflow-cookie-consent', 'accepted');
        localStorage.setItem('lf_theme', theme);
      }, theme);
      await page.goto('/#settings');
      await expect(page.getByRole('button', { name: 'Tax profiles', exact: true })).toBeVisible();
      // Synthetic owner cache tests screen behavior only, not authenticated persistence.
      await page.evaluate(async () => {
        const resource = performance.getEntriesByType('resource').map(entry => entry.name)
          .find(name => name.includes('/src/stores/useAuthStore.ts'));
        const { useAuthStore } = await import(resource || '/src/stores/useAuthStore.ts');
        useAuthStore.setState({
          isGuest: false, user: { uid: 'vat-format-owner' }, currentWorkspaceId: 'vat-format-books',
          workspaces: [{ id: 'vat-format-books', uid: 'vat-format-owner', name: 'Synthetic books', currency: 'USD',
            taxProfiles: { books: { name: 'ספרים Books', place: { country: 'US' }, registrations: [
              { kind: 'vat', number: 'DE 123 456 789', place: { country: 'DE' } },
            ] } } }],
        });
      });
      await page.getByRole('button', { name: 'Tax profiles', exact: true }).click();
      await page.getByRole('button', { name: 'Edit this profile', exact: true }).click();
      const summary = page.getByText('EU / UK VAT number format', { exact: true });
      const help = summary.locator('..');
      await expect(help).not.toHaveAttribute('open');
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(help).toHaveAttribute('open');
      await expect(help.getByRole('status')).toHaveText('Format matches: DE••••6789. Registration is not verified.');
      await expect(help).not.toContainText('123 456 789');
      const number = page.getByLabel('Registration number', { exact: true });
      const country = page.getByLabel('Registration country', { exact: true });
      await country.fill('FR');
      await expect(help.getByRole('status')).toContainText('prefix does not match');
      await expect(number).toHaveValue('DE 123 456 789');
      await country.fill('IL');
      await expect(help.getByRole('status')).toContainText('supported EU country or the UK');
      await country.fill('DE');
      await number.fill('DE000000000');
      await expect(help.getByRole('status')).toContainText('all-zero placeholder');
      await number.fill('DE 123 456 789');
      await expect(page.getByLabel('Profile name', { exact: true })).toHaveValue('ספרים Books');
      await summary.scrollIntoViewIfNeeded();
      const box = await summary.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await help.screenshot({ path: test.info().outputPath(`vat-number-help-${width}-${theme}.png`) });
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(help).not.toHaveAttribute('open');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Edit this profile', exact: true }).click();
      await expect(number).toHaveValue('DE 123 456 789');
      await expect(help).not.toHaveAttribute('open');
    });
  }
}
