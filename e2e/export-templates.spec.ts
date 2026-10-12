import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseCsv } from '../src/lib/csv';
test('phone export template restores columns by keyboard and downloads precisely the visible Hebrew rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }));
  await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(document.querySelector('#root')?.childElementCount));
  await page.route('**/export-template-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body><div id="fixture" style="width:100%;padding:12px"></div></body></html>' }));
  async function mount() {
    await page.evaluate(async () => {
      const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window);
      Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true });
      const paths = ['/node_modules/.vite/deps/react.js','/node_modules/.vite/deps/react-dom_client.js','/src/components/reporting/ReportTableScroll.tsx','/src/stores/useAuthStore.ts'];
      const [{default:React},{default:{createRoot}},{default:Scroll},{useAuthStore}] = await Promise.all(paths.map(path=>import(path)));
      useAuthStore.setState({user:{uid:'משתמש'},currentWorkspaceId:'ספרים'});
      const h=React.createElement;
      createRoot(document.getElementById('fixture')).render(h(Scroll,null,h('table',null,h('caption',null,'Item report'),h('thead',null,h('tr',null,h('th',null,'Item'),h('th',null,'Units'),h('th',null,'Amount'))),h('tbody',null,h('tr',null,h('td',null,'כיסא Chair'),h('td',null,'2'),h('td',null,'123.45'))))));
    });
  }
  await page.goto('/export-template-fixture'); await mount();
  const host=page.locator('#fixture');
  await host.getByRole('button',{name:'Columns',exact:true}).click();
  await host.getByRole('button',{name:'Move Amount earlier'}).click();
  await host.getByRole('checkbox',{name:'Units'}).uncheck();
  await host.getByText('Export templates',{exact:true}).click();
  await host.getByLabel('Template name').fill('דוח Summary');
  const save=host.getByRole('button',{name:'Save these columns as…'}); await save.focus(); await save.press('Enter');
  await host.getByRole('checkbox',{name:'Units'}).check();
  await host.getByRole('button',{name:'Move Amount later'}).click();
  await page.reload(); await mount();
  await host.getByRole('button',{name:'Columns',exact:true}).click();
  await host.getByText('Export templates',{exact:true}).click();
  const use=host.getByRole('button',{name:'Use template דוח Summary'}); await use.focus(); await use.press('Enter');
  await expect(host.locator('thead th')).toHaveText(['Item','Amount','Units']);
  await expect(host.getByRole('checkbox',{name:'Units'})).not.toBeChecked();
  expect((await use.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const downloadPromise=page.waitForEvent('download');
  await host.getByRole('button',{name:'Export displayed rows CSV'}).click();
  const download=await downloadPromise;
  const csv=await readFile((await download.path())!,'utf8');
  expect(parseCsv(csv)).toEqual([['Item','Amount'],['כיסא Chair','123.45']]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
