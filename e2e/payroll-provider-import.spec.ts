import { test, expect } from '@playwright/test';

/**
 * PAY-1: the payroll provider import dialog (PayrollImportDialog), mounted on a bare fixture page like the other
 * dialog specs. A five-facility Gusto file is previewed as one entry of 16,522.50 for 2026-05-15, the request
 * carries the file and the chosen accounts, and a refusal from the server (the same file twice) is shown.
 */
const CSV = [
  'Pay Date,Employee,Employee ID,Department,Gross Earnings,Employee Taxes,Employee Deductions,Net Pay,Employer Taxes,Employer Contributions',
  '05/15/2026,Ana Ruiz,E1,Maple House,"4,000.00",800.00,200.00,"3,000.00",306.00,120.00',
  '05/15/2026,Ben Cole,E2,Oak Court,"3,000.00",600.00,150.00,"2,250.00",229.50,90.00',
  '05/15/2026,Cy Diaz,E3,Pine Lodge,"2,500.00",500.00,0.00,"2,000.00",191.25,0.00',
  '05/15/2026,Dee Park,E4,Cedar Hall,"3,500.00",700.00,175.00,"2,625.00",267.75,105.00',
  '05/15/2026,Eli Moss,E5,Birch Home,"2,000.00",400.00,100.00,"1,500.00",153.00,60.00',
].join('\n');

