import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async({page})=>{
 await page.setViewportSize({width:390,height:850});
 await page.addInitScript(()=>{localStorage.setItem('isGuest','true');localStorage.setItem('has_seen_onboarding','true');});
});
test('budget actual is a phone-sized report with keyboard account drill-down and exact impacts',async({page})=>{
 await page.goto('/?report=budget-actual&start=2026-01-01&end=2026-03-31#reports');
 const report=page.getByRole('region',{name:'Budget vs Actual',exact:true});await expect(report).toBeVisible();
 await page.evaluate(async()=>{
  const modulePath='/src/stores/useLedgerStore.ts';const {useLedgerStore}=await import(modulePath);
  const account={id:'rent-test',uid:'guest',workspaceId:'guest-workspace',code:'6000',name:'Rent שכירות',type:'expense',balanceCents:0};
  const existing=useLedgerStore.getState().accounts;const cash=existing.find((a: {type:string;category?:string})=>a.type==='asset' && a.category==='Cash') || {...account,id:'cash-test',code:'1000',name:'Cash',type:'asset'};
  const budget={id:'budget-test',uid:'guest',targetType:'account',targetId:account.id,period:'quarterly',amountCents:90000,startDate:'2026-01-01',createdAt:'2026-01-01'};
  const tx={id:'budget-entry',uid:'guest',workspaceId:'guest-workspace',type:'actual',date:'2026-01-05',description:'Office rent שכירות',status:'completed',totalAmountCents:15000,currency:'USD',lines:[{accountId:account.id,amountCents:15000},{accountId:cash.id,amountCents:-15000}]};
  useLedgerStore.setState({accounts:[...existing.filter((a: {id:string})=>a.id!==account.id),account,...(existing.some((a:{id:string})=>a.id===cash.id)?[]:[cash])],budgets:[budget],transactions:[tx]});
 });
 await expect(report.getByRole('cell',{name:'$900.00',exact:true})).toBeVisible();
 const actual=report.getByRole('button',{name:'Entries for Rent שכירות, Total'});await expect(actual).toHaveText('$150.00');
 const bounds=await actual.boundingBox();expect(bounds!.height).toBeGreaterThanOrEqual(44);
 await actual.press('Enter');const dialog=page.getByRole('dialog',{name:'Rent שכירות'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('cell',{name:'+$150.00',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Close',exact:true}).press('Escape');await expect(dialog).toBeHidden();await expect(actual).toBeFocused();
 await report.getByLabel('Columns',{exact:true}).selectOption('months');await expect(report.getByRole('button',{name:'Entries for Rent שכירות, Jan 2026'})).toHaveText('$150.00');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const axe=await new AxeBuilder({page}).include('#main-content').disableRules(['color-contrast']).analyze();expect(axe.violations.map(v=>v.id)).toEqual([]);
});
test('feedback from the current report keeps its context and restores keyboard focus on cancel',async({page})=>{
 await page.goto('/?report=budget-actual&start=2026-01-01&end=2026-03-31#reports');await expect(page.getByRole('region',{name:'Budget vs Actual',exact:true})).toBeVisible();
 const open=page.getByRole('button',{name:'Send feedback',exact:true});await open.press('Enter');
 const dialog=page.getByRole('dialog',{name:'Send feedback'});await expect(dialog).toContainText('Reports · Budget vs Actual');
 await expect(dialog.getByLabel('What happened?')).toBeFocused();await dialog.getByLabel('What happened?').fill('שלום mixed screen');
 await expect(dialog.getByRole('button',{name:'Send',exact:true})).toBeDisabled();await expect(dialog.getByRole('status')).toContainText('Sign in');
 await dialog.getByLabel('What happened?').press('Escape');await expect(dialog).toBeHidden();await expect(open).toBeFocused();
 await open.press('Enter');await expect(dialog.getByLabel('What happened?')).toHaveValue('שלום mixed screen');
 const axe=await new AxeBuilder({page}).include('[role="dialog"]').disableRules(['color-contrast']).analyze();expect(axe.violations.map(v=>v.id)).toEqual([]);
});
test('Help Send feedback opens the same named dialog',async({page})=>{
 await page.goto('/#help');await expect(page.getByRole('heading',{name:'Help & Operational Guide'})).toBeVisible();
 await page.getByRole('button',{name:'Send feedback',exact:true}).click();await expect(page.getByRole('dialog',{name:'Send feedback'})).toBeVisible();
});
