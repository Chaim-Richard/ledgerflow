import { test, expect } from '@playwright/test';

test('tax registration typing help retains the draft and checks only the chosen format', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('isGuest', 'true');
    localStorage.setItem('has_seen_onboarding', 'true');
    localStorage.setItem('ledgerflow-cookie-consent', 'accepted');
  });
  await page.goto('/#settings');
  await expect(page.getByRole('button', { name: 'Tax profiles', exact: true })).toBeVisible();
  // Synthetic owner cache exercises the screen only, never authenticated persistence.
  await page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').map(entry => entry.name)
      .find(name => name.includes('/src/stores/useAuthStore.ts'));
    const { useAuthStore } = await import(resource || '/src/stores/useAuthStore.ts');
    useAuthStore.setState({
      isGuest: false, user: { uid: 'format-check-owner' }, currentWorkspaceId: 'format-check-books',
      workspaces: [{ id: 'format-check-books', uid: 'format-check-owner', name: 'Synthetic books', currency: 'USD',
        taxProfiles: { books: { name: 'ספרים Books', registrations: [
          { kind: 'income_tax', number: '123456782', place: { country: 'IL' } },
        ] } } }],
    });
  });
  await page.getByRole('button', { name: 'Tax profiles', exact: true }).click();
  await page.getByRole('button', { name: 'Edit this profile', exact: true }).click();
  const format = page.getByRole('combobox', { name: 'Check number as', exact: true });
  const number = page.getByLabel('Registration number', { exact: true });
  await expect(format).toHaveValue('');
  await format.selectOption('identity');
  await expect(page.getByText('Format matches:', { exact: false })).toContainText('•••••6782');
  await number.fill('123456783');
  await expect(page.getByText('The check digit does not match.', { exact: false })).toBeVisible();
  await format.selectOption('ein');
  await number.fill('12-3456789');
  await expect(page.getByText('Format matches:', { exact: false })).toContainText('**-***6789');
  await expect(page.getByLabel('Profile name', { exact: true })).toHaveValue('ספרים Books');
  await expect(number).toHaveValue('12-3456789');
  await format.selectOption('ssn');
  await expect(page.getByText('Enter nine digits in the selected EIN or SSN layout.')).toBeVisible();
  await expect(number).toHaveValue('12-3456789');
  await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeEnabled();
  await format.scrollIntoViewIfNeeded();
  const bounds = await format.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await format.locator('..').locator('..').screenshot({ path: test.info().outputPath('tax-id-help.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit this profile', exact: true }).click();
  await expect(format).toHaveValue('');
  await expect(number).toHaveValue('123456782');
});
