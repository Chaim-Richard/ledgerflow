import { test, expect } from '@playwright/test';

test('US address recognition explicitly updates only draft state and ZIP', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('isGuest', 'true');
    localStorage.setItem('has_seen_onboarding', 'true');
    localStorage.setItem('ledgerflow-cookie-consent', 'accepted');
  });
  await page.goto('/#settings');
  await expect(page.getByRole('button', { name: 'Tax profiles', exact: true })).toBeVisible();
  // Synthetic owner cache exercises the screen only, never authenticated persistence.
  await page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').map(entry => entry.name)
      .find(name => name.includes('/src/stores/useAuthStore.ts'));
    const { useAuthStore } = await import(resource || '/src/stores/useAuthStore.ts');
    useAuthStore.setState({
      isGuest: false, user: { uid: 'format-check-owner' }, currentWorkspaceId: 'format-check-books',
      workspaces: [{ id: 'format-check-books', uid: 'format-check-owner', name: 'Synthetic books', currency: 'USD',
        taxProfiles: { books: { name: 'ספרים Books', place: {country:'US',state:'NY',postalCode:'10001',city:'עיר City',county:'Review county',district:'Review district'} } } }],
    });
  });
  await page.getByRole('button', { name: 'Tax profiles', exact: true }).click();
  await page.getByRole('button', { name: 'Edit this profile', exact: true }).click();
  const summary=page.getByText('Read state and ZIP from a US address',{exact:true});
  await summary.focus();await page.keyboard.press('Enter');
  const input=page.getByLabel('US address to read',{exact:true});
  await input.fill('חנות Store\n15 Summer St\nBoston, MA 02110-1234\nUSA');
  await expect(page.getByText('Recognized:',{exact:false})).toContainText('02110-1234');
  await expect(page.getByLabel('State',{exact:true})).toHaveValue('NY');
  const copy=page.getByRole('button',{name:'Use state and ZIP in draft',exact:true});
  await copy.focus();await page.keyboard.press('Enter');
  for(const [label,value] of [['State','MA'],['Postal code','02110-1234'],['Profile name','ספרים Books'],['City','עיר City'],['County','Review county'],['District','Review district']])
    await expect(page.getByLabel(label,{exact:true})).toHaveValue(value);
  await input.scrollIntoViewIfNeeded();
  await input.locator('..').screenshot({path:test.info().outputPath('us-address-help.png')});
  const box=await copy.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  for(const address of ['Boston, MA','Boston, MA 02110\nNew York, NY 10001','APO AE 09012','San Juan, PR 00901','Toronto, ON M5V2T6\nCanada']){
    await input.fill(address);await expect(copy).toBeDisabled();await expect(page.getByLabel('State',{exact:true})).toHaveValue('MA');
  }
  await page.getByLabel('Country',{exact:true}).fill('IL');await expect(input).toHaveCount(0);
  await page.getByLabel('Country',{exact:true}).fill('US');await expect(input).toHaveValue('');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Edit this profile',exact:true}).click();
  await expect(input).toHaveValue('');await expect(page.getByLabel('State',{exact:true})).toHaveValue('NY');
});
