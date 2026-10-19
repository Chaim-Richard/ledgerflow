import { test, expect } from '@playwright/test';
test('phone bookmarks use native keyboard controls, remember order and restore an exact report despite an old permalink', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }));
  await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); });
  // Load the ordinary entry once so a fresh Vite cache has React's client module.
  await page.goto('/');
  await page.waitForFunction(() => Boolean(document.querySelector('#root')?.childElementCount));
  await page.route('**/bookmarks-fixture*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body><div id="fixture" style="width:240px;padding:12px"></div></body></html>' }));
  async function mount() {
    await page.evaluate(async () => {
      const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window);
      Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true });
      const paths = ['/node_modules/.vite/deps/react.js', '/node_modules/.vite/deps/react-dom_client.js', '/src/components/layout/BookmarksGroup.tsx', '/src/stores/useAuthStore.ts', '/src/stores/useUIStore.ts'];
      const [{ default: React }, { default: { createRoot } }, { default: Group }, { useAuthStore }, { useUIStore }] = await Promise.all(paths.map(path => import(path)));
      useAuthStore.setState({ user: { uid: 'משתמש-1' }, currentWorkspaceId: 'ספרים-1', isAdmin: false });
      useUIStore.setState({ activeTab: 'reports', activeReportTab: 'pnl', isProMode: true, isSidebarOpen: true });
      createRoot(document.getElementById('fixture')).render(React.createElement(Group, { expanded: true }));
      Object.assign(window, { bookmarkUi: useUIStore });
    });
  }
  await page.goto('/bookmarks-fixture?report=ar-aging'); await mount();
  const group = page.getByRole('region', { name: 'Bookmarks' });
  const star = group.getByRole('button', { name: /^Bookmark this page: Reports/ }); await star.focus(); await star.press('Space');
  await expect(group.getByRole('button', { name: /^Bookmarked: Reports/ })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.bookmarkUi.setState({ activeTab: 'settings', activeSettingsTab: 'security' }));
  await group.getByRole('button', { name: /^Bookmark this page: Preferences/ }).click();
  const up = group.getByRole('button', { name: /^Move Preferences.* up$/ }); await up.focus(); await up.press('Enter');
  const openSecurity = group.getByRole('button', { name: /^Open bookmark Preferences/ }); await expect(openSecurity).toBeFocused();
  await expect(group.getByRole('listitem').first()).toContainText('Security');
  expect((await group.getByRole('button', { name: /^Move Preferences.* down$/ }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.reload(); await mount(); await expect(group.getByRole('listitem').first()).toContainText('Security');
  const openReport = group.getByRole('button', { name: /^Open bookmark Reports/ }); await openReport.focus(); await openReport.press('Enter');
  await expect(page).toHaveURL(/report=pnl.*#reports/);
  expect(await page.evaluate(() => window.bookmarkUi.getState().activeReportTab)).toBe('pnl');
  expect(await page.evaluate(() => window.bookmarkUi.getState().isSidebarOpen)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
