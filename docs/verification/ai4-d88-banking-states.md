# AI #4 — D-88 Banking screen: empty, loading and error states, one action each

Base revision: `main` `982958d07a64d3a7175e1e7f1d861fab85c71107`, on top of the D-87 commit on
`arena/3578f85b-ledgerflow`. Scope: `src/components/banking/Banking.tsx`,
`src/components/banking/ConnectedBanks.tsx`, the shared `EmptyState` (an additive prop), a new unit
test file and this evidence. No account data, posting, tax or `src/server/` file is touched; the Plaid
routes and `readBankStatuses` are unchanged.

## What changed

**The bank-account area of the screen has three states, one action each**

| State | What the user sees | The one action |
|---|---|---|
| Loading (the chart of accounts is on its way) | `LoadingState` — "Loading bank accounts…" | none; the header actions (Import statement, Money in/out, Transfer, Make deposit) stay usable |
| Could not be read (`failed.accounts`) | "We couldn't load your bank accounts" with why, in `role="alert"` | **Try again** → `retry('accounts')`, and the screen returns to loading while the live subscription restarts |
| Nothing yet | `EmptyState` — "No bank accounts yet", one sentence on connecting a bank or importing a statement | **Connect Bank** (the Plaid control itself) |

- The state block only replaces the account cards: with an error but accounts already in hand, the
  cards stay and the general data status bar keeps its own retry.
- **Demo mode never waits**: the shared `useLedgerCollections` hook treats a guest (no database) as
  loaded, so a demo shows the empty state instead of a spinner that could never finish.
- **One Connect control, not two**: the header shows "Connect Bank" when accounts exist; when there are
  none it lives inside the empty state as that state's single action.
- `EmptyState` gained an optional `action` node so a non-button control (the Plaid link) can be the one
  action. `title`/`description`/`actionLabel`/`onAction` behave exactly as before for every other screen.

**The connections list (`ConnectedBanks`) has its own explicit read state**

- Loading → `LoadingState` — "Loading bank connections…".
- A failed read is no longer silently shown as "no connections": the screen says "We couldn't check your
  bank connections", names the failure, and offers the one action, **Try again**, which returns to the
  loading state and asks the server once more.
- A workspace with no connections still renders nothing (the bank-account area already carries the
  empty state), and a demo (no database) or a missing workspace stays quiet: no spinner, no error.
- Retry and other new controls are ≥44px and use the theme variables, so they read in dark mode.

## Verification (local)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | passed |
| ESLint on the changed files | 0 problems (the effect no longer sets state synchronously; `react-hooks/set-state-in-effect` is clean) |
| New `src/tests/banking-states.test.tsx` | **7/7** — loading keeps header actions, failed read + Try again returns to loading, demo shows the empty state at once, empty state has exactly one action ("Connect Bank"), a bank card shows its code and Sync Feed, the connections list loads → fails → retries (2 server calls), and no-connections renders nothing |
| With the existing banking suites (`bank-statement-import-ui` + these) | **19/19** |
| With the bill suites (`bill-modal`, `bill-stock-ui`) | **33/33** |
| Whole unit suite `npm test` (no `LF_TEST_DATABASE_URL`) | **3,102 tests, 3,101 pass, 0 fail, 1 skipped** (Postgres suites skip), 744 suites, 26.1 min |
| `npm run lint:eslint` / `npm run build` | 0 errors / **209 warnings** (cap unchanged) / build passed |

## Limits

- No browser was available in this sandbox (Playwright cannot download Chromium here), so there is no
  screenshot/phone capture and no e2e case for these states yet; they are jsdom checks. The existing
  `e2e/bank-statement-formats.spec.ts` is unaffected (it uses the header and the statement dialog).
- No local Postgres, so the database suites and RLS were not run here.
- These are screen-state checks, not proof of a bank feed or a reconciliation. No money is calculated or
  posted by this change.

## Release gate

**W4** (bank import / feed → reconciliation): empty/loading/error UI evidence only. W4's
Connected / Verified / Browser columns are unchanged; AU-1 and the reconciliation proof remain with
their owners. This is not a full audit or a release approval.

Status: implementation complete and locally verified (whole suite, ESLint, build green). Still owed:
a browser run on a machine with Chromium, and the database-backed suites. AI #1 reviews the PR.
