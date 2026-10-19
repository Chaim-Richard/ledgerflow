import type { FormEvent } from 'react';
import { test, expect } from '@playwright/test';

test('item bundle and unit settings retain mixed text, validate quantities and work in a scrollable dialog',async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({status:200,json:{}}));
 await page.addInitScript(()=>{localStorage.setItem('isGuest','true');localStorage.setItem('has_seen_onboarding','true');localStorage.setItem('ledgerflow-cookie-consent','accepted');});
 await page.goto('/');
 await page.evaluate(async()=>{
  const paths=['/node_modules/.vite/deps/react.js','/node_modules/.vite/deps/react-dom_client.js','/src/components/inventory/InventoryItemDialog.tsx'];
  const [r,d,m]=await Promise.all(paths.map(path=>import(path)));
  const item={id:'kit',name:'ערכה Kit',sku:'KIT',itemType:'stock',quantityAtHand:0,reorderPoint:0,unitPriceCents:1000,unitCostCents:500,measurementUnit:'ארגז pack',unitsPerPackage:12,bundleParts:[]};
  const part={...item,id:'part',name:'חלק Widget',sku:'PART',bundleParts:undefined};
  const trigger=document.createElement('button');trigger.textContent='Edit fixture';document.body.append(trigger);trigger.focus();
  const host=document.createElement('div');host.id='item-probe';document.body.append(host);const root=d.default.createRoot(host);
  root.render(r.default.createElement(m.default,{open:true,editingItem:item,allItems:[item,part],categories:[],canChangeStock:false,onClose:()=>root.unmount(),onAdjust:()=>{},onSubmit:(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();host.dataset.saved=JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()));}}));
 });
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await expect(dialog.getByLabel('Item Name',{exact:true})).toHaveValue('ערכה Kit');
 const choice=dialog.getByLabel('Item to add as a bundle part');await choice.selectOption('part');
 const quantity=dialog.getByLabel('How many of the part one bundle holds');await quantity.fill('1.5');
 await expect(dialog.getByRole('button',{name:'Add part',exact:true})).toBeDisabled();
 await expect(dialog.getByRole('alert')).toContainText('positive whole number');
 await quantity.fill('3');await dialog.getByRole('button',{name:'Add part',exact:true}).click();
 await expect(dialog.getByRole('list',{name:'Bundle parts chosen'})).toContainText('3 × חלק Widget');
 const remove=dialog.getByRole('button',{name:'Remove חלק Widget',exact:true});const bounds=await remove.boundingBox();expect(bounds!.height).toBeGreaterThanOrEqual(44);expect(bounds!.width).toBeGreaterThanOrEqual(44);
 const unit=dialog.getByLabel('UOM (e.g. pack, kg)',{exact:true});await unit.fill('קופסה Box');
 const pack=dialog.getByLabel('Units per Package',{exact:true});await pack.fill('1.5');
 const save=dialog.getByRole('button',{name:'Update Item',exact:true});await save.click();await expect(page.locator('#item-probe')).not.toHaveAttribute('data-saved',/.+/);
 expect(await pack.evaluate(el=>(el as HTMLInputElement).validity.stepMismatch)).toBe(true);
 await pack.fill('24');await save.click();
 const saved=JSON.parse((await page.locator('#item-probe').getAttribute('data-saved'))!);
 expect(JSON.parse(saved.bundleParts)).toEqual([{itemId:'part',quantity:3}]);expect(saved.measurementUnit).toBe('קופסה Box');expect(saved.unitsPerPackage).toBe('24');expect(saved.name).toBe('ערכה Kit');
 await expect(dialog.getByText('Automatic expansion into invoice lines is not available here',{exact:false})).toBeVisible();
 await unit.scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('inventory-item-settings.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit fixture',exact:true})).toBeFocused();
});
