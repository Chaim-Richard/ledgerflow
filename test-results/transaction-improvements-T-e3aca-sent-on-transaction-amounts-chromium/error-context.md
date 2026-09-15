# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transaction-improvements.spec.ts >> Transaction List Improvements Suite >> Tabular figures (tabular-nums) class is present on transaction amounts
- Location: e2e/transaction-improvements.spec.ts:100:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="filtered-totals-bar"]') to be visible

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
          - button "Transactions" [ref=e113] [cursor=pointer]
          - button "Account Register" [ref=e119] [cursor=pointer]
          - button "Ledger & Journal" [active] [ref=e123] [cursor=pointer]
          - button "Bank Connections" [ref=e129] [cursor=pointer]
          - button "Audit Trail" [ref=e134] [cursor=pointer]
        - generic [ref=e142]:
          - generic [ref=e144]:
            - button "Owner Lens" [ref=e145] [cursor=pointer]
            - button "Accountant Lens" [ref=e149] [cursor=pointer]
          - generic [ref=e152]:
            - generic [ref=e155]:
              - generic [ref=e156]: EXECUTIVE SUMMARY
              - heading "Plain English Books" [level=1] [ref=e160]
              - paragraph [ref=e161]: No debits or credits. Just clean, immediate clarity on your bottom line.
            - generic [ref=e162]:
              - generic [ref=e163]:
                - heading "Money In" [level=3] [ref=e165]
                - paragraph [ref=e170]: $0
                - paragraph [ref=e171]: Verified Revenue Collected
              - generic [ref=e172]:
                - heading "Money Out" [level=3] [ref=e174]
                - paragraph [ref=e179]: $0
                - paragraph [ref=e180]: Operating Expenditures
              - generic [ref=e181]:
                - heading "Net Capital Remaining" [level=3] [ref=e183]
                - paragraph [ref=e188]: $0
                - paragraph [ref=e189]: Unencumbered Liquidity
            - generic [ref=e190]:
              - generic [ref=e191]: Explain This Month's Performance
              - paragraph [ref=e195]: "You generated $0 in net earnings for September: $0 in operating revenue minus $0 in expenses"
            - generic [ref=e196]:
              - heading "Recent Activity Stream" [level=3] [ref=e198]
              - generic [ref=e199]: No transactions recorded yet in this workspace.
    - generic [ref=e201]:
      - generic [ref=e202]:
        - generic [ref=e203]: ledgerflow ONLINE
        - generic [ref=e206]: ·
        - generic [ref=e207]: tamper-evident · chain head 7f3a…c2e1
      - generic [ref=e208]:
        - generic [ref=e209]: 42.36°N 71.06°W
        - generic [ref=e210]: ·
        - generic [ref=e211]: verified FY 2026
