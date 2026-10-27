import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { pdfText, pdfPageCount } from '../src/tests/helpers/pdfText';

test('report pack: phone focus, period/current aging, Hebrew PDF, page numbers and no app chrome', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.route('**/pack-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body><div id="fixture" data-print-root><p>APP CHROME MUST NOT PRINT</p></div></body></html>' }));
  const calls: string[] = [];
  await page.route('**/api/v1/reports/**', route => {
    calls.push(route.request().url());
    const url = route.request().url();
    const account = { name: 'מכירות Sales', balance: -12345 };
    const payload = url.includes('profit-and-loss') ? { income: { total: -12345, accounts: { revenue: account } }, cogs: { total: 0, accounts: {} }, expense: { total: 0, accounts: {} }, grossProfit: -12345, netIncome: -12345 }
      : url.includes('balance-sheet') ? { assets: { bank: 12345 }, liabilities: {}, equity: {}, totalAssets: 12345, totalLiabilities: 0, totalEquity: 0, netIncome: 12345, totalClaims: 12345, isBalanced: true }
      : { current: 12345, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 12345 };
    return route.fulfill({ json: payload });
  });
  await page.goto('/pack-fixture');
  await page.evaluate(async () => {
    const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window);
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true });
    const paths = ['/node_modules/.vite/deps/react.js', '/node_modules/.vite/deps/react-dom_client.js', '/src/components/reporting/reportPack/ReportPackDialog.tsx', '/src/stores/useAuthStore.ts', '/src/stores/useLedgerStore.ts'];
    const [{ default: React }, { default: { createRoot } }, { default: Pack }, { useAuthStore }, { useLedgerStore }] = await Promise.all(paths.map(path => import(path)));
    useAuthStore.setState({ user: { uid: 'pack-user', getIdToken: async () => 'fixture-token' }, currentWorkspaceId: 'pack-workspace', workspaces: [{ id: 'pack-workspace', uid: 'pack-user', name: 'ספרים Ledger', currency: 'ILS', moneyDisplay: { locale: 'he-IL', negativeStyle: 'accounting' }, roles: { 'pack-user': 'owner' } }] });
    useLedgerStore.setState({ accounts: [{ id: 'bank', name: 'בנק Bank' }] });
    const root = createRoot(document.getElementById('fixture'));
    function App() { const [open, setOpen] = React.useState(false); return React.createElement(React.Fragment, null, React.createElement('p', null, 'APPCHROMEMUSTNOTPRINT'), React.createElement('button', { onClick: () => setOpen(true) }, 'Open pack'), open && React.createElement(Pack, { startDate: '2024-01-01', endDate: '2024-01-31', onClose: () => setOpen(false) })); }
    root.render(React.createElement(App));
  });
  const opener = page.getByRole('button', { name: 'Open pack' }); await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Report pack' });
  await expect(dialog.getByRole('checkbox', { name: 'Profit and loss' })).toBeFocused();
  const prepare = dialog.getByRole('button', { name: 'Prepare pack' });
  expect((await prepare.boundingBox())!.height).toBeGreaterThanOrEqual(44); await prepare.click();
  const print = dialog.getByRole('button', { name: 'Print pack / PDF' }); await expect(print).toBeEnabled();
  await expect(dialog.getByRole('heading', { name: /Receivables aging as of \d{4}-\d{2}-\d{2}/ })).toBeVisible();
  await expect(dialog.getByText(/It is not a historical balance at 2024-01-31/)).toBeVisible();
  expect(calls).toHaveLength(3);
  expect(calls.find(url => url.includes('profit-and-loss'))).toContain('startDate=2024-01-01');
  expect(calls.find(url => url.includes('/aging'))).not.toContain('2024');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
  const pdfPath = testInfo.outputPath('report-pack.pdf'); await writeFile(pdfPath, pdf);
  const extracted = pdfText(pdf);
  await testInfo.attach('report-pack-extracted-text', { body: extracted, contentType: 'text/plain' });
  const text = extracted.replace(/\s/g, '');
  expect(pdfPageCount(pdf)).toBe(4);
  expect(text).not.toContain('APPCHROMEMUSTNOTPRINT'); expect(text).not.toContain('Preparepack');
  expect(text).toContain('2024-01-31'); expect(text).toContain('123.45'); expect(text).toMatch(/[\u0590-\u05ff]/);
  // Hebrew drawing order may be visual or logical; dates and amounts must stay LTR.
  expect(text).toMatch(/ספרים|םירפס/); expect(text).toMatch(/מכירות|תוריכמ/); expect(text).toMatch(/בנק|קנב/);
  expect(text).toContain('Page1of4'); expect(text).toContain('Page4of4');
  await page.emulateMedia({ media: 'screen' }); await dialog.press('Escape'); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
});

