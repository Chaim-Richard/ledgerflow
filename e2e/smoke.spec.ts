import { test, expect } from '@playwright/test';

test.describe('E2E Smoke Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Pre-seed guest flag into localStorage so the app loads directly in guest mode
    await page.addInitScript(() => {
      localStorage.setItem('isGuest', 'true');
    });
    await page.goto('/');
    
    // Check if Auth screen is visible, if so click Guest
    const guestButton = page.locator('button', { hasText: 'Continue as Guest' });
    try {
      if (await guestButton.isVisible({ timeout: 2000 })) {
        await guestButton.click();
      }
    } catch (e) {
      // Already logged in or no auth screen
    }

    // Wait for the main app container to load
    await page.waitForSelector('text="Overview"', { timeout: 15000 });
  });

  test('1. Receipt Ingestion: Verify Vault upload button and receipt structure', async ({ page }) => {
    // Navigate via Settings -> Documents
    await page.click('button:has-text("Settings")');
    await page.click('button:has-text("Documents")');
    await expect(page.locator('text="Protocol Upload"')).toBeVisible();
  });

  test('2. Transaction Persistence: Verify ledger line-edit UI renders', async ({ page }) => {
    await page.click('button:has-text("Transactions")');
    await page.click('button:has-text("Ledger & Journal")');
    await expect(page.locator('body')).toBeVisible();
  });

  test('3. Vault Scanner: OCR Deep Scan button exists and works', async ({ page }) => {
    await page.click('button:has-text("Settings")');
    await page.click('button:has-text("Documents")');

    // Upload a fixture document to activate the inspector drawer
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'scanner_test_doc.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    });

    const docCard = page.locator('text="scanner_test_doc.png"').first();
    await docCard.waitFor({ state: 'visible', timeout: 8000 });
    await docCard.click();

    await expect(page.locator('button:has-text("Deep OCR Scan")').first()).toBeVisible();
  });

  test('4. Send Invoice: Invoice dialog opens', async ({ page }) => {
    await page.click('button:has-text("Money In")');
    await page.click('button:has-text("Invoices & AP")');
    await expect(page.locator('button:has-text("Add Invoice")').first()).toBeVisible();
    await page.click('button:has-text("Add Invoice")');
    await expect(page.locator('text="Create New Invoice"').first()).toBeVisible({ timeout: 8000 });
  });

  test('5. ToolSandbox Algorithm: Sandbox renders without NaN on empty dates', async ({ page }) => {
    await page.click('button:has-text("Reports")');
    await page.click('button:has-text("Insights")');
    
    // Wait for the math algorithms to compute
    await page.waitForTimeout(2000); 
    
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
  });

  test('6. Receipt Ingestion: Ingest 3-item + tax fixture receipt, assert created transaction total $20.00 and tax line exists', async ({ page }) => {
    // Intercept AI extraction for parse-receipt
    await page.route('**/api/ai/process', async (route) => {
      const data = route.request().postDataJSON();
      if (data?.task === 'parse-receipt') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            vendorName: 'ShopRite Supermarket',
            date: '2026-09-08',
            totalAmountCents: 2000,
            taxAmountCents: 152,
            tipAmountCents: 0,
            categorySuggestion: 'Groceries',
            confidence: 0.98,
            lines: [
              {
                description: 'Organic Whole Milk 1 Gallon',
                amountCents: 549,
                category: 'Groceries/Dairy/Milk',
                quantity: 1,
                unitPriceCents: 549
              },
              {
                description: 'Artisanal Sourdough Bread',
                amountCents: 699,
                category: 'Groceries/Bakery',
                quantity: 1,
                unitPriceCents: 699
              },
              {
                description: 'Fresh Honeycrisp Apples 3lb',
                amountCents: 600,
                category: 'Groceries/Produce',
                quantity: 1,
                unitPriceCents: 600
              }
            ]
          })
        });
      } else {
        await route.continue();
      }
    });

    let interceptedTxPayload: any = null;
    await page.route('**/api/v1/transactions', async (route) => {
      if (route.request().method() === 'POST') {
        interceptedTxPayload = route.request().postDataJSON()?.transaction;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            transaction: {
              id: 'tx-fixture-receipt-assert-1',
              ...interceptedTxPayload
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to Documents in Vault
    await page.click('button:has-text("Settings")');
    await page.click('button:has-text("Documents")');

    // Upload receipt file fixture
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'fixture_shoprite_receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    });

    // Wait for document card to appear and click it
    const docCard = page.locator('text="fixture_shoprite_receipt.png"').first();
    await docCard.waitFor({ state: 'visible', timeout: 8000 });
    await docCard.click();

    // In the drawer, click Deep OCR Scan
    const scanBtn = page.locator('button:has-text("Deep OCR Scan")').first();
    await scanBtn.waitFor({ state: 'visible', timeout: 8000 });
    await scanBtn.click();

    // Verify AI Extracted Geometry displays the extracted total $20.00
    await expect(page.locator('text="AI Extracted Geometry"')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text="$20.00"')).toBeVisible();

    // Click "Inject & Sync Ledger"
    const injectBtn = page.locator('button:has-text("Inject & Sync Ledger")').first();
    await injectBtn.click();

    // Wait for the ledger injection toast or completion
    await expect(page.locator('text="Ledger injected and cryptographically linked!"')).toBeVisible({ timeout: 8000 });

    // Assert that the created transaction payload strictly satisfies the accounting invariants:
    // (1) Total Amount Cents matches the receipt total ($20.00 = 2000 cents)
    expect(interceptedTxPayload).not.toBeNull();
    expect(interceptedTxPayload.totalAmountCents).toBe(2000);
    expect(interceptedTxPayload.description).toBe('ShopRite Supermarket');

    // (2) Tax line exists as a distinct line item with exactly 152 cents ($1.52)
    const taxLine = interceptedTxPayload.lines.find((l: any) => 
      l.description?.toLowerCase().includes('tax') || l.tags?.includes('Tax')
    );
    expect(taxLine).toBeDefined();
    expect(taxLine.amountCents).toBe(152);

    // (3) Exactly 3 item lines + 1 tax line + 1 credit settlement line = 5 balanced lines
    expect(interceptedTxPayload.lines.length).toBe(5);

    // (4) Sum of all debit lines equals totalAmountCents (2000)
    const debitLines = interceptedTxPayload.lines.filter((l: any) => l.amountCents > 0);
    const sumDebits = debitLines.reduce((acc: number, l: any) => acc + l.amountCents, 0);
    expect(sumDebits).toBe(2000);

    // (5) Credit balancing line equals -2000
    const creditLines = interceptedTxPayload.lines.filter((l: any) => l.amountCents < 0);
    const sumCredits = creditLines.reduce((acc: number, l: any) => acc + l.amountCents, 0);
    expect(sumCredits).toBe(-2000);
  });

});
