import { test, expect } from '@playwright/test';

/**
 * Keyboard basics (E-22, E-29): the first Tab reaches "Skip to content", which moves focus to the
 * screen without changing it, and focused controls show a ring.
 */
test.describe('Keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
    });
    // (a URL hash would make the browser start Tab navigation at the element with that id)
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeAttached();
  });

  test('skip to content moves focus to the screen and keeps the screen', async ({ page }) => {
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    expect(['', '#dashboard']).toContain(new URL(page.url()).hash);
  });

  test('a focused button shows a visible ring', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? getComputedStyle(el).outlineStyle : 'none';
    });
    expect(outline).not.toBe('none');
  });

  test('an invoice can be opened, filled in and saved with the keyboard only (E-23)', async ({ page }) => {
    const press = async (name: string) => {
      const target = page.getByRole('button', { name, exact: true }).first();
      await target.focus();
      await page.keyboard.press('Enter');
    };
    await press('Money In');
    await press('Invoices & AP');
    await page.getByRole('button', { name: /Add Invoice/ }).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'New invoice' })).toBeVisible();

    // every field and the save button are reachable with Tab, in order
    await page.getByLabel('Customer', { exact: true }).focus();
    await page.keyboard.type('Keyboard Customer');
    const reached = new Set<string>();
    for (let i = 0; i < 60 && !reached.has('Save Draft'); i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return '';
        const id = el.getAttribute('id');
        const byFor = id ? document.querySelector(`label[for="${id}"]`)?.textContent : '';
        return (byFor || el.getAttribute('aria-label') || el.textContent || '').trim();
      });
      reached.add(label);
      if (label === 'Item / Description') await page.keyboard.type('Consulting');
      if (/^Rate/.test(label)) await page.keyboard.type('120');
    }
    for (const field of ['Invoice Number', 'Invoice Date', 'Due Date', 'Tax', 'Item / Description', 'Qty', 'Save Draft']) {
      expect([...reached].some(r => r === field || r.startsWith(field)), `${field} reachable by Tab`).toBe(true);
    }
    await expect(page.getByLabel('Invoice totals')).toContainText('120.00');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'New invoice' })).toBeHidden({ timeout: 8000 });
  });

  test('a budget target can be opened, filled in and saved with the keyboard only (A-226)', async ({ page }) => {
    await page.goto('/#budgets');
    await expect(page.getByRole('heading', { name: 'Budget Protocol' })).toBeVisible();

    const openBtn = page.getByRole('button', { name: 'Define Target', exact: true });
    await openBtn.focus();
    await expect(openBtn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Define Objective' })).toBeVisible();

    await page.getByLabel('Rule Mapping (Account)', { exact: true }).focus();
    await page.keyboard.type('Cloud Hosting');
    const reached = new Set<string>();
    for (let i = 0; i < 20 && !reached.has('Confirm Allocation'); i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return '';
        const id = el.getAttribute('id');
        const byFor = id ? document.querySelector(`label[for="${id}"]`)?.textContent : '';
        return (byFor || el.getAttribute('aria-label') || el.textContent || '').trim();
      });
      reached.add(label);
      if (label === 'Target Magnitude ($)') {
        await page.keyboard.press('Backspace');
        await page.keyboard.type('2500');
      }
    }
    for (const field of ['Target Magnitude ($)', 'Velocity Period', 'Abort', 'Confirm Allocation']) {
      expect([...reached].some(r => r === field || r.startsWith(field)), `${field} reachable by Tab`).toBe(true);
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Define Objective' })).toBeHidden({ timeout: 8000 });
    await expect(page.locator('#main-content')).toContainText('$2,500.00');
    await expect(page.getByRole('button', { name: /Edit Name of budget Cloud Hosting/ })).toBeVisible();
  });

  test('a project can be opened, filled in and saved with the keyboard only (A-226)', async ({ page }) => {
    await page.goto('/#projects');
    await expect(page.getByRole('heading', { name: 'Project & Initiative Tracking' })).toBeVisible();

    const openBtn = page.getByRole('button', { name: 'Initialize Project', exact: true });
    await openBtn.focus();
    await expect(openBtn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Initialize Project' })).toBeVisible();

    await page.getByLabel('Protocol Name', { exact: true }).focus();
    await page.keyboard.type('Keyboard Initiative');
    const reached = new Set<string>();
    for (let i = 0; i < 20 && !reached.has('INITIALIZE PROTOCOL'); i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return '';
        const id = el.getAttribute('id');
        const byFor = id ? document.querySelector(`label[for="${id}"]`)?.textContent : '';
        return (byFor || el.getAttribute('aria-label') || el.textContent || '').trim();
      });
      reached.add(label);
      if (label === 'Strategic Description') {
        await page.keyboard.type('Keyboard-only project flow');
      }
    }
    for (const field of ['General', 'Publication', 'Event', 'Campaign', 'Strategic Description', 'Cancel', 'INITIALIZE PROTOCOL']) {
      expect([...reached].some(r => r === field || r.startsWith(field)), `${field} reachable by Tab`).toBe(true);
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 8000 });
    await expect(page.locator('#main-content')).toContainText('Keyboard Initiative');
  });

  test('customer → invoice → payment → P&L journey with keyboard only and visible focus (A-226 / H-3)', async ({ page }) => {
    await page.route('**/api/v1/payments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'pay-kbd-h3' }),
      });
    });

    const pressButton = async (name: string | RegExp) => {
      const target = page.getByRole('button', { name }).first();
      await target.focus();
      await expect(target).toBeFocused();
      const outline = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el ? getComputedStyle(el).outlineStyle : 'none';
      });
      expect(outline).not.toBe('none');
      await page.keyboard.press('Enter');
    };

    // 1. Navigate to Sales → Customers & Clients and create a customer via keyboard
    await pressButton('Money In');
    await pressButton('Invoices & AP');
    await pressButton('Customers & Clients');
    const newCustomerInput = page.getByLabel('New customer name');
    await newCustomerInput.focus();
    await expect(newCustomerInput).toBeFocused();
    await page.keyboard.type('H3 Keyboard Customer');
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toContainText('H3 Keyboard Customer');

    // 2. Switch to Invoices & AP and create an invoice for that customer via keyboard
    await pressButton('Invoices & AP');
    await pressButton(/Add Invoice/);
    await expect(page.getByRole('heading', { name: 'New invoice' })).toBeVisible();
    await page.getByLabel('Customer', { exact: true }).focus();
    await page.keyboard.type('H3 Keyboard Customer');
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return '';
        const id = el.getAttribute('id');
        const byFor = id ? document.querySelector(`label[for="${id}"]`)?.textContent : '';
        return (byFor || el.getAttribute('aria-label') || el.textContent || '').trim();
      });
      if (label === 'Item / Description') await page.keyboard.type('Advisory Retainer');
      if (/^Rate/.test(label)) await page.keyboard.type('250');
      if (label === 'Save Draft') break;
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'New invoice' })).toBeHidden({ timeout: 8000 });

    // 3. Record payment on the invoice via keyboard
    const receiveBtn = page.getByRole('button', { name: 'Receive Payment' }).first();
    await receiveBtn.focus();
    await expect(receiveBtn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Receive Customer Payment' })).toBeVisible();
    const recordBtn = page.getByRole('button', { name: 'Record & Post Payment' });
    await recordBtn.focus();
    await expect(recordBtn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Receive Customer Payment' })).toBeHidden({ timeout: 8000 });

    // 4. Open Profit & Loss without a mouse
    await page.goto('/#pnl');
    await expect(page.getByRole('heading', { name: /Profit & Loss/i }).first()).toBeVisible();
  });
});

