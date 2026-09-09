# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> E2E Smoke Suite >> 3. Vault Scanner: OCR Deep Scan button exists and works
- Location: e2e/smoke.spec.ts:33:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('body')
Expected: visible
Received: undefined

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - region "Notifications alt+T"
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e14] [cursor=pointer]:
          - heading "LedgerFlow" [level=1] [ref=e16]
          - paragraph [ref=e19]: Workspace
        - generic [ref=e20]:
          - generic [ref=e21]:
            - heading "Navigate" [level=4] [ref=e22]
            - generic [ref=e23]:
              - button "Dashboard" [ref=e24] [cursor=pointer]
              - button "Transactions" [ref=e31] [cursor=pointer]
              - button "Reconcile" [ref=e37] [cursor=pointer]
              - button "Money In" [ref=e44] [cursor=pointer]
              - button "Money Out" [ref=e49] [cursor=pointer]
              - button "Reports" [ref=e54] [cursor=pointer]
              - button "Settings" [ref=e58] [cursor=pointer]
          - generic [ref=e63]:
            - heading "Worlds" [level=4] [ref=e64]
            - generic [ref=e66] [cursor=pointer]:
              - generic [ref=e67]: Main Ledger
              - generic [ref=e70]: $0.00
        - generic [ref=e71]:
          - button "Command Bar ⌘K" [ref=e72] [cursor=pointer]:
            - generic [ref=e73]: Command Bar
            - generic [ref=e77]: ⌘K
          - 'button "uiStore.isSidebarOpen ? undefined : (user ?" [ref=e78] [cursor=pointer]':
            - generic [ref=e82]: Exit Guest / Sign In
      - main [ref=e83]:
        - generic [ref=e84]:
          - generic [ref=e86]:
            - generic [ref=e90]: Main Ledger
            - generic [ref=e91]: · 42.36°N 71.06°W
          - button "world:realestate property:homes/* amount:>1000 ⌘K" [ref=e93] [cursor=pointer]:
            - generic [ref=e97]: world:realestate property:homes/* amount:>1000
            - generic [ref=e98]: ⌘K
          - generic [ref=e100]:
            - button "Toggle light/dark map view" [ref=e101] [cursor=pointer]
            - button "New" [ref=e105] [cursor=pointer]
            - button "Currently in Guest Mode. Click to sign in." [ref=e108] [cursor=pointer]:
              - generic [ref=e109]: Guest
              - generic [ref=e110]: Sign In
        - generic [ref=e112]:
          - button "Overview" [ref=e113] [cursor=pointer]
          - button "To Review" [ref=e118] [cursor=pointer]
          - button "AI Co-pilot" [ref=e123] [cursor=pointer]
        - generic [ref=e132]:
          - generic [ref=e133]:
            - heading "Welcome to the System" [level=1] [ref=e146]
            - paragraph [ref=e147]: Complete these steps to get your ERP fully operational.
          - generic [ref=e148]:
            - button [ref=e149] [cursor=pointer]:
              - heading "1. Create Workspace" [level=3] [ref=e155]
              - paragraph [ref=e156]: Set up your business profile and preferences.
            - button [ref=e157] [cursor=pointer]:
              - heading "2. Add Bank Accounts" [level=3] [ref=e162]
              - paragraph [ref=e163]: Connect or create asset accounts to track cash flow.
            - button [ref=e164] [cursor=pointer]:
              - heading "3. 3. Train AI Matching" [level=3] [ref=e169]
              - paragraph [ref=e170]: Review categorizations. The intelligence layer learns rules automatically.
            - button [ref=e171] [cursor=pointer]:
              - heading "4. Create First Invoice" [level=3] [ref=e176]
              - paragraph [ref=e177]: Get paid by your customers and record sales.
          - generic [ref=e178]:
            - button "Record First Entry Manually" [ref=e179] [cursor=pointer]
            - generic [ref=e181]: or
            - 'button ") : ( <> )}" [ref=e182] [cursor=pointer]': Explore with Sample Data
    - generic [ref=e185]:
      - generic [ref=e186]:
        - generic [ref=e187]: ledgerflow ONLINE
        - generic [ref=e190]: ·
        - generic [ref=e191]: tamper-evident · chain head 7f3a…c2e1
      - generic [ref=e192]:
        - generic [ref=e193]: 42.36°N 71.06°W
        - generic [ref=e194]: ·
        - generic [ref=e195]: verified FY 2026
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('E2E Smoke Suite', () => {
  4  | 
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await page.goto('/');
  7  |     
  8  |     // Check if Auth screen is visible, if so click Guest
  9  |     const guestButton = page.locator('button', { hasText: 'Continue as Guest' });
  10 |     try {
  11 |       await guestButton.waitFor({ state: 'visible', timeout: 3000 });
  12 |       await guestButton.click();
  13 |     } catch (e) {
  14 |       // Already logged in or no auth screen
  15 |     }
  16 | 
  17 |     // Wait for the main app container to load instead of networkidle
  18 |     // which hangs due to Firebase WebSockets
  19 |     await page.waitForSelector('text="Overview"', { timeout: 10000 });
  20 |   });
  21 | 
  22 |   test('1. Receipt Ingestion: Verify Vault upload button and receipt structure', async ({ page }) => {
  23 |     // Navigate via sidebar
  24 |     await page.click('text="Documents"').catch(() => {});
  25 |     await expect(page.locator('body')).toBeVisible();
  26 |   });
  27 | 
  28 |   test('2. Transaction Persistence: Verify ledger line-edit UI renders', async ({ page }) => {
  29 |     await page.click('text="Ledger & Journal"').catch(() => {});
  30 |     await expect(page.locator('body')).toBeVisible();
  31 |   });
  32 | 
  33 |   test('3. Vault Scanner: OCR Deep Scan button exists and works', async ({ page }) => {
  34 |     await page.click('text="Documents"').catch(() => {});
> 35 |     await expect(page.locator('body')).toBeVisible();
     |                                        ^ Error: expect(locator).toBeVisible() failed
  36 |   });
  37 | 
  38 |   test('4. Send Invoice: Invoice dialog opens', async ({ page }) => {
  39 |     await page.click('text="Sales"').catch(() => {});
  40 |     await expect(page.locator('body')).toBeVisible();
  41 |   });
  42 | 
  43 |   test('5. ToolSandbox Algorithm: Sandbox renders without NaN on empty dates', async ({ page }) => {
  44 |     await page.click('text="Insights"').catch(() => {});
  45 |     
  46 |     // Wait for the math algorithms to compute
  47 |     await page.waitForTimeout(2000); 
  48 |     
  49 |     const bodyText = await page.locator('body').innerText();
  50 |     expect(bodyText).not.toContain('NaN');
  51 |   });
  52 | 
  53 | });
  54 | 
```