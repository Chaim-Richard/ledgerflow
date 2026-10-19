import { test, expect } from '@playwright/test';
import { mountJourney, remountJourney, setLedgerField } from './support/journeyFixture';

/**
 * F-45 · W9 (RELEASE_GATE): close a month → posting refused → reopen with a reason → posting allowed.
 *
 * The close and the reopen request are checked in e2e/month-end-close-journey.spec.ts. This journey takes
 * the same month from the posting side, in the journal entry screen:
 *
 *   - the workspace has closed 2026-09 (the store's lock date is 2026-09-30, as the server reports it);
 *   - a September entry (2026-09-15, 50.00 office costs paid from Bank 1000) cannot be committed: the date
 *     is named as sealed, and the commit button says PERIOD IS SEALED and stays disabled;
 *   - the owner reopens the month with a reason (the server answers with no lock date), and the same entry
 *     can now be committed;
 *   - an October entry was never blocked.
 */

const WORKSPACE = 'w9-posting';
const USER = { uid: 'journey-user', email: 'owner@example.test', displayName: 'Journey Owner', isAnonymous: false };
const BANK = { id: 'bank-1000', uid: 'journey-user', workspaceId: WORKSPACE, code: '1000', name: 'Bank 1000', type: 'asset', category: 'Cash' };
const OFFICE = { id: 'expense-5000', uid: 'journey-user', workspaceId: WORKSPACE, code: '5000', name: 'Office costs', type: 'expense', category: 'Expenses' };

async function fillEntry(dialog: import('@playwright/test').Locator, date: string) {
  await dialog.locator('#je-date').fill(date);
  await dialog.locator('#je-desc').fill('Office supplies, September');
  await dialog.getByLabel('Account for line 1').fill('5000 - Office costs');
  await dialog.getByLabel('Debit amount for line 1').fill('50.00');
  await dialog.getByLabel('Account for line 2').fill('1000 - Bank 1000');
  await dialog.getByLabel('Credit amount for line 2').fill('50.00');
}

test('W9 browser: a sealed month refuses a September entry until it is reopened with a reason', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });

  const { errors } = await mountJourney(page, {
    workspaceId: WORKSPACE,
    ledger: { accounts: [BANK, OFFICE], transactions: [], journalEntries: [] },
    mounts: [{ module: '/src/components/ledger/JournalEntryModal.tsx', props: { isOpen: true, user: USER, accounts: [BANK, OFFICE], workspaceId: WORKSPACE } }],
  });

  // 1. The month is closed: the lock date is the end of September.
  await setLedgerField(page, 'lockDate', '2026-09-30');
  await remountJourney(page, [{ module: '/src/components/ledger/JournalEntryModal.tsx', props: { isOpen: true, user: USER, accounts: [BANK, OFFICE], workspaceId: WORKSPACE } }]);

  const journal = page.getByRole('dialog');
  await fillEntry(journal, '2026-09-15');

  // 2. Posting is refused: the date is named as sealed, and the commit control is disabled.
  await expect(journal.getByText(/falls within a closed and sealed ledger accounting period \(Lock ended: 2026-09-30\)/)).toBeVisible();
  await expect(journal.getByRole('button', { name: 'PERIOD IS SEALED', exact: true })).toBeDisabled();
  await expect(journal.getByRole('button', { name: 'COMMIT TO LEDGER', exact: true })).toHaveCount(0);

  // 3. The reopen (with its reason, sent by the close screen; checked in month-end-close-journey.spec.ts) is
  //    answered by the server with no lock date, and the store receives that.
  await setLedgerField(page, 'lockDate', null);
  await remountJourney(page, [{ module: '/src/components/ledger/JournalEntryModal.tsx', props: { isOpen: true, user: USER, accounts: [BANK, OFFICE], workspaceId: WORKSPACE } }]);

  const reopened = page.getByRole('dialog');
  await fillEntry(reopened, '2026-09-15');
  await expect(reopened.getByText(/falls within a closed and sealed ledger/)).toHaveCount(0);
  await expect(reopened.getByRole('button', { name: 'PERIOD IS SEALED', exact: true })).toHaveCount(0);
  await expect(reopened.getByRole('button', { name: 'COMMIT TO LEDGER', exact: true })).toBeEnabled();

  // 4. A date after the lock was never refused, even while the month was closed.
  await reopened.locator('#je-date').fill('2026-10-02');
  await expect(reopened.getByRole('button', { name: 'COMMIT TO LEDGER', exact: true })).toBeEnabled();

  expect(errors).toEqual([]);
});
