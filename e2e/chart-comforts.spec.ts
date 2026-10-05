import { test, expect } from '@playwright/test';
test('financial charts expose keyboard tables, legends and date brush at phone width', async ({ page }) => {
 await page.setViewportSize({width:390,height:850});
 await page.addInitScript(()=>{localStorage.setItem('isGuest','true');localStorage.setItem('has_seen_onboarding','true');});
 await page.goto('/#charts');
 const chart=page.getByRole('region',{name:'Monthly Profitability & Mix',exact:true}); await expect(chart).toBeVisible();
 const table=chart.getByRole('button',{name:'Table',exact:true}); await table.focus(); await table.press('Enter'); await expect(chart.getByRole('table')).toBeVisible();
 const revenue=chart.getByRole('button',{name:'Revenue',exact:true}); await revenue.focus(); await revenue.press('Space'); await expect(chart.getByRole('columnheader',{name:'Revenue'})).toHaveCount(0);
 await revenue.press('Space'); await expect(chart.getByRole('columnheader',{name:'Revenue'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Expenses by category treemap',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Expenses by category sunburst',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
