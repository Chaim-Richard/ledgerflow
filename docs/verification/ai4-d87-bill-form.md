# AI #4 — D-87 bill form (same rules as D-86)

Base revision: `982958d07a64d3a7175e1e7f1d861fab85c71107` (`main`, 20 October 2026); rebased onto
`main` `2cca8686` for review. Branch `arena/3578f85b-ledgerflow`. Scope: `src/components/purchases/BillModal.tsx`, its unit tests, a new
browser spec and this evidence. D-86 (invoice form, #236) was checked first: merged, no lead request
for changes; its pattern is reused here rather than rewritten. No financial, tax, posting or server
file is touched.

## What changed

- **Labels above their fields, errors under them.** Every field the dialog shows (vendor, bill number,
  status, bill and due dates, each line's description / expense account / amount, a stock line's units
  and amount) keeps its label above the control and now carries `aria-invalid` and
  `aria-describedby` when it is refused, with the message as a `role="alert"` paragraph directly under
  that control.
- **Every save action validates.** Save Draft, Save & Close and Approve Bill (and the form's own submit
  path) run the browser's form check first; an invalid required field focuses itself and its message is
  written under it. The missing-vendor refusal moved from a toast to text under the vendor field, and
  the draft is kept.
- **A stock line that cannot post is refused where it is wrong.** The bill posting service already
  refuses a line with an item and no units or no cost (`billItemProblem`); the dialog now says so under
  the units field (units/decimals) or under the line's amount field (cost) and focuses it, instead of
  saving a bill that the posting step then rejects. The figures are unchanged.
- **Save stays in the same place.** The action bar is a non-shrinking block *outside* the scrolling
  form (`#bill-save-footer`, pinned by a unit test), the form scrolls independently (`min-h-0`), and
  all save buttons are disabled while a save is in flight (the existing `AsyncButton` guard plus a
  double-click test).
- **Phone (390px).** Dialog padding and rounding match the invoice form; line rows stack (description
  and account full width, amount beside a 44px remove target); the stock-item select and units input are
  full width; phone margins are tighter; totals are 2xl and tabular; the footer uses a two-column grid.
- **Touch targets and dark mode.** Close, remove-line and Add Split are ≥44px with `title` + `aria-label`;
  hard-coded `zinc` greys became theme variables (`--text`, `--muted`, `--elevated`, `--surface`), so the
  labels and secondary buttons stay readable in dark mode.
- **One primary action.** Only Save & Close is filled; Save Draft is a secondary button and Approve Bill
  is an emerald outline. Visible words, roles and behaviour are otherwise unchanged.

Not changed: `documentTotals`, tax codes and treatments, self-assessed tax, approval thresholds,
currency and exchange-rate handling, the number fetch, the saved payload's fields, posting services,
server validation, attachments, or any `src/server/` file.

## Verification (local, this branch)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | passed |
| `npm run lint:eslint` | **0 errors / 209 warnings** (cap 209 unchanged; the 4 `any` warnings in `BillModal.tsx` are identical to `HEAD`) |
| `npm test` (whole unit suite, no `LF_TEST_DATABASE_URL`) | **3,106 tests, 3,105 pass, 0 fail, 1 skipped** (Postgres suites skip without a test database), 744 suites, 26.1 min — measured on the rebased tree (branch on top of `main` `2cca8686`), so it covers both this commit and the D-88 commit |
| Bill dialog unit checks | **11/11** (5 existing + 6 new: label order, refusals under vendor/number, stock units and cost, in-flight lock, footer outside the form) |
| Bill-related suites together (`bill-modal`, `bill-stock-ui`, `attachments-ui`, `spread-bill`, `asset-from-bill`) | 23/23 before the new checks were added |
| `npm run build` | passed (Vite + esbuild server + PWA) |
| Dev-server smoke | `/journey-fixture` 200; `/src/components/purchases/BillModal.tsx` transforms and serves 200 |

## Browser evidence — written, not run here

`e2e/bill-form-layout.spec.ts` covers 390px and 1280px, light and dark: label-above-field geometry,
screenshot per case, Save in the same viewport before and after scrolling the form, the missing-vendor
refusal under the field, the stock-units refusal and focus, 44px phone targets, no sideways page
scroll, and the saved payload (`1 × 12.50`, item line `chair` × 2 → `amountCents: 1250`) with no
page errors.

**It could not be executed in this sandbox:** `npx playwright install chromium` cannot download
Chromium here (the download host is outside the allowed network), so no Playwright browser is present.
The spec must run on a machine with browsers (or CI) before it is quoted as browser evidence. No
visual-regression baseline was changed — the bill dialog is not in that snapshot set.

## Limits

- No local Postgres: the database-backed suites, RLS (`npm run test:rules`) and the coverage run were
  not executed here; CI is weekly/by hand per COORDINATION, so they are still owed before release.
- These are UI-boundary checks. They do not prove live posting, tax maths or a complete bill journey;
  the money figures are the lead's area and are untouched.
- The Vercel preview is red because the owner turned previews off; that is not an application failure.

## Release gate

**W3** (bill → posting → payment run → vendor statement): invoice/bill form usability and validation
evidence only. W3's Connected / Verified / Browser columns are unchanged; DIM-1 and the full workflow
proof remain the lead's. This is not a complete accounting-system audit or a release approval.

Status: implementation complete and locally verified (whole unit suite, ESLint and build green).
Two checks are still owed before it can be called final: the browser spec on a machine with Chromium,
and the database-backed suites on a machine with Postgres. AI #1 reviews the PR.
