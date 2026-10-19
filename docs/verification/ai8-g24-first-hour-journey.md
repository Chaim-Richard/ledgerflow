# G-24 — W1 first-hour journey test (AI #8, 19 Oct 2026)

Browser test for RELEASE_GATE **W1** (P2-1): sign up → company details → chart of
accounts → first invoice → first report. New file `e2e/journeys-w1.spec.ts`, following
the fixture pattern of the W2–W9 journey tests (stubbed `/rest/v1` + `/api`
boundaries, seeded Zustand stores, real components mounted in the browser).

## What the test drives

1. **SetupWizard** with a freshly signed-up owner workspace: company details
   (pre-filled, editable, Next advances) → chart of accounts (3 seeded accounts
   named, "Creative Project" template picked, `POST apply-template` recorded) →
   opening balances ($5,000.00 on Business Checking previews as
   "Debits $5,000.00 = credits $5,000.00", `POST opening-balances` recorded with
   `{ accountId: 'bank-1000', amountCents: 500000 }`) → done screen
   ("debits and credits are both $5,000.00") → "Create the first invoice"
   switches the app to the sales tab.
2. **InvoiceModal** for the first invoice: customer "Acme Corp", one line
   (2 × $150.00 Website design → Consulting Revenue), line total $300.00,
   "Send Invoice" → `onSave` receives `amountCents: 30000`, `status: 'sent'`,
   `customerId: 'c1'`.
3. **StatementView** (customer statement) for the invoice's month shows
   Acme Corp with $300.00 outstanding and the invoice row in the table.

Both tests run at 390px, check for horizontal overflow, run axe
(serious/critical must be zero), and assert zero page errors. Sign-up itself is
represented by the signed-in state the app sees after a successful sign-up; the
auth provider is not under test.

## Places a new user can get stuck (found while driving the journey)

1. **First report has no on-ramp.** After sending the first invoice there is no
   "view the report" affordance — the customer statement lives under Reports
   with no link from the invoice flow or the setup-done screen. The W1
   workflow's last step is the hardest to discover. (Biggest gap found.)
2. **Chart template: disabled Next with no explanation.** On an empty workspace
   with no template picked, Next is disabled (`!templateId && accounts.length === 0`)
   but nothing says why — a new user may not realize picking a template is required.
3. **Opening balances needs an Opening Balance Equity account.** Without it the
   record button is disabled; the red message does explain the fix ("add the
   account, or start from zero"), so this one is guided, but a user who kept an
   empty chart must loop back to the chart step to get one.
4. **Company-details save can fail quietly.** A changed business name saves via
   `updateDoc`; on failure the wizard toasts and stays on the step. The toast
   dismisses itself — on a flaky connection a user could click Next repeatedly
   without realizing nothing saved.
5. **Invoice: customer is required, but there's no "add customer" in the form.**
   Typing a new name works (it creates an ad-hoc customer), so there's no dead
   end — but the ad-hoc record has no email or details, which will surprise the
   user later at send time.
6. **Invoice line needs an income account.** The "Type or select account" field
   is clear when the chart has income accounts (every template does). On a
   hand-built chart with none, the datalist is empty and the user must leave the
   flow to add one.

None of these change how money is calculated or posted (AI #1's lane).

## Files

- `e2e/journeys-w1.spec.ts` (new)
- `docs/RELEASE_GATE.md` — W1 row: Browser column now cites this evidence (CI pending)

## Checks

Per the requester's instruction the local suite was not run in this session;
GitHub runs the tests. The spec follows the same fixture/axe/phone pattern as
the merged W2–W9 journey specs. No money, posting, server, schema, dependency
or baseline changes.