test('report pack: budget vs actual and stock on hand are pickable, ask for their own period and print it', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/api/v1/reports/**', route => {
    const url = route.request().url();
    calls.push(url);
    const account = { name: 'מכירות Sales', balance: -12345 };
    const payload = url.includes('profit-and-loss') ? { income: { total: -12345, accounts: { revenue: account } }, cogs: { total: 0, accounts: {} }, expense: { total: 0, accounts: {} }, grossProfit: -12345, netIncome: -12345 }
      : url.includes('balance-sheet') ? { assets: { bank: 12345 }, liabilities: {}, equity: {}, totalAssets: 12345, totalLiabilities: 0, totalEquity: 0, netIncome: 12345, totalClaims: 12345, isBalanced: true }
      : url.includes('budget-vs-actual') ? [{ accountName: 'Rent', budget: 500000, actual: 450000, variance: 50000, percent: 90 }]
      : url.includes('stock-aging') ? { asOf: '2024-01-31', items: [{ itemName: 'Widget', quantity: 12, valueCents: 4800, unknownAge: 0 }] }
      : { current: 12345, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 12345 };
    return route.fulfill({ json: payload });
  });
  await page.route('**/pack-two-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body><div id="fixture"></div></body></html>' }));
  await page.goto('/pack-two-fixture');
  await page.evaluate(async () => {
    const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window);
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true });
    const paths = ['/node_modules/.vite/deps/react.js', '/node_modules/.vite/deps/react-dom_client.js', '/src/components/reporting/reportPack/ReportPackDialog.tsx', '/src/stores/useAuthStore.ts', '/src/stores/useLedgerStore.ts'];
    const [{ default: React }, { default: { createRoot } }, { default: Pack }, { useAuthStore }, { useLedgerStore }] = await Promise.all(paths.map(path => import(path)));
    useAuthStore.setState({ user: { uid: 'pack-user', getIdToken: async () => 'fixture-token' }, currentWorkspaceId: 'pack-workspace', workspaces: [{ id: 'pack-workspace', uid: 'pack-user', name: 'ספרים Ledger', currency: 'ILS', roles: { 'pack-user': 'owner' } }] });
    useLedgerStore.setState({ accounts: [{ id: 'bank', name: 'בנק Bank' }] });
    createRoot(document.getElementById('fixture')).render(React.createElement(Pack, { startDate: '2024-01-01', endDate: '2024-01-31', onClose: () => {} }));
  });
  const dialog = page.getByRole('dialog', { name: 'Report pack' });
  const budget = dialog.getByRole('checkbox', { name: 'Budget vs actual' });
  const stock = dialog.getByRole('checkbox', { name: 'Stock on hand by age' });
  await budget.focus(); await page.keyboard.press('Space'); await stock.focus(); await page.keyboard.press('Space');
  expect(await budget.isChecked()).toBe(true); expect(await stock.isChecked()).toBe(true);
  await dialog.getByRole('button', { name: 'Prepare pack' }).click();
  await expect(dialog.getByRole('heading', { name: 'Budget vs actual' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Stock on hand by age at 2024-01-31' })).toBeVisible();
  await expect(dialog.getByText(/Budget vs actual covers one month only: 2024-01/)).toBeVisible();
  await expect(dialog.getByText('Rent · Budget')).toBeVisible();
  await expect(dialog.getByText('Widget · 12 units')).toBeVisible();
  const budgetCall = calls.find(url => url.includes('budget-vs-actual'));
  expect(budgetCall).toContain('month=2024-01');
  expect(budgetCall).not.toContain('startDate');
  expect(calls.find(url => url.includes('stock-aging'))).toContain('asOf=2024-01-31');
  expect(calls).toHaveLength(5);
});