```

# Test source

```ts
  10  |       localStorage.setItem('guest_has_seeded', 'true');
  11  |     });
  12  | 
  13  |     await page.goto('/');
  14  | 
  15  |     const guestButton = page.locator('button', { hasText: 'Continue as Guest' });
  16  |     try {
  17  |       if (await guestButton.isVisible({ timeout: 2000 })) {
  18  |         await guestButton.click();
  19  |       }
  20  |     } catch {
  21  |       // already in guest mode
  22  |     }
  23  | 
  24  |     await page.waitForSelector('text="Overview"', { timeout: 15000 });
  25  |   });
  26  | 
  27  |   test('Filtered totals bar displays and updates upon filtering, and attachment badge renders on transaction with fileUrls', async ({ page }) => {
  28  |     // Navigate to Transactions -> Ledger & Journal
  29  |     const txNav = page.locator('button:has-text("Transactions")');
  30  |     if (await txNav.isVisible()) {
  31  |       await txNav.click();
  32  |     }
  33  |     const ledgerNav = page.locator('button:has-text("Ledger & Journal")');
  34  |     if (await ledgerNav.isVisible()) {
  35  |       await ledgerNav.click();
  36  |     }
  37  | 
  38  |     // Wait for the Transaction Grid and Filtered Totals bar
  39  |     const totalsBar = page.locator('[data-testid="filtered-totals-bar"]');
  40  |     await totalsBar.waitFor({ state: 'visible', timeout: 15000 });
  41  | 
  42  |     // Assert that the three cells in the summary bar exist
  43  |     const inflowElement = page.locator('[data-testid="filtered-inflow"]');
  44  |     const outflowElement = page.locator('[data-testid="filtered-outflow"]');
  45  |     const matchingRecords = page.locator('[data-testid="matching-records"]');
  46  | 
  47  |     await expect(inflowElement).toBeVisible();
  48  |     await expect(outflowElement).toBeVisible();
  49  |     await expect(matchingRecords).toBeVisible();
  50  | 
  51  |     // Verify initial inflow text
  52  |     const initialInflowText = await inflowElement.innerText();
  53  |     expect(initialInflowText).toContain('Filtered Inflow:');
  54  | 
  55  |     // Inject a test transaction with attachments (fileUrls) into the Zustand ledger store
  56  |     await page.evaluate(() => {
  57  |       const store = (window as any).__ledgerStore;
  58  |       const testTx = {
  59  |         id: 'tx_e2e_attachment_test',
  60  |         uid: 'guest_user',
  61  |         workspaceId: 'default',
  62  |         date: '2026-09-15',
  63  |         description: 'Special Audit Item with Receipt',
  64  |         type: 'income',
  65  |         status: 'completed',
  66  |         totalAmountCents: 888800,
  67  |         currency: 'USD',
  68  |         fileUrls: ['https://example.com/receipt1.pdf', 'https://example.com/receipt2.pdf'],
  69  |         createdAt: '2026-09-15',
  70  |         lines: [
  71  |           { accountId: 'acc_cash', accountName: 'Cash', amountCents: 888800 },
  72  |           { accountId: 'acc_rev', accountName: 'Revenue', amountCents: -888800 }
  73  |         ]
  74  |       };
  75  |       if (store && store.getState) {
  76  |         const current = store.getState().transactions || [];
  77  |         store.getState().setTransactions([testTx, ...current]);
  78  |       }
  79  |     });
  80  | 
  81  |     // Check if the attachment badge renders
  82  |     const attachmentBadge = page.locator('[data-testid="attachment-badge"]').first();
  83  |     if (await attachmentBadge.count() > 0) {
  84  |       await expect(attachmentBadge).toBeVisible();
  85  |     }
  86  | 
  87  |     // Filter the grid with search input
  88  |     const searchInput = page.locator('input[placeholder*="Search" i], input[placeholder*="Filter" i]').first();
  89  |     if (await searchInput.isVisible()) {
  90  |       await searchInput.fill('NonExistentTermXYZ12345');
  91  |       // After filtering to non-existent term, inflow should update to $0.00
  92  |       await expect(page.locator('[data-testid="filtered-inflow"]')).toContainText('$0.00');
  93  |       await expect(page.locator('[data-testid="matching-records"]')).toContainText('0');
  94  | 
  95  |       // Clear search
  96  |       await searchInput.fill('');
  97  |     }
  98  |   });
  99  | 
  100 |   test('Tabular figures (tabular-nums) class is present on transaction amounts', async ({ page }) => {
  101 |     const txNav = page.locator('button:has-text("Transactions")');
  102 |     if (await txNav.isVisible()) {
  103 |       await txNav.click();
  104 |     }
  105 |     const ledgerNav = page.locator('button:has-text("Ledger & Journal")');
  106 |     if (await ledgerNav.isVisible()) {
  107 |       await ledgerNav.click();
  108 |     }
  109 | 
> 110 |     await page.waitForSelector('[data-testid="filtered-totals-bar"]', { timeout: 15000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  111 | 
  112 |     // Assert that the inflow value span has the tabular-nums class
  113 |     const inflowValue = page.locator('[data-testid="filtered-inflow"] .tabular-nums').first();
  114 |     await expect(inflowValue).toBeVisible();
  115 |   });
  116 | });
  117 | 
```