test('a provider\'s payroll file is previewed as one balanced entry per pay date and sent with the chosen accounts', async ({ page }) => {
  const posts: Array<Record<string, unknown>> = [];
  let refuse = false;
  await page.route('**/api/v1/workspaces/*/payroll-imports', async route => {
    posts.push(JSON.parse(route.request().postData() || '{}'));
    if (refuse) await route.fulfill({ status: 409, json: { status: 'error', message: 'The payroll of 2026-05-15 from this file ($15,000.00 gross, 5 people) is already in the books. Nothing from this file was posted.', problems: [] } });
    else await route.fulfill({ status: 200, json: { status: 'success', entries: [{ transactionId: 'payroll-import-x', payDate: '2026-05-15' }] } });
  });
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, json: [] }));
  await page.route('**/payroll-import-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payroll import</title><link rel="stylesheet" href="/src/index.css"></head><body><div id="root"></div></body></html>' }));
  await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); localStorage.setItem('ledgerflow-cookie-consent', 'accepted'); });
  // visiting the app first warms Vite's dependency cache, which the fixture's module imports need
  await page.goto('/');
  await page.waitForFunction(() => Boolean(document.querySelector('#root')?.childElementCount));
  await page.goto('/payroll-import-fixture');
  await page.evaluate(async () => {
    const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window);
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true });
    await import('/src/index.css');
    const paths = ['/node_modules/.vite/deps/react.js', '/node_modules/.vite/deps/react-dom_client.js', '/src/components/hr/PayrollImportDialog.tsx'];
    const [r, d, m] = await Promise.all(paths.map(path => import(path)));
    const account = (id: string, code: string, name: string, type: string, category?: string) => ({ id, code, name, type, ...(category ? { category } : {}) });
    const accounts = [
      account('bank', '1000', 'Checking', 'asset', 'Bank'), account('clear', '2100', 'Payroll clearing', 'liability'),
      account('wh', '2110', 'Withholdings payable', 'liability'), account('ded', '2120', 'Deductions payable', 'liability'),
      account('ertaxdue', '2130', 'Payroll taxes payable', 'liability'), account('erbendue', '2140', 'Benefits payable', 'liability'),
      account('wages', '6000', 'Wages', 'expense'), account('ertax', '6010', 'Payroll taxes', 'expense'), account('erben', '6020', 'Employee benefits', 'expense'),
    ];
    const host = document.createElement('div'); document.body.append(host);
    const root = d.default.createRoot(host);
    root.render(r.default.createElement(m.default, { workspaceId: 'ws-five', accounts, dimensions: [{ id: 'property', name: 'Facility' }], currency: 'USD', onClose: () => { host.dataset.closed = 'yes'; } }));
  });
  const dialog = page.getByRole('dialog', { name: 'Import payroll from a provider' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file').setInputFiles({ name: 'gusto-may.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
  await expect(dialog.getByText('Choose the account for "Wages expense".')).toBeVisible();
  const choose = async (field: string, value: string) => dialog.getByLabel(field, { exact: true }).selectOption(value);
  await choose('Wages expense', 'wages');
  await choose('Employer tax expense', 'ertax');
  await choose('Employer benefits expense', 'erben');
  await choose('Withholdings owed', 'wh');
  await choose('Employee deductions owed', 'ded');
  await choose('Employer taxes owed', 'ertaxdue');
  await choose('Employer benefits owed', 'erbendue');
  // the bank account is not offered as the clearing account
  await expect(dialog.getByLabel('Payroll clearing (net pay)', { exact: true }).locator('option', { hasText: 'Checking' })).toHaveCount(0);
  await choose('Payroll clearing (net pay)', 'clear');
  await dialog.getByLabel('Split costs by label (optional)').selectOption('property');

  const preview = dialog.getByTestId('payroll-import-preview');
  await expect(preview).toHaveCount(1);
  await expect(preview).toContainText('Pay date 2026-05-15 · 5 people');
  await expect(preview).toContainText('Cost $16,522.50');
  await expect(preview.getByRole('row', { name: /Wages \$15,000\.00/ })).toBeVisible();
  await expect(preview.getByRole('row', { name: /Payroll clearing \$11,375\.00/ })).toBeVisible();

  // the server refuses the same file twice: the reason is shown and the dialog stays open
  refuse = true;
  await dialog.getByRole('button', { name: 'Record 1 entry' }).click();
  await expect(dialog.getByTestId('payroll-import-refused')).toContainText('is already in the books. Nothing from this file was posted.');
  await expect(page.locator('div[data-closed="yes"]')).toHaveCount(0);
  refuse = false;
  posts.length = 0;
  await dialog.getByRole('button', { name: 'Record 1 entry' }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatchObject({ provider: 'gusto', fileName: 'gusto-may.csv', labelDimensionId: 'property', accounts: { wages: 'wages', clearing: 'clear', withholdings: 'wh' } });
  expect(String(posts[0].csv)).toContain('Maple House');
  await expect(page.locator('div[data-closed="yes"]')).toHaveCount(1);
});

test('a file with a column outside the provider\'s set is stopped before anything is sent', async ({ page }) => {
  let sent = 0;
  await page.route('**/api/v1/workspaces/*/payroll-imports', async route => { sent++; await route.fulfill({ status: 200, json: {} }); });
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, json: [] }));
  await page.route('**/payroll-import-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Payroll import</title></head><body><div id="root"></div></body></html>' }));
  await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); localStorage.setItem('ledgerflow-cookie-consent', 'accepted'); });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(document.querySelector('#root')?.childElementCount));
  await page.goto('/payroll-import-fixture');
  await page.evaluate(async () => {
    const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window);
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true });
    const [r, d, m] = await Promise.all(['/node_modules/.vite/deps/react.js', '/node_modules/.vite/deps/react-dom_client.js', '/src/components/hr/PayrollImportDialog.tsx'].map(path => import(path)));
    const host = document.createElement('div'); document.body.append(host);
    d.default.createRoot(host).render(r.default.createElement(m.default, { workspaceId: 'ws-five', accounts: [], dimensions: [], currency: 'USD', onClose: () => {} }));
  });
  const dialog = page.getByRole('dialog', { name: 'Import payroll from a provider' });
  await dialog.getByLabel('CSV file').setInputFiles({ name: 'bonus.csv', mimeType: 'text/csv', buffer: Buffer.from(`${CSV.split('\n')[0]},Bonus\n${CSV.split('\n')[1]},50.00`) });
  await expect(dialog.getByRole('alert')).toContainText('"Bonus"');
  await expect(dialog.getByRole('button', { name: /Record/ })).toBeDisabled();
  expect(sent).toBe(0);
});
