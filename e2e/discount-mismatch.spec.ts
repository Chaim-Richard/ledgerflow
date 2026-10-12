import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('DiscountMismatchView: registered discount-mismatch review preserves dates and provides accessible phone controls', async ({page})=>{
  await page.setViewportSize({width:390,height:850});
  await page.route('**/api/**',route=>route.fulfill({status:404,json:{}}));
  await page.addInitScript(()=>{localStorage.setItem('isGuest','true');localStorage.setItem('has_seen_onboarding','true');});
  await page.goto('/?report=discount-mismatch&start=2024-02-01&end=2024-02-29#reports');
  const report=page.getByRole('region',{name:'Discount mismatch review',exact:true});
  await expect(report).toBeVisible();await expect(report.getByRole('table')).toBeVisible();
  await expect(report).toContainText('2024-02-01 through 2024-02-29');
  await expect(report).toContainText('not proof of the discount agreed on the invoice date');
  await expect(report.getByRole('button',{name:'Export CSV',exact:true})).toBeDisabled();
  expect((await report.getByRole('button',{name:'Refresh complete history'}).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const scroll=report.getByRole('button',{name:'Scroll table right'});await scroll.focus();await scroll.press('Enter');
  await expect(scroll).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const violations=(await new AxeBuilder({page}).include('[aria-label="Discount mismatch review"]').analyze()).violations;
  expect(violations).toEqual([]);
});
