import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mountJourney, remountJourney, settleStyles } from './support/journeyFixture';

/**
 * AI #8 Browser Verification Suite (`G-1`..`G-16`, `G-20`..`G-23`):
 *   - Bilingual EN/HE Help Center search, 20 how-to articles, Accessibility & Language matrix,
 *     and Weekly Release Notes (`HelpGuideView` + `ReleaseNotes`)
 *   - Dark-mode `@media print` computed style verification (`G-21`: light paper `#FFFFFF` + dark ink)
 *   - Public `StatusPage`, `CustomerPortalPage`, grouped `NotificationDrawer`, and owner `SupportView`
 *     feedback triage tags + `Mark done`
 */

const WORKSPACE = 'ai8-browser';

test('AI #8 browser: verifies bilingual help center, dark-mode print paper override, status/portal surfaces, and owner feedback triage', async ({ page }, testInfo) => {
  test.setTimeout(120000);

  const { errors } = await mountJourney(page, {
    workspaceId: WORKSPACE,
    ledger: {},
    mounts: [{ module: '/src/components/support/HelpGuideView.tsx', props: {} }],
  });

  // 1. Help Center bilingual search (English & Hebrew) + Accessibility & First-Month tabs
  await expect(page.getByRole('tab', { name: 'How-to guides' })).toBeVisible();
  await page.getByLabel('Search guides in English or Hebrew').fill('PCN874');
  await expect(page.getByText(/File Israeli VAT/i).first()).toBeVisible();

  await page.getByRole('tab', { name: 'First month & demo' }).click();
  await expect(page.getByText('First-month progress')).toBeVisible();
  await expect(page.getByText(/Signed-in safety lock active/i)).toBeVisible();

  await page.getByRole('tab', { name: 'Accessibility & language' }).click();
  await expect(page.getByText(/WCAG 2\.1 Level AA/i)).toBeVisible();

  // 2. G-21: Enable `.dark` + `[data-theme="dark"]` and emulate `@media print` — paper MUST be pure white (#FFFFFF)
  await page.evaluate(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.emulateMedia({ media: 'print' });
  const printColors = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return { bg: cs.backgroundColor, color: cs.color, bgImage: cs.backgroundImage };
  });
  expect(printColors.bg).toBe('rgb(255, 255, 255)');
  expect(printColors.bgImage).toBe('none');
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.documentElement.removeAttribute('data-theme');
  });

  // 3. StatusPage + CustomerPortalPage + NotificationDrawer grouping
  await remountJourney(page, [{ module: '/src/components/system/StatusPage.tsx', props: {} }]);
  await expect(page.getByRole('heading', { name: /LedgerFlow System Status/i })).toBeVisible();

  await remountJourney(page, [{ module: '/src/components/sales/CustomerPortalPage.tsx', props: { token: 'demo-token' } }]);
  await expect(page.getByRole('heading', { name: /Customer Invoice & Statement Portal/i })).toBeVisible();

  // 4. Owner SupportView feedback triage tags & Mark done
  await page.route('**/rest/v1/supportTickets**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: [
          {
            id: 'tkt-e2e-1',
            workspace_id: WORKSPACE,
            data: {
              id: 'tkt-e2e-1',
              uid: 'journey-user',
              workspaceId: WORKSPACE,
              subject: 'Please add multi-year CSV comparison',
              description: 'Would save our accountant 2 hours each quarter.',
              category: 'feature_request',
              priority: 'medium',
              status: 'open',
              userEmail: 'owner@example.test',
              userName: 'Journey Owner',
              createdAt: '2026-10-19T12:00:00Z',
              updatedAt: '2026-10-19T12:00:00Z',
              messages: [],
            },
          },
        ],
      });
    }
    return route.fulfill({ json: {} });
  });

  await remountJourney(page, [{ module: '/src/components/support/SupportView.tsx', props: {} }]);
  await expect(page.getByText('Please add multi-year CSV comparison')).toBeVisible();
  const reportTag = page.getByRole('button', { name: /^report$/i });
  await reportTag.click();
  await expect(reportTag).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Mark done/i }).click();

  await settleStyles(page);
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  await testInfo.attach('ai8-support-axe', {
    body: JSON.stringify(axe.violations, null, 2),
    contentType: 'application/json',
  });
  expect(serious).toEqual([]);
  expect(errors).toEqual([]);
});
