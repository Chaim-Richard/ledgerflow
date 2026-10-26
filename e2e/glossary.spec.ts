import { test, expect } from '@playwright/test';

/** C-97: the registered glossary screen is reachable and useful in a guest browser. */
test('accounting glossary: bilingual search and recovery from no matches', async ({ page }) => {
  const tab = 'glossary';
  await page.addInitScript(() => {
    localStorage.setItem('isGuest', 'true');
    localStorage.setItem('has_seen_onboarding', 'true');
  });
  await page.goto(`/#${tab}`);
  await expect(page.getByRole('heading', { name: 'Accounting glossary' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('36 of 36 terms shown');

  const search = page.getByLabel('Search English or Hebrew');
  await search.fill('מלאי');
  await expect(page.getByText('Inventory')).toBeVisible();
  await search.fill('not-a-term');
  await expect(page.getByText('No glossary terms match your search')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('status')).toContainText('36 of 36 terms shown');
});
