# LedgerFlow tracker (kept by Claude)

This is the working plan: what is done, what is next, and the full 864-item list. Claude
updates it as work lands. Things that need the owner are in [FOR_YOU.md](FOR_YOU.md).

**Automatic restart:** a Routine ("LedgerFlow: keep working (wakes this session)") wakes this
Claude session every 5 hours, so work continues by itself after a 5-hour or weekly usage limit
resets, and any approval still waiting is cancelled so the session can't stay stuck. (A version
that started separate new sessions did nothing: they had no code or connectors.) To stop it:
tell Claude, or delete it under Routines on claude.ai.

**Second AI:** if another AI works on the repository too, the lanes and the "who edits which
files" board are in [COORDINATION.md](COORDINATION.md).

- [x] Codex C-1: unused variables and parameters outside Claude's reserved files; ESLint warnings 2022 → 1805 (codex, PR #31; merged snapshot verified).

**Setting up a fresh machine (for Claude):** Node 24 and PostgreSQL 16. Create a local test
database, apply `supabase/migrations/*` with `LF_TEST_DATABASE_URL=... npx tsx scripts/db-test.ts setup`,
then the checks: `npx tsc --noEmit -p tsconfig.json`, `LF_TEST_DATABASE_URL=... npm test`,
`npx tsx scripts/db-test.ts rls`, `npm run build`, browser tests with Playwright, `npm run ratchet:update`.

---

# NOW — working straight on `main` (2026-09-24, late)

**How we work now (your rule, in CLAUDE.md):** Claude commits and pushes directly to `main`.
No feature branches, no pull requests. GitHub CI runs weekly and by hand only (5 Oct: Actions
minutes); Claude and Codex run all checks locally before pushing. **Vercel deploys by
itself from GitHub about a minute after each push** (connected 2026-09-25) — Claude no longer
deploys by hand; database migrations are still applied to Supabase by Claude.

**Order you asked for:** all 864 items. First the LAUNCH list (112), then QUALITY (105),
then the 488 LATER items. Claude works through them in that order and ticks them off below.

### Done this session (all on `main`, tested: type check, 411 unit tests incl. database,
### 33/33 browser tests, build)
| Item | What |
|---|---|
| K-02 | Items on invoice lines: pick by name/SKU, price + cost filled, free text unlinks (tested) |
| J-07 | Sales by Item: issued invoices only, base currency, real cost of goods sold or "(est.)", "No item" row, dark mode (tested) |
| J-12 | Journal Sheet: posted entries only, base currency, unbalanced list, dark mode (tested) |
| W-03 | Cost of goods sold on invoices fixed (no FX mistake, missing accounts don't block the invoice → "Cost not recorded · Retry"); **stock now goes down on sale and back on void/edit/delete**, same database transaction; an entry can't be reversed twice (7 database tests) |
| L-81 | SECURITY restore can't touch other workspaces (earlier today) |
| L-82 | Removed AI Studio fallbacks: errors were reported as success; in-memory billing copy |
| L-90 | SECURITY viewers could post/edit/reverse/close periods via the server; any member could add/remove members, create API keys, start billing; labeling read other workspaces' accounts — all fixed + tests |
| L-93 | Express 5 (merged on main by Dependabot) made main's type check fail and would crash at startup — fixed |
| Banking 1 | Y-09 Y-10 CA-01: pay invoices/bills from a bank line, split a bank line. Fixed: **statement import always failed** (browser can't write bank lines); **Receive payment failed** without account mappings; payment records lacked the fields reports read |
| Credits | K-09 K-10 BA-09..13: apply credits to open invoices/bills, refunds, Apply/Refund buttons. Fixed: creating credit notes failed; **payments were counted twice** when a paid invoice/bill was edited; partial updates (Retry) were rejected |
| Report shell | N-01 N-02 N-06 N-09 N-11 I-18: one fiscal-aware period for all reports, compare previous period / last year, shareable link, Print/PDF; `npm run scaffold:report -- Name` (the scaffold script was broken and works again) |
| Banking 2 | L-92 + Y-08: bank connections belong to the workspace, expired bank logins can be reconnected · K-20: Undeposited Funds + "Make deposit" · Y-03: saved CSV column layouts per bank |
| Bulk import | K-01 (= M-18 BK-01 BK-05 BK-06 CA-11): Settings → Import Data — customers, vendors, items, accounts from CSV/Excel; columns matched by name; every row checked, all or nothing; duplicates skipped; items' opening stock posted; undo keeps records already in use (12 tests) |
| Period close 1 | R-01 R-02 R-03 R-08 R-10 BA-15: one lock rule (hard close, soft close for bookkeepers, partial unlock) in database + server + screens; close / reopen (reason; owner for hard) / unlock only through the server, audited; checklist with sign-offs; drafts block the close. Fixed: the close screen never loaded invoices/bills/bank lines; a lock on the 28th closed the month; "clear lock date" only changed the screen; bookkeepers could close months (11 tests) |
| Notifications | S-01 S-03 S-04 S-06 S-14 S-19 + bounces: real notifications from the server (one per person, stored in the database, live bell): invoice emailed, invoice overdue (daily), customer payment received, email bounced / marked spam, bank connection expired, person invited / joined. Each person marks their own read and chooses which types they get (bell → gear). Only their own are visible (database rules tested). **The old bell showed made-up alerts kept only in the open page** |
| Trust 2: privacy and errors | L-10: Settings → Security → "Download my data" (profile, workspaces and roles, notifications, sign-ins, own audit entries; tested). L-14: crashes inside a screen are now reported too (the view boundary caught them silently); browser errors were already stored with a daily digest. BJ-04 BJ-06 BJ-08 BJ-09: `docs/privacy/` — personal data inventory, retention, sub-processors, DPA template (for a lawyer to review). AD-02: guard test that effects starting timers clean them up |
| Trust 1: deleting and restoring | L-07 L-09 L-124 L-130: a backup now holds the whole books (credit notes, vendor credits, bank lines, journal entries, purchase orders, employees, pay runs, numbering… were missing) and restoring it brings the trial balance and documents back exactly (database test); a backup can't rewrite closed periods. Deleting a workspace removes its data from every table (bank connections with their tokens, API keys, members, notifications… were left behind), with a guard so a new table can't be forgotten; the audit trail stays. Deleting an account hands shared workspaces to another owner or stops and says who to make owner first, schedules workspaces only you use for deletion (30 days), and removes personal data (tested). "Undo deletion" could never run: the backup import used the same address; it has its own now, with a "Keep this workspace" banner, and a guard test finds any two routes on the same address (it also found reports mounted twice). The Security screen's instant "purge" (wiped the books at once, no recovery) is now the 30-day "Delete workspace"; instant clearing is for demo data only |
| Accessibility 2 | E-23 E-27: an invoice can be opened, filled in and saved with the keyboard only (browser test); 45 clickable rows/headers/menus answer Enter and Space or are marked as plain containers. Text contrast checked by axe on 6 screens in light and dark (new browser test with a baseline that may only go down): failures went from 5–44 per screen to 0–4. Causes fixed (**L-129**): `dark:` styles followed the computer's setting instead of the app's theme; the accent colour was the same in both themes (brass text about 2:1 in light); muted grey text just under the minimum in both themes |
| Dates and errors | I-12: dates on screen follow Preferences → Date Display Format (it changed nothing before: **L-128**), with "Oct 02, 2026" as a choice and the default; inputs and files stay YYYY-MM-DD (tested in 3 time zones). BO-07: failed saves and loads say what happened and what to do (closed period → reopen in Month-End Close, no permission → ask an owner, session ended, offline, duplicate, unbalanced, invalid…) instead of "SYSTEM ERROR: CREATE" and a database message (tested) |
| Accessibility 1 | E-02 E-03 E-07 (most) E-04 E-22 E-29: 142 form labels are now linked to their fields (`Labelled`, unique id per field, same look; done by a codemod), icon-only buttons and switches have names, empty action-column headers say "Actions", backdrops are no longer fake focusable buttons; every keyboard-focused control shows a ring; "Skip to content" is the first Tab stop (it was skipped: the sub-navigation's scrollIntoView moved the browser's Tab starting point); browser test. Lint warnings 2,612 → 2,420 |
| Loading and confirmations | I-01 I-02 I-05 I-07 I-08 (AA-02): one data status line above every screen says what is loading, what failed to load (with "Try again") and which lists are cut at their limit (the old banner said "2,000 of N"); Sales, Purchases, Payments, Credit notes, Estimates, Recurring and Data Health show "Loading…" instead of "nothing here" (Data Health said "Everything checks out" before checking); guard test. Void and delete name the record and ask first (voiding an invoice happened on one click); Delete only on draft bills (the database refuses the rest). Invoice and bill dialogs ask before discarding unsaved changes. Removed the "seed demo data" button that wrote 20 fake records into a real workspace (**L-127**) |
| Money dialogs | H-01 H-02 H-03 H-04: component tests (jsdom + Testing Library, `src/tests/*.test.tsx`) for the invoice, bill, payment and bad debt dialogs check what each saves or sends: lines, tax on top or included, totals, numbers kept on edit, approval limit, allocations, refusals. Fixed **L-125** (invoice dialog: a customer typed but not on the list was saved as a made-up customer id; editing wiped the memo, terms and email text; currency defaulted to USD in any workspace) and **L-126** (payments: "apply" paid the newest invoices first, and drafts were offered though the server refuses them) |
| Speed at scale | C-14 C-16 (C-15, AA-06 partly): screens ask for the data they read (`useLedgerCollections`); the ledger and chart of accounts load when a workspace opens, everything else the first time a screen needs it, then stays live; a guard test fails if a screen reads data without asking. Live lists now fetch **only the rows that changed** (by `updated_at`), not the whole list after every edit (tested on a fake database). Fixed **L-121**: balances and reports used only the last 12 months of entries, and invoices/bills loaded only on a few tabs (Reports, Data Health and the dashboard saw none or an old copy); editing a document whose list wasn't loaded now reads it from the database instead of posting a partial one. Removed 6 listeners nobody read and **L-122** (a writer that failed on every balance change) |
| Data health | Z-07 Z-08 Z-09 Z-10 Z-14 Z-15 Z-32: Data Health now runs 11 checks from one list (`src/lib/dataChecks.ts`): entries that don't balance (with exchange rates), lines on missing accounts, duplicate invoice numbers, the same vendor bill entered twice, future-dated entries, empty invoices or lines without an account, overpaid invoices, foreign documents at rate 1, negative stock, recurring schedules with problems, invoices long overdue; each says what to do and opens the record. **Links to any record** (`#sales/invoice/<id>`) open the screen and highlight it (transactions open directly). Invoices and bills can now be **edited from the lists**. Fixed **L-120** |
| Tax 2 | T-03 T-06 T-07: the Tax return screen shows 9 boxes in the home currency (tax on sales, reverse-charge tax due, total due, reclaimable, net to pay, sales and purchases excluding tax, zero-rated and exempt sales), sales and purchases by treatment, and "File this return" (owners/accountants) keeps an unchangeable copy on the server; later changes in that period show box by box. Reverse-charge bills post the tax as due and reclaimable. Fixed **L-118** (credit notes never reduced the tax owed) |
| Tax 1 | T-01 T-02 T-04: tax codes with parts (GST + PST), a part on top of the others (compound), and how the amount is reported (taxed, zero-rated, exempt, reverse charge, out of scope), edited under Taxes. Invoices and bills pick a tax code, prices with or without tax, and show subtotal, discount, each tax part and the total in the document's currency; the PDF too. Fixed **L-113** (tax added on top was never billed), **L-114** (server dropped discount / tax-inclusive / bill currency), **L-115** (every line posted to one account), L-116, L-117 |
| Recurring + POs | BE-03: recurring schedules can be paused, resumed and deleted; a recurring invoice now becomes a **draft invoice** to check and send (team notified); a recurring entry is posted only with real, balanced accounts, otherwise the schedule shows why. BE-11: purchase orders are saved, goods received are recorded on them, "Create bill" opens the bill filled from the order (received quantities), and the 3-way match compares all three. Fixed **L-111** (recurring invoices wrote blank-account entries with no workspace) and **L-112** (orders were never saved) |
| Online payments | K-11: the emailed invoice link lets the customer pay by card; Stripe's confirmation becomes a real payment (payment record, invoice paid, one ledger entry in the home currency into a "Stripe Clearing" account, team notified); replays ignored; overpayment stays as a credit. Fixed **L-109** (the old handler guessed accounts and kept no payment record) and **L-110** (payments on foreign-currency invoices were booked unconverted) |
| Reminders | BE-01 K-26: payment reminders emailed every morning on the days set in Settings → Emails & Reminders (workspace's own date, next step only, once a day); "Reminders on / No reminders" switch per customer. Fixed: **L-107 the "+" on a customer row saved an empty invoice** instead of opening the form; **L-108 every customer showed a made-up "Preferred Partner" label** |
| Email 1 | S-01 BL-01 BL-03 BL-05 BL-08 K-08: invoices and reminders emailed by the server (writers; drafts refused; invoice currency; PDF), templates per workspace with preview (Settings → Emails & Reminders), plain-text part, send log per invoice, bounce/complaint reports skip that address. **L-106: emailing an invoice never worked** (no login token sent); the three copies of the email-provider code are now one |
| Period close 4 | CA-03: repost check in Month-End Close (missing, doubled, left-over, wrong-amount entries) with Repost. **L-105 fixed: foreign-currency invoices, bills, credits and payments were converted twice in the ledger** (EUR 100 at 1.10 booked as 121.00) |
| Period close 3 | K-19: bad debt write-off keeps the sale (the old one voided the invoice **and** booked the loss: counted twice), base currency, reversal when the customer pays |
| Period close 2 | R-06: month-end depreciation run (one entry, catch-up, runs once). Fixed: **the Fixed Asset Register saved nothing** (assets and "posted" depreciation lived only in the open page) |
| Database rules | L-100 **time zone and fiscal year couldn't be saved** · L-101 **adding a customer failed** · L-102 **applying a chart-of-accounts template failed** (now done by the server) · guard test: every field the app saves must be allowed by the database (applied to Supabase) |

### New findings (added to the tracker)
- L-91 Fake "success" endpoints: POST/GET /api/v1/ecommerce, marketing, helpdesk, hr,
  manufacturing, universal-ops echo made-up data (used by the API Hub demo). Decide: delete
  or label as demo (shortcut 9).
- L-92 Plaid bank connections are stored per user, not per workspace; /sync returns all of
  a user's banks. Fix with the banking prompt.
- L-94 Invoice postings are built in the browser and the server checks them (balanced,
  accounts in the workspace, period open, role) but doesn't recompute them from the invoice.
  Later: build invoice/bill postings on the server (document engine, shortcut 2).

### Next (in order)
1. ~~Report shell~~ done (N-08 cash vs accrual, N-03 period columns, N-10 column chooser: later).
2. ~~Credits, refunds, quick payment~~ done → banking (all done; CA-05 finance books later) → period close → notifications/email → tax
   depth → data-health checks → speed at scale → forms → trust & compliance → clean-up.
3. Then QUALITY, then the 488 LATER items.

## Vercel status (2026-09-24, Claude has Vercel access)

- Project `ledgerflow` (prj_C93KYrrMjnqgmYzHKC3gcnYZkekg) builds and deploys this branch:
  **https://ledgerflow-one-pearl.vercel.app** (Vercel login required for now: deployment protection).
- Set by Claude: `NODEJS_HELPERS=0`, `SESSION_SECRET`, `INVITE_SECRET`, `CRON_SECRET`, `SYSTEM_SALT`
  (random; generated in this session; replace SYSTEM_SALT before real data if wanted).
- Stripe / currency / tax keys are optional now (features say "not set up yet").
- The Claude Vercel connection can't link GitHub, read build logs or open the site (team scope);
  deploys are triggered by Claude directly from the branch.

## Your steps (about 5 minutes)
1. **Connect the database:** Vercel → project ledgerflow → **Storage** → Connect Database → pick the
   Supabase **ledgerflow** database → Connect (Production + Preview). This adds POSTGRES_URL,
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET. Then tell Claude → redeploy.
   Without it the API part of the site stops at startup ("database URL missing").
2. **Connect GitHub** (so pushes deploy by themselves): Settings → Git → Connect → shmuelbiller1/ledgerflow.
3. **Supabase sign-in URLs:** supabase.com → ledgerflow → Authentication → URL Configuration →
   Site URL `https://ledgerflow-one-pearl.vercel.app`; Redirect URLs add
   `https://ledgerflow-one-pearl.vercel.app/**` and `http://localhost:3000/**`.
4. Optional: re-authorize the Claude Vercel connection for the whole account ("shmuelbiller-1426's
   projects" scope) so Claude can read build/runtime logs and link GitHub itself.
5. Before real users: custom SMTP sender in Supabase (built-in one sends only a few emails/hour).
6. Leftover settings from the old example file (FIREBASE_PROJECT_ID, SQL_*, JWT_SECRET) are unused
   and can be deleted.

## Next after the deploy works
1. Smoke test on the live address: sign up, confirm email, create a workspace, invoice, report.
2. PROMPT K3 and PROMPT R (below) — now done by me directly.
3. Launch list as before (THE FASTEST WAY).

## Found during the migration (added to the tracker)
- L-81 **SECURITY** workspace restore (`POST /api/v1/workspaces/:id/restore`) writes backup rows by
  their own ids with merge: a crafted backup could overwrite another workspace's document with
  the same id. Fix: refuse ids that exist in another workspace (or re-key them).
- L-82 Remove the AI Studio "IAM" fallbacks left in server.ts (`isIamConstraintError`, 7 places)
  and billingRoutes (now dead code on Postgres).
- L-83 Database TLS: set `DATABASE_CA_CERT` (Supabase dashboard → Database → SSL certificate) so
  the server verifies the database certificate (today: encrypted, not verified).
- L-84 Custom SMTP sender before launch (see E).
- L-85 Two-step login management: show "on/off", remove an authenticator, recovery codes.
- L-86 Move `lf_ws_role`, `lf_mfa_ok`, `lf_assert_table` to a private schema (Supabase advisor
  warns they're callable; they only reveal the caller's own role / status).
- L-87 Large lists sort by `data->field` (jsonb), so the date indexes help filtering but not
  sorting; fine at launch sizes; revisit with C-14/C-15 (load per screen and by date).

# THE FASTEST WAY: 705 open items → about 12 prompts to launch

Counted from the list below (2026-09-24). Most of the 864 items came from comparing
LedgerFlow with 12 big open-source products, so they describe **everything any accounting
product has ever had**, not what your first customers need.

| Bucket | Open items | How it gets done |
|---|---|---|
| **LAUNCH**: needed before the first paying customers | **112** | ~11 big prompts (below) |
| **QUALITY**: `any`, big files, array keys, accessibility labels, component tests | **105** | one "before launch" batch, mostly by **tools** (eslint --fix, codemods, the Field layer, the registry test), not one by one |
| **LATER**: build only when a customer asks | **488** | not now. Kept as a backlog. When a customer asks for something, it becomes 1 prompt (often just config, once the engines exist) |

Biggest "later" groups: 32 extra ERP tools (CA) · 31 extra features (K) · 31 banking/contacts
extras (Y) · 30 API/integrations (Z) · 29 extra reports (CB) · 20 entities (M) · 16 industry
verticals (BI) · 16 invoice-ninja features (CC) · 14 enterprise SSO etc. (P) · payroll (U 11),
projects (V 9), fixed assets (X 9), inventory depth (W 8).

## The 11 launch prompts + 1 clean-up (in order; each closes 4–22 items)

| # | Prompt | Items |
|---|---|---|
| 1 | **K2** (ready): date bug, items on invoices, automatic COGS, Sales by Item, Journal Sheet | L-79 · W-03 · K-02 · M-01 · J-07 · J-12 |
| 2 | **Report shell** (shortcut 4 core): one shell with date presets, compare to previous period/year, cash/accrual, as-of, PDF + permalink; move existing reports onto it; `scaffold report <Name>` generator | N-01 N-02 N-06 N-08 N-09 N-11 · J-06 J-09 J-11 J-13 |
| 3 | **Credits, refunds, quick payment** (easy now that customer/vendor screens are shared) | K-09 K-10 BA-09 BA-10 BA-11 BA-12 BA-13 |
| 4 | **Banking**: payment reconciliation, split a bank line, match one line to many invoices, saved CSV column maps, bulk import, undeposited funds, feed re-auth | CA-01 CA-05 Y-03 Y-08 Y-09 Y-10 K-01 K-20 |
| 5 | **Period close**: checklist + sign-off, soft/hard close, lock by role, partial unlock, depreciation run, unposted drafts, repost ledger, bad debt | R-01 R-02 R-03 R-06 R-08 R-10 BA-15 CA-03 K-19 |
| 6 | **Notifications + email** (small event bus): invoice sent/overdue, payment received, bank feed down, invites, opt-out, bounces, send log, templates, reminders/dunning, payment links, recurring pause, PO → bill | S-01 S-03 S-04 S-06 S-14 S-19 · BL-01 BL-03 BL-05 BL-08 · K-08 K-11 K-26 · BE-01 BE-03 BE-11 |
| 7 | **Tax depth** (your market decides which): compound tax, tax groups, reverse charge, zero-rated vs exempt, return boxes, filed-return snapshot | T-01 T-02 T-03 T-04 T-06 T-07 |
| 8 | **Data-health checks** (shortcut 11): duplicate invoice/bill numbers, future-dated, empty invoices; deep links to any record | Z-07 Z-08 Z-10 Z-14 Z-32 |
| 9 | **Speed at scale**: load data per screen and by date, not everything at login | C-14 C-15 C-16 AA-06 |
| 10 | **Forms and screens users touch** (shortcut 7 Field layer + loading/error/empty states + money-modal tests) | I-01 I-02 I-03 I-07 I-08 I-12 · BO-03 BO-07 · E-02 E-03 E-04 E-07 E-22 E-23 E-27 E-29 · H-01…H-04 |
| 11 | **Trust & compliance**: backup restore test, retention, account deletion, GDPR export, error reporting, status page, i18n decision, onboarding, deposit rule, tax recompute `--apply`, dependency fixes | L-06…L-10 L-14 L-17 L-18 L-19 L-80 · BJ-04 BJ-06 BJ-08 BJ-09 · B-01 B-05 B-06 · AD-02 AE-04 AF-03 |
| 12 | **Before-launch clean-up** (tools do most): ESLint gate back on, `any` removal, protect `main` | QUALITY bucket + L-67 |

## Three more ways to go faster

1. **Chain prompts, and check with me less often.** GitHub shows a ✔ or ✖ next to each commit.
   If it's ✔, paste the next prompt straight away. Come back to me when it's ✖, or every 2–3
   prompts. I'll keep the next 2 prompts ready at the top of this file.
2. **Generators instead of AI-written boilerplate.** `scripts/scaffold.js` already creates
   plugins and algorithms. Prompt 2 adds `scaffold report <Name>` (view + pure function +
   test + registry entry), and later `scaffold entity <Name>` (the 7 places). Boilerplate
   then costs zero AI usage and never forgets a place.
3. **Optional: one AI instead of two plus a relay.** Right now it's you → Gemini in AI Studio
   (no git, can't run the rules or browser tests) → GitHub → me checking → next prompt. I can
   also make the changes directly in this repository, run all 7 checks including rules and
   E2E, and push. That removes the copy-paste and the "old copy" problems. The trade-off is
   that it uses your Claude usage instead of Gemini. Your choice. Staying as-is works fine too.

---

## The 15 shortcuts — status

| # | Shortcut | Status |
|---|---|---|
| 0a | CI running | ◐ build mode; only the new time-zone step is red, a real bug — PROMPT K2 Part 0 (tested) |
| 0b | Ratchet | ✔ all 10 numbers measured for real (incl. server.ts, untested views: 77) |
| 0c | AI endpoint | ✔ real AI, login first, workspace required, credits + refunds, no invented data, chat + blueprint |
| 1 | Customer/vendor mirrors | ◐ aging report shared; lists and detail pages separate (fine for now) |
| 2 | Document engine | ☐ |
| 3 | Entity framework | ◐ `defineEntity` exists, used by the registry; generates nothing yet |
| 4 | Report engine + shell | ◐ `PartyReportLayout` + report math in `computeReports.ts` with tests; next: one shared shell (compare, export, permalink) |
| 5 | Event bus | ☐ |
| 6 | `useCollection` data hook | ◐ 1 screen (Audit Log) |
| 7 | Field / SchemaForm | ◐ 1 screen (Chart of Accounts) |
| 8 | Registry smoke + accessibility | ✔ every view mounts and passes its accessibility limit |
| 9 | Delete / defer decisions | ⏸ **waiting for you** (~71 items) |
| 10 | Mechanical cleanup via ratchet | ◐ `any` 1,287 → **1,210** · UTC 40 · array keys 64 · console.log 8 · files > 800 lines 15 |
| 11 | Data-health checks registry | ☐ |
| 12 | Import adapter registry | ☐ |
| 13 | Money display | ✔ one rule (`formatCurrency` takes cents), guard test bans `/100` |
| 14 | Algorithm registry | ◐ **52 algorithms already registered** (I said 5 earlier — that was wrong) |
| 15 | AI-built tools | ✔ first slice done: rules builder safe, server rejects unknown categories, tested |

## The full list — 864 items

| Part of the list | Done | Partly | Total |
|---|---|---|---|
| Fixes & safety (A, B, C, AA–AI, L) | **144** | 4 | 172 |
| Code quality (D–I) | 6 | 4 | 143 |
| New features (J onward) | 10 | 3 | 549 |
| **All** | **160** | **11** | **864** |

```
PROMPT K3 — Finish K2: fix 2 one-line errors, automatic cost of goods sold, make the 2 new
reports correct and tested.
You are the one editing the code (AI Studio, no git). Do the parts in order.

BUILD MODE: only real safety checks block (type check, tests, build). ESLint warnings
don't. Don't add new `any` (the quality counter test fails on it).
CHECKS — light: while working, only the test file you changed
(npx tsx --test src/tests/<file>.test.ts). ONE full check at the very END, and it must pass:
  npm run lint:types && npm run build && npm test 2>&1 | grep -E "^# (tests|pass|fail)|not ok"
Fix a failure, then re-run only that check. Never `sleep`. Skip test:rules / test:e2e.
RULES: edit files as they are now · npm only · delete bun.lock if it's the only failure ·
never change existing tests' numbers · never raise quality-baseline.json · AGENTS.md: every
report filters with isPostable() and sums with lineAmount(); money via documentMath;
accounts via resolveAccountRole; show money with formatCurrency(cents), never /100.

===== PART 0 — CI is red (2 tiny fixes) =====
0a. src/components/reporting/SalesByItemReportView.tsx:3 — add `cn` to the import from
    '../../lib/utils' (it's used on line 136; without it the report crashes).
0b. src/components/reporting/JournalSheetReportView.tsx — `(tx: any)` (~line 83) and
    `(line: any, lIdx: number)` (~line 122): remove the `: any` (TypeScript infers the type).

===== PART A — finish items on invoice lines =====
A1. src/components/sales/InvoiceModal.tsx datalist option text (~line 415) shows a stray "$"
    and divides by 100. Make it:
      {i.sku ? `[${i.sku}] ` : ''}{i.name} · {formatCurrency(i.unitPriceCents)} · stock {i.quantityAtHand}
A2. Move the "picked an item → fill the line" logic into a pure function
    applyInventoryItem(line, item) in a new src/lib/invoiceLines.ts (sets itemId, rateCents,
    unitCostCents, amountCents = Math.round(quantity × unitPriceCents)) and call it from the
    modal. When the inventory list is empty, show "No items yet — add one in Inventory"
    under the field.
A3. Test src/tests/invoice-lines.test.ts: applyInventoryItem fills the line; a free-text
    line (no item) is unchanged; quantity 3 × 1250 → 3750.

===== PART B — automatic cost of goods sold (W-03) — unchanged from K2 =====
B1. src/server/routes/inventoryRoutes.ts POST /cogs (line 14): accept optional
    sourceInvoiceId and sourceLineId (zod) and store them on the ledger transaction as
    metadata.cogsForInvoiceId / metadata.cogsForLineId.
B2. New src/services/cogsService.ts → postInvoiceCogs(invoice, accounts, workspaceId):
    skip draft/void; for each line with itemId call POST /api/v1/inventory/cogs with header
    Idempotency-Key `${invoice.id}_${line.id}` and body { workspaceId, itemId, quantitySold:
    line.quantity, inventoryAccountId, cogsAccountId, date: invoice.date,
    sourceInvoiceId: invoice.id, sourceLineId: line.id }. Accounts: resolveAccountRole(a)
    === 'inventory' / 'cogs'. If either is missing, skip and show the toast "Add an Inventory
    and a Cost of Goods Sold account to record the cost of items sold". A non-whole
    quantity or a refused call ("Insufficient inventory stock") → don't block the invoice;
    set metadata.cogsPending = true on it. Call it in src/hooks/useEntityOperations.ts right
    after LedgerPostService.postInvoiceLedger(...) succeeds (lines ~114 and ~214).
B3. Invoices with metadata.cogsPending show a "Cost not recorded" badge in the invoice list
    with a "Retry" button (calls postInvoiceCogs again; clears the flag on success).
B4. Void: new POST /api/v1/inventory/cogs/reverse { workspaceId, invoiceId } in
    inventoryRoutes.ts (zod; owner/accountant/bookkeeper via getWorkspaceUserRole like
    paymentRoutes.ts). In ONE Firestore transaction: find the workspace's transactions with
    metadata.cogsForInvoiceId == invoiceId that aren't reversed yet, write a reversal for
    each (lines negated, metadata.reversesTxId) and add the quantity back to the item.
    A second call does nothing. Add the query's index to firestore.indexes.json. Call it
    from useEntityOperations when an invoice changes to 'void'.
B5. Tests (mock db like src/tests/payment-atomicity.test.ts): sell 3 at cost 400 → COGS
    +1200, inventory −1200, stock −3 · same key again → nothing new · reverse → reversed,
    stock +3, second reverse does nothing · no COGS account → skipped with the message ·
    not enough stock → cogsPending.

===== PART C — make the 2 reports correct + tested =====
C1. New src/server/reports/itemReports.ts:
    computeSalesByItem(invoices, items, transactions, start?, end?):
    - skip draft/void invoices; filter by invoice date
    - sales = toBaseCents(line.amountCents, inv.exchangeRate) (from partyReports.ts)
    - quantity as given (0 stays 0)
    - cost = the real COGS postings for that invoice line (transactions with
      metadata.cogsForInvoiceId / cogsForLineId, isPostable + lineAmount); if there are
      none yet, estimate quantity × unitCostCents and set costIsEstimate: true
    - lines without itemId → one "No item" row
    - returns rows (item, sku, qty, salesCents, costCents, marginCents, marginPct,
      costIsEstimate) + totals
C2. Same file: computeJournalSheet(transactions, accounts, start?, end?): keep only
    isPostable(tx) transactions (today drafts are counted); amounts via lineAmount(line, tx);
    returns one entry per transaction (date, description, lines with account name, debit,
    credit), totals, and the list of unbalanced ones.
C3. Both views call these functions (no math left in the screens). Sales by Item shows
    "(est.)" next to estimated costs. Use the theme colors other reports use (var(--surface),
    var(--line), var(--ink), …) instead of bg-white / text-neutral-*, so dark mode works.
C4. Test src/tests/item-reports.test.ts with every number checked by hand: 2 items + a
    "No item" line, one EUR invoice at 1.1, a draft and a void invoice (ignored), one line
    with real COGS postings and one estimated; a balanced journal, an unbalanced one, and a
    draft transaction that must not appear.

===== REPORT =====
The final check (type check, test count, build), then per part "done" or what's left.
```

### Ready after K3 — PROMPT R (report shell: launch prompt #2)

```
PROMPT R — One report shell: real dates, compare, permalink, print; plus a report generator.
You are the one editing the code (AI Studio, no git). Do the parts in order.
BUILD MODE: only real safety checks block (type check, tests, build). ESLint warnings
don't. Don't add new `any` (the quality counter test fails on it).
CHECKS — light: while working, only the test file you changed
(npx tsx --test src/tests/<file>.test.ts). ONE full check at the very END, and it must pass:
  npm run lint:types && npm run build && npm test 2>&1 | grep -E "^# (tests|pass|fail)|not ok"
Fix a failure, then re-run only that check. Never `sleep`. Skip test:rules / test:e2e.
RULES: edit files as they are now · npm only · delete bun.lock if it's the only failure ·
never change existing tests' numbers · never raise quality-baseline.json · AGENTS.md: every
report filters with isPostable() and sums with lineAmount(); show money with
formatCurrency(cents), never /100.


R1. Dates for every report: src/components/reporting/Reports.tsx already has a period picker
    (year / quarter / month, "timeframe"). Turn it into { startDate, endDate } in one pure
    function getReportPeriod(timeframe, year, quarter, month, fiscalYearStartMonth) in
    src/lib/fiscalCalendar.ts (fiscal-aware, reuse getFiscalYearBounds). Pass startDate,
    endDate and asOfDate (= endDate) in `standardProps` (Reports.tsx ~line 303) to every
    report. Reports that already accept startDate/endDate (SalesByItem, JournalSheet,
    Customer/Vendor summaries, Transactions by Customer/Vendor, Tax liability) use them.
R2. Compare to: none / previous period / same period last year (N-01, N-02). New pure
    function getComparePeriod(startDate, endDate, timeframe, mode) in fiscalCalendar.ts,
    calendar-aware: month → previous month, quarter → previous quarter, year → previous
    fiscal year, "last year" → same dates one year earlier. Don't use getPrevPeriod for this:
    it counts days, so the month before March comes out as Jan 29–Feb 28. Pass
    compareStartDate / compareEndDate in standardProps. P&L and Balance Sheet: when compare
    is on, add "Previous" and "Change" columns (amount and %), computed with the same
    functions they already use (computeProfitAndLoss / computeBalanceSheet in
    src/server/reports/computeReports.ts).
R3. Permalink (N-11, I-17): keep report tab, year, timeframe, quarter/month and compare in
    the URL query (e.g. ?report=pnl&y=2026&t=quarter&q=2&cmp=prev). Opening that link
    restores them.
R4. Print / PDF (N-06, I-18): a "Print / Save as PDF" button → window.print(), plus print CSS
    that hides the sidebar, navigation and buttons and prints the report title + period.
R5. Generator: extend scripts/scaffold.js with `report <Name>` that creates
    src/server/reports/<name>.ts (pure function stub), src/components/reporting/<Name>View.tsx
    (PartyReportLayout skeleton that calls it), src/tests/<name>-report.test.ts (a small
    passing test of the stub), and prints the 2 lines to add to REPORT_COMPONENTS and
    REPORT_TABS_REGISTRY. Add "scaffold:report": "node scripts/scaffold.js report" to package.json.
R6. Tests: getReportPeriod and getComparePeriod (month, quarter, year, last year, a fiscal
    year starting in April, February in a leap year); URL → state → URL round trip; P&L
    "Previous" numbers on a fixture spanning two years.
REPORT: the final check, then per part "done" or what's left.
```

**How to use it:** paste only the K3 box. When GitHub shows ✔ for it, you can paste PROMPT R
straight away without checking with me first. Come to me when it's ✖, or after R.

**Build mode** (decided 2026-09-24): type check, tests, build, rules and E2E block. ESLint
doesn't until launch.

**BEFORE LAUNCH (not now):** remove `continue-on-error` from the ESLint step and fix the
warnings: shared typed mock in `src/tests/helpers/mockFirestore.ts` for
`payment-atomicity` / `reconcile-endpoint` tests; `any` in `auditFormat.ts`, `server.ts`
writeAuditLog, `handleReconcile`. Then protect `main` (L-67).

**Not for your AI — for you (GitHub website):** the open dependency PRs — merge #25 (25 small
updates) once its CI is green; close #2 (`@types/node` 26 doesn't match Node 24); leave #3
(express) and #4 (plaid) for later. And protect `main` (L-67).

---

# EXACT TASK CARDS — what to do, file by file

Every card says **why**, **where** (file:line, checked against `origin/main` @ `2ae1baf`),
the **exact change**, and **done when** (a command and what it must print). Paste the
wrapper once, then 1–5 cards under it. Smaller prompts = fewer mistakes.

```
WRAPPER — paste at the top of every prompt
- FIRST: git pull origin main. Edit the files as they are now; never paste whole files
  from memory or an earlier conversation.
- npm only (never bun). Follow AGENTS.md: money through isPostable() / lineAmount() /
  documentMath; accounts via resolveAccountRole(); top-level collections + workspaceId.
- Never change a test's inputs or expected numbers. Never raise quality-baseline.json,
  --max-warnings or e2e/a11y-baseline.json.
- Do ONLY the cards below. `git diff --stat` must list only the files the cards name.
- Before pushing, run and paste the result of each:
  npm ci · npm run lint:types · npm run lint:eslint · npm test · npm run build ·
  npm run test:rules · npm run test:e2e
```

## Batch 1 — makes CI fully green ✔ DONE (7160b13 + 9f9c419)

**CARD 1.1 — Test helpers must set `createdAt`** (3 type errors)
- Where: `src/tests/fixtures.ts` — `makePayment` (line 56), `makeCreditNote` (74), `makeVendorCredit` (88).
- Change: in each of the three, add this line directly **above** `...overrides`:
  ```ts
      createdAt: '2026-01-01T00:00:00.000Z',
  ```
- Done when: `npm run lint:types` → no errors.

**CARD 1.2 — Remove the 34 `as any` casts from tests** (ESLint over the limit)
- Where: `src/tests/report-contract.test.ts` lines 22, 55, 195, 211, 227, 243, 253, 281, 294,
  306, 315, 319, 324 · `src/tests/reports-math.test.ts` lines 16, 21, 29, 34, 38, 63, 78, 82,
  86, 103, 106, 109, 122, 125, 128, 142, 146, 149, 160, 163 · `src/tests/document-math-tax.test.ts` line 158.
- Change: wrap every object in the matching helper from `src/tests/fixtures.ts`
  (`makeCustomer`, `makeVendor`, `makeInvoice`, `makeBill`, `makePayment`, `makeCreditNote`,
  `makeVendorCredit`, `makeChartAccount`, `makeTransaction`), give the array a real type, drop the cast:
  ```ts
  // before
  const mockCustomers = [
    { id: 'cust-1', name: 'Acme Corp', email: 'acme@example.com', phone: '555-0101' },
  ] as any[];
  // after
  const mockCustomers: Customer[] = [
    makeCustomer({ id: 'cust-1', name: 'Acme Corp', email: 'acme@example.com', phone: '555-0101' }),
  ];
  ```
  At the top of each test file add the imports it needs, e.g.
  `import { makeCustomer, makeInvoice, makePayment } from './fixtures';` and
  `import type { Customer, Invoice, Payment } from '../types';`.
  `document-math-tax.test.ts:158`: the literal has `totalCents`, a field Invoice dropped on
  purpose and nothing reads. Pass `makeInvoice({ id: invoice.id, date: invoice.date,
  amountCents: invoice.amountCents, salesTaxCents: invoice.salesTaxCents, status: invoice.status })`.
  Same values, same expected numbers.
- Done when: `grep -c "as any" <each file>` → 0 · `npm test` → all pass.

**CARD 1.3 — Saved-view chip: no button inside a button** (Overview accessibility)
- Where: `src/components/ui/SavedViewsBar.tsx` lines 84–138.
- Change (3 edits):
  1. On the outer `<div key={view.id}` delete `role="button"`, `tabIndex={0}`, `onClick={...}`
     and the whole `onKeyDown={...}` block. Keep its `className`.
  2. Right after that div's opening `>`, open a real button around the icon + text:
     ```tsx
     <button
       type="button"
       aria-pressed={isActive}
       onClick={() => setActiveView(isActive ? null : view.id)}
       className="flex items-center gap-2 text-left"
     >
     ```
  3. Close it with `</button>` just before the existing star `<button type="button"` — so the
     star button becomes a sibling, not a child.
- Done when: `npm run test:e2e` → "Navigate and mount view: Overview" passes.

**CARD 1.4 — Lower the warning limit**
- Where: `package.json` line 16 (`"lint:eslint": "eslint . --max-warnings 2816"`).
- Change: after 1.2 and 1.3, run `npx eslint . 2>&1 | tail -1`, put that number in place
  of 2816 (it must be ≤ 2808), then run `npm run ratchet:update`.
- Done when: `npm run lint:eslint` passes; both GitHub CI jobs green.

## Batch 6 — ✔ DONE in cdd1f46 (leftovers moved into Prompt L Part 2)

**CARD 6.1 — Remove the unused endpoint** (fixes both CI failures)
- Where: `src/server/routes/transactionRoutes.ts` — delete the whole
  `transactionRouter.post('/bank-lines/:id/unmatch', …)` block added in `5119ad2`, and its
  `import { requireWorkspaceRole } from './workspaceRoutes';` line if 6.2 doesn't use it.
- Done when: `npm run lint:eslint` passes (≤ 2803) and `npm test` → 324/324.

**CARD 6.2 — Harden the real reconcile endpoint** (`transactionRoutes.ts:657`, `POST /reconcile`)
- a. Role: add `requireWorkspaceRole(['owner', 'accountant', 'bookkeeper'])` as middleware
  (import from `./workspaceRoutes`) — viewers get 403.
- b. Locked period: after loading each bank line and transaction the operations touch, if
  its `date` is on or before the workspace `lockDate`, return
  `400 { error: 'This period is locked' }` and write nothing.
- c. Audit: in the same batch, write one `auditLogs` entry per call with the standard fields
  `{ workspaceId, uid, action: 'reconcile' (or 'reconcile_undo' when a line goes back to
  pending), details, severity: 'info', timestamp }` — the fields `AuditLogViewer` reads.
- d. Types: use the existing authenticated-request type instead of `(req as any)`, and
  `catch (e)` with `e instanceof Error ? e.message : String(e)` — no new `any`.
- e. Tests (new `src/tests/reconcile-endpoint.test.ts` or the existing route tests):
  viewer → 403 · line dated inside a locked period → 400 · undo sets the bank line to
  `pending` + `matchedTransactionId: null` **and** the transaction back to `completed` ·
  one audit entry written.
- Done when: all 7 checks pass.

**CARD 6.3 — One local-date helper**
- `src/lib/utils.ts`: keep `getLocalDateISO` (line 142 — follows the workspace timezone).
  Replace every `getLocalDateIso` import/call with `getLocalDateISO` in: `sales/Sales.tsx`,
  `platform/settings/BackupExportSettings.tsx`, `platform/ToolSandbox.tsx`,
  `hr/PayrollView.tsx`, `banking/TransferModal.tsx`, `lib/paymentTerms.ts`,
  `lib/depreciationEngine.ts`, `lib/estimateConverter.ts`, `lib/creditNoteEngine.ts`.
  Then delete `getLocalDateIso` (line 397).
- Watch out: `src/lib/*` files are also used on the server, where there is no signed-in
  workspace — `getLocalDateISO` falls back to UTC there; pass the workspace timezone in
  from the caller when it's known (`formatTzDate(d, workspace.timezone)`).
- Done when: `grep -rn "getLocalDateIso" src` → nothing; all tests pass.

## Batch 2 — dates (now Prompt L Part 3, with updated line numbers)

`toISOString().slice(0,10)` is the UTC date: in the evening in the Americas it is already
"tomorrow". Browser code: use `getLocalDateISO()` from `src/lib/utils.ts` (it reads the
workspace timezone). Server code: load the workspace and use
`formatTzDate(new Date(), workspace.timezone)` from the same file.

**CARD 2.1 — Default dates on money documents (these change what gets posted)**
- ✔ done in 5119ad2: `Sales.tsx:105`, `TransferModal.tsx:46`, `PayrollView.tsx:48` (switch them to `getLocalDateISO` in CARD 6.3)
- `src/server/routes/paymentRoutes.ts:17` — payment date default (server)
- `src/server/routes/documentRoutes.ts:71` — document date (server)
- `src/server/services/pdfService.ts:13` — date printed on PDFs when missing (server)
- `src/server/reports/partyReports.ts:29` and `:109` — default report end date
- Done when: `grep -rnE "toISOString\(\)\.(slice\(0, ?10\)|split\('T'\)\[0\]|substring\(0, ?10\))"`
  no longer lists these files; add one test with `TZ=America/Los_Angeles` at 20:00 local that
  expects today's local date.

**CARD 2.2 — Parsing and helpers**
- `src/components/ledger/StatementImporter.tsx:199` and `src/lib/camt053Parser.ts:24` —
  imported bank dates must keep the date printed on the statement (parse `YYYY-MM-DD` as
  text; never go through `new Date(...).toISOString()`).
- `src/hooks/useLedgerData.ts:278`, `src/lib/trialManager.ts:11`,
  `src/lib/algorithms/expense-velocity.ts:92`, `src/lib/excelExport.ts:71` → `getLocalDateISO(d)`.
- Leave `src/lib/utils.ts:417` (it's the fallback inside `formatTzDate`).

**CARD 2.3 — Export file names (cosmetic, 9 files)**
`ForensicAuditor.tsx:105`, `QueryView.tsx:144`, `AuditTrailView.tsx:117`,
`MonthEndCloseView.tsx:253`, `PivotSheet.tsx:386`, `CustomerBalanceSummaryView.tsx:61`,
`VendorBalanceSummaryView.tsx:61`, `TransactionsByCustomerView.tsx:86`,
`TransactionsByVendorView.tsx:86` → `getLocalDateISO()` in the file name.
- Done when (after 2.1–2.3): `npm run ratchet:update` lowers `utcDateCount`.

## Batch 3 — small safety items (3.1–3.3 now Prompt L Part 4; 3.4 is for you on GitHub)

**CARD 3.1 — Server logging (L-12, L-13)**
- Create `src/server/utils/logger.ts` exporting `logger.info / warn / error(message, fields)`
  that prints one JSON line (`{ level, time, msg, ...fields }`).
- Replace the 8 `console.log` in `server.ts` (lines 880, 932, 936, 4526, 4543, 4558, 4568,
  4575) with `logger.info(...)`, keeping the same text as `msg` and ids as fields.
- Done when: `grep -c "console.log(" server.ts` → 0; ratchet `consoleLog` goes to 0.

**CARD 3.2 — Timers without cleanup (AD-01, AD-02)**
Check each `setTimeout` inside a `useEffect`; if the effect doesn't `return () => clearTimeout(t)`,
switch to the existing `useTimeout` hook (already used 24 times):
`platform/ConnectionBanner.tsx:19`, `platform/ApiHub.tsx:310`,
`platform/SystemCommandCenter.tsx:368`, `ledger/MagicEntry.tsx:33`,
`system/HealthCheckModal.tsx:34` and `:37`, `forensics/LedgerAutoAuditor.tsx:14`.
(The `await new Promise(r => setTimeout(r, …))` delays and `PdfPreviewModal.tsx:58` are fine.)
- Done when: no `setTimeout` in a `useEffect` without cleanup; add an ESLint
  `no-restricted-syntax` rule or a guard test that flags it (AD-02).

**CARD 3.3 — Time-zone test run in CI (L-05)**
- Where: `.github/workflows/ci.yml`, after the "Run Accounting & Security Test Suites" step.
- Add:
  ```yaml
      - name: Unit tests in two other time zones
        run: |
          TZ=Pacific/Auckland npm test
          TZ=America/Los_Angeles npm test
  ```
- Done when: both runs pass on GitHub.

**CARD 3.4 — Dependency updates (L-06)** — 4 open dependabot PRs
- #25 "bump the all group … 25 updates" — merge after CI is green on it.
- #2 `@types/node` 22 → 26 — close: types should match the Node you run (24).
- #3 `express` major and #4 `plaid` 42 → 47 — breaking; leave until a feature needs them.

## Batch 4 — tax edge cases (AE-04, AF-03, AF-04)

**CARD 4.1 — Tie-out fixture (AF-04)**: in `src/tests/document-math-tax.test.ts` add one
invoice with discount + retainage + tax-exclusive + EUR at 1.1; assert that
`calculateDocumentTax` (posting side) equals the Sales Tax report
(`computeTaxLiability`) and that the posted lines balance.

**CARD 4.2 — Decide `depositCents` (AF-03)** — your decision: is a deposit subtracted
before tax (it reduces the taxable amount) or after (it's a payment)? Normal practice: a
deposit is a **payment in advance**, so tax is on the full amount and the deposit reduces
the amount due only. Put that rule in `src/lib/documentMath.ts` with a comment and a test.

**CARD 4.3 — Recompute old tax (AE-04)**: `scripts/recompute-document-tax.ts`, run by hand:
lists every posted invoice/bill whose stored tax ≠ `calculateDocumentTax(doc)`, prints them,
changes nothing unless run with `--apply` (which posts an adjusting entry through
`LedgerPostService`, never edits the old entry). Dry-run by default.

## Batch 5 — bigger items (one card per prompt)

| Card | What | Where to start | Done when |
|---|---|---|---|
| 5.1 C-14 / C-15 / AA-06 | Stop loading everything at login; load by screen and by date | move listeners from `src/hooks/useLedgerData.ts` into screens via `src/hooks/useCollection.ts`, one screen per commit; invoices/bills/payments/bankLines/auditLogs get a `dateWindow` (default: current fiscal year) | login loads only workspaces + accounts + settings; truncation banner still works |
| 5.2 C-16 | Reference data read once, not live | chartAccounts, taxRates, currencies via one-shot `getDocs` in `useCollection({ live:false })` | fewer listeners in `useLedgerData.ts` |
| 5.3 C-17 | Firestore read counter in dev | wrap `onSnapshot` / `getDocs` in `useCollection` and count `docs.length`; show it in the dev status bar | number visible in dev, hidden in production |
| 5.4 C-20 | Load test | script that seeds 200k transactions into the emulator; record time-to-dashboard and reads | numbers written to `docs/perf.md` |
| 5.5 L-07 | Backup can really be restored | test: export a seeded workspace (`/api/v1/workspaces/:id/export`), restore into a new one (`/:id/restore`), compare trial balances | test in CI passes |
| 5.6 L-18 | Hebrew | `useUIStore.language` exists and registry labels have `he` — decide: finish (wrap remaining text) or remove the toggle | one clear state, no half-translated screens |

Prompt K (below, in NOW) is already written this way for the next features.

---

# FILE MAP — which files each kind of change touches

Paste the matching recipe into any prompt. It tells the AI exactly where to work, which
existing helpers to reuse, and which guard test will catch a mistake. All paths checked
against `origin/main` @ `4c712ee`.

## The files everything depends on

| File | Lines | What it's for | Rule |
|---|---|---|---|
| `src/types.ts` | 1,121 | every data type | single source of truth; new fields optional |
| `src/schemas.ts` | 504 | zod schemas, checked on the server | every new field goes here too |
| `src/constants/collections.ts` | 42 | `WORKSPACE_SCOPED_COLLECTIONS` | a new collection must be listed |
| `firestore.rules` | 526 | security rules | one `match` block per collection |
| `firestore.indexes.json` | 146 | query indexes | one index per where + orderBy shape |
| `src/config/registry.tsx` | 390 | every screen, report, setting | nothing shows until registered |
| `src/lib/txFilters.ts` | 391 | `isPostable()`, `lineAmount()`, `isOpenInvoice/Bill` | all money sums |
| `src/lib/documentMath.ts` | 88 | tax, net, `calculateAmountDue` | the only document money math |
| `src/lib/accountUtils.ts` | 62 | `resolveAccountRole()` (incl. `fx_rounding`) | never a literal account id |
| `src/lib/utils.ts` | 420 | `formatCurrency(cents)` — takes **cents** | never divide by 100 first |
| `src/components/ui/Money.tsx` | 58 | `<Money cents>` | preferred money display |
| `src/lib/fiscalCalendar.ts` | 143 | `getFiscalYearBounds` | default date ranges |
| `src/services/LedgerPostService.ts` | 1,060 | the one posting path → `/api/v1/transactions/bulk` | all postings |
| `src/kernel/ledger/LedgerEngine.ts` | 280 | FX conversion + balancing | |
| `src/hooks/useEntityOperations.ts` | 274 | `addEntity` / `updateEntity` (documents post through LedgerPostService) | use for CRUD |
| `src/hooks/useCollection.ts` | 147 | per-screen data loading | new screens load their own data |
| `src/hooks/useLedgerData.ts` | 598 | listeners loaded at login | don't add more; use `useCollection` |
| `src/hooks/useCurrentRole.ts` | — | role for hiding UI | pair with server/rules checks |
| `src/server/db/firestore.ts` | — | `validateWorkspaceMember` | every server route |
| `server.ts` | ~4,720 | server entry; routers mounted ~lines 4490–4521 | no new routes here (lint rule) |

## Recipes

**Add a report**
1. `src/components/reporting/<Name>View.tsx` on `PartyReportLayout.tsx` (later: the report shell).
2. Money: ledger lines → `isPostable` + `lineAmount`; documents → `calculateAmountDue`; show with `formatCurrency(cents)` / `<Money>`.
3. Register in `src/config/registry.tsx`: `REPORT_COMPONENTS` (lazy import) + `REPORT_TABS_REGISTRY` (id, en + he label, componentName, icon).
4. Test with a fixture in `src/tests/<name>-report.test.ts`. Screen mounting and accessibility are covered automatically by `e2e/view-registry-coverage.spec.ts`.
Guards: `postable-adoption-guard`, `money-format-guard`, `report-contract`, `reachability-guard`.

**Add a screen**
1. `src/components/<area>/<Name>.tsx`; loading/empty/error with `src/components/ui/EmptyState.tsx` (crashes are caught by `ViewErrorBoundary` automatically).
2. Register `VIEW_COMPONENTS` + `APP_TABS` (settings: `SETTINGS_COMPONENTS` + `SETTINGS_TABS_REGISTRY`).
3. Hide actions by role with `useCurrentRole` / `src/components/ui/RequireRole.tsx` — and enforce the same on the server/rules.
4. Add the view to `e2e/a11y-baseline.json`.

**Add a new kind of record (collection) — the 7 places**
Missing one of these caused the customers lockout and the missing-index bug.
1. `src/types.ts` — interface.
2. `src/schemas.ts` — zod schema, `.strict()`.
3. `src/constants/collections.ts` — add to `WORKSPACE_SCOPED_COLLECTIONS`.
4. `firestore.rules` — read: member · create/update: `canWrite` + `isValidId` + `affectedKeys([...schema keys])` · delete: draft only.
5. `firestore.indexes.json` — every query shape.
6. Loading: `useCollection` inside the screen (only if truly global: `useLedgerData.ts` — the rules-coverage guard checks both lists match).
7. `src/tests/rules/firestore.rules.test.ts` — add it to the collection table (owner can, viewer can't, other workspace can't).
Always top-level with `workspaceId`, never a subcollection.
Guards: `rules-coverage-guard`, `index-guard`, `schema-drift`, `validation-guard`.

**Add a field to an existing record**
`src/types.ts` (optional) → `src/schemas.ts` → that collection's `affectedKeys([...])` in `firestore.rules` → the form (`InvoiceModal.tsx`, `BillModal.tsx`, …) → `schema-drift` test.

**Add a server endpoint**
1. `src/server/routes/<area>Routes.ts` (`express.Router()`), body validated with zod (the `validation-guard` fails otherwise).
2. Login + `validateWorkspaceMember` + role check.
3. Mount in `server.ts` next to the others (~4490–4521).
4. Browser `fetch('/api/v1/…')` — the `route-contract` test fails if there's no matching route.
5. Money changes go through the ledger (transactions bulk), never by writing balances.

**Add an AI task**
1. `src/server/routes/aiRoutes.ts` — add to `AiTaskEnum` and `TASK_WEIGHTS`.
2. `src/server/services/aiBackendService.ts` — a `case` using `responseMimeType: 'application/json'` + `responseSchema`; on failure **throw**, never a made-up answer.
3. `src/services/aiService.ts` — the browser call. The task-list test fails if the lists differ.
4. Send field names and the user's words — never transaction descriptions or vendor names as instructions.

**Add a calculation (AGENTS.md pattern)**
`src/lib/algorithms/<name>.ts` implementing `AlgorithmDefinition` (`src/lib/algorithms/types.ts`) → register in `FINANCIAL_ALGORITHMS` (`src/lib/algorithms/index.ts`, 52 already) → `src/components/platform/ToolSandbox.tsx` builds the screen. No UI work.

**Post money**
Lines: debits positive, credits negative, sum 0 → `LedgerPostService` → `/api/v1/transactions/bulk`. Accounts via `resolveAccountRole`. Period lock is checked by `verifyLockDate` and the rules. FX via `LedgerEngine`.

**Show money**
`formatCurrency(cents)` or `<Money cents={…}/>`. Never `/100` in the UI (`(cents/100).toFixed(2)` only inside CSV text).

## Files per shortcut

| # | Shortcut | Build on (existing files) | Create | Register / guard |
|---|---|---|---|---|
| 1 | Customer/vendor mirrors | `sales/Sales.tsx`, `purchases/Purchases.tsx`, `sales/CustomerDetailView.tsx`, `purchases/VendorDetailView.tsx`, `sales/CustomerModal.tsx`, `purchases/VendorModal.tsx`, `reporting/PartyAgingReportView.tsx` (already shared), `src/config/partySides.ts`, `src/lib/creditNoteEngine.ts` | `common/PartyListView.tsx`, props `side` | `party-actions.test.ts` must stay green |
| 2 | Document engine | `src/lib/documentMath.ts`, `src/server/routes/documentRoutes.ts` (108, if/else chain), `src/server/services/pdfService.ts`, `sales/InvoiceModal.tsx` (629), `purchases/BillModal.tsx` (442), `sales/EstimatesView.tsx`, `purchases/PurchaseOrdersView.tsx`, `finance/CreditNotesView.tsx`, `ui/PdfPreviewModal.tsx`, `LedgerPostService.ts` | `src/config/documents.ts` (`defineDocument`), `common/DocumentEditor.tsx` | documentRoutes becomes a lookup by type |
| 3 | Entity framework | `src/lib/entityFramework.ts` (61, used by registry), `schemas.ts`, `collections.ts`, `common/SchemaForm.tsx`, `ui/TanStackDataGrid.tsx` | `scripts/gen-firestore.ts` — writes rules + index blocks between marker comments | test: regenerating gives no diff |
| 4 | Report engine | `reporting/PartyReportLayout.tsx` (166), the 4 new reports, `src/server/reports/computeReports.ts`, `src/lib/reportGenerators.ts` (370), `src/lib/excelExport.ts`, `ledger/PivotSheet.tsx`, `src/lib/TransactionQueryEngine.ts` (638); **18 screens each hand-build a CSV export** (search `text/csv`) | `src/lib/reports/defineReport.ts`, one `ReportShell` (dates, compare, export, print, permalink), one shared CSV helper | `REPORT_TABS_REGISTRY` |
| 5 | Event bus | `LedgerPostService.ts`, `useEntityOperations.ts`; audit-log writes in `server.ts`, `src/server/routes/transactionRoutes.ts`, `src/hooks/useLedgerData.ts`, `src/hooks/useTransactionActions.ts`; `src/stores/useNotificationStore.ts` (130); `src/server/services/emailService.ts` | `src/server/events/bus.ts` + subscribers (audit, notifications, webhooks, email) | one audit subscriber replaces the hand-written writes |
| 6 | Data hook | `src/hooks/useCollection.ts` (used by `admin/AuditLogViewer.tsx`), `src/hooks/useLedgerData.ts` (598) | — | one screen per commit; keep truncation flags |
| 7 | Forms | `common/Field.tsx`, `common/SchemaForm.tsx` (used by `ledger/ChartOfAccountsView.tsx`) | — | move one modal per commit; a11y baseline goes down |
| 8 | Registry tests | `e2e/view-registry-coverage.spec.ts`, `e2e/a11y-baseline.json` | a `help` field on registry entries | lower the baseline as screens are fixed |
| 10 | Ratchet | `scripts/quality-metrics.ts`, `quality-baseline.json`, `src/tests/quality-ratchet.test.ts` | — | `npm run ratchet:update` after every cleanup |
| 11 | Data-health checks | `src/modules/integrity/TruthEngine.ts`, `system/DataHealthView.tsx` (316), `ledger/MonthEndCloseView.tsx` | `src/lib/checks/defineCheck.ts` + one file per check | DataHealthView lists the registry |
| 12 | Importers | `src/lib/mt940Parser.ts`, `src/lib/camt053Parser.ts`, `ledger/StatementImporter.tsx` (667), `src/lib/ofx-exporter.ts` | `src/lib/importers/defineImporter.ts` | one wizard for every format |
| 13 | Money display | `src/lib/utils.ts` `formatCurrency`, `ui/Money.tsx`, `money-format-guard.test.ts` | — | banned: `formatCurrency(x / 100)` |
| 14 | Algorithms | `src/lib/algorithms/*` (52 registered), `platform/ToolSandbox.tsx` | one file per algorithm | `FINANCIAL_ALGORITHMS` |
| 15 | AI-built tools | `aiRoutes.ts`, `aiBackendService.ts`, `src/lib/rulesEngine.ts` (`dryRunRules`), `platform/settings/RulesSettings.tsx`, `AutoRuleSchema` in `schemas.ts` | per new kind: schema + server check + dry run | task-list test |

(Component paths above are under `src/components/`.)

---

# LEDGERFLOW — THE SHORT WAY

**723 open items → 14 build-once shortcuts + 179 individual items.**
Every number below was produced by a script run against `origin/main` @ `936add6`.

```
 418  absorbed by 13 build-once shortcuts   (each item becomes ~20–80 lines of config)
  71  removed — delete unused code, or decide not to build
  55  duplicates — the same work listed twice across sweeps
 179  remain individual — and most get cheaper once the shortcuts exist
```

## The idea in one paragraph

`AGENTS.md` already describes the right pattern for **algorithms**: write the math once,
register it in `FINANCIAL_ALGORITHMS`, and `ToolSandbox` generates the UI automatically.
That is why algorithms are cheap to add here. Nothing else in the codebase works that way.
Every entity, document, report, check, importer and notification is hand-built across 5–8
files, which is why each one costs a week and why the same bugs keep coming back
(customers lockout, missing index, orphaned modules). **Apply the pattern AGENTS.md
already uses for algorithms to everything else.** Then new capability costs config, not
code — and the bug classes disappear because nobody hand-writes the wiring any more.

## What the code shows (measured)

| Finding | Number |
|---|---|
| `Sales.tsx` vs `Purchases.tsx` | **61% identical** after swapping customer↔vendor |
| `ARAgingReportView` vs `APAgingReportView` | **70% identical** |
| `CustomerDetailView` vs `VendorDetailView` | **78% identical** |
| `InvoiceModal` + `BillModal` + `JournalEntryModal` + `TransactionEditModal` | **2,529 lines**, four separate line-item editors |
| 6 financial statement views | **3,438 lines**; every report builds its own table and export |
| `documentRoutes.ts` | an `if (type === 'invoice') … else if …` chain, not a lookup |
| Audit-log writes | **13 hand-written** across 8 files; no event bus exists |
| `useLedgerData.ts` | **24 listeners** in one hook, loaded on login for every view |
| `src/components/platform/` | **10,945 lines** — nearly as big as the accounting core (`ledger/`, 12,274) |
| `SystemCommandCenter.tsx` | 1,783 lines, runs on `simulatedQueries` / `simulatedLogs` |
| `eslint-plugin-react` | not installed — so `no-array-index-key` and `jsx-no-target-blank` can't run |

The sales/purchases mirroring matters most: **every feature on one side has to be built
twice.** Credit notes and vendor credits, customer and vendor balance summaries,
transactions by customer and by vendor, sales and purchases by item — they're all pairs.

---

# STEP 0 — PREREQUISITES (do these before any shortcut)

**0a. The CI fix from the last answer.** Every shortcut below is a refactor. A refactor
without CI running is how the customers-lockout class of bug ships. Finish the four
lockfile steps first.

**0b. THE RATCHET — this is how "over time everything gets better".**

One test, one baseline file. Each commit may keep or improve every quality number, never
worsen it. You don't schedule a big cleanup; the numbers only go down, a little at a time,
whenever the AI touches a file.

```
Build a quality ratchet.

1. scripts/quality-metrics.ts — computes and prints a JSON object:
     anyCount            occurrences of `: any` / `as any` / `<any>` in src + server.ts
     utcDateCount        toISOString().slice(0,10) / .split('T')[0] outside tests
     arrayIndexKeys      key={i} | key={idx} | key={index} in src/components
     blankNoOpener       target="_blank" without rel noopener
     consoleLog          console.log in server code
     serverTsLines       wc -l server.ts
     filesOver800        source files over 800 lines
     orphanFiles         result of the reachability walk
     eslintWarnings      total eslint warnings
     untestedViews       registered views not covered by the registry smoke test
2. quality-baseline.json — commit the current values.
3. src/tests/quality-ratchet.test.ts — runs the metrics and FAILS if any value is
   greater than its baseline. Print exactly which metric got worse and by how much.
4. npm script `ratchet:update` — rewrites the baseline only for metrics that went DOWN.
   It must never raise a baseline.
5. Install eslint-plugin-react and enable react/no-array-index-key and
   react/jsx-no-target-blank (the latter has an autofix — run `eslint --fix` once,
   that closes B-09 immediately). Enable eslint `max-lines` at 800 as a warning.
6. Add the ratchet test to CI.

From then on the AI's standing instruction is: "leave every file you touch with fewer
violations than you found it, then run ratchet:update". The 57 items in shortcut 10
below get done that way, gradually, instead of as a project.
```

**0c. RESTORE THE AI ENDPOINT — every AI feature is currently broken (found 2026-09-22).**

Commit `ca8b675` (2026-09-16, "feat: add document generation and MFA enrollment")
deleted the `POST /api/ai/process` handler from `server.ts` (191 lines: auth, workspace
check, PII scrubbing, credit charging) **and** the whole `src/services/aiBackendService.ts`
(533 lines, 9 tasks). Nothing replaced them. The browser still calls `/api/ai/process`
from `aiService.ts:20` and `Copilot.tsx:123`, so Copilot, receipt scan, statement import,
Magic Entry, the AI blueprint and the AI command center all get an error and fall back.
No test caught it because `e2e/smoke.spec.ts:80` **mocks** that URL.

A scan of all 86 API paths the browser calls against all server routes found this is the
only real missing endpoint.

```
PROMPT 0c — Restore the AI endpoint and stop this class of bug.

1. Restore src/services/aiBackendService.ts from commit ca8b675^ :
     git show ca8b675^:src/services/aiBackendService.ts > src/services/aiBackendService.ts
   Move it to src/server/services/ if that is where server-only code lives now.
2. Restore the POST /api/ai/process handler from ca8b675^:server.ts (around line 1031)
   — but as a router file src/server/routes/aiRoutes.ts mounted in server.ts, not back
   into server.ts. Keep every check it had: authenticate, authorizeWorkspace, credit
   balance check, SecurityService.scrubPII on chat input, credit charging via
   FieldValue.increment. Validate the body with zod (task must be one of the 9 known
   task names; unknown task → 400).
3. Add src/tests/route-contract.test.ts: collect every '/api/...' string used in src
   (outside src/server) and fail if any has no matching server route (mount prefix +
   router path, :params as wildcards, array paths expanded). Allow-list only strings
   that are display text, with a comment saying why.
4. In e2e/smoke.spec.ts keep the mock if you need it for speed, but add one test that
   calls /api/ai/process WITHOUT the mock and expects 401 (unauthenticated), not 404.
5. Run tsc, the full test suite, and the reachability guard.
```

---

# THE 14 SHORTCUTS

Each one lists what already exists to build on, what to build, and which backlog items
it closes. Item IDs refer to the tracker further down this file.

## 1 · Collapse the customer/vendor mirrors — closes 13, deletes ~900 lines

**Build on:** `Sales.tsx`, `Purchases.tsx`, `CustomerDetailView`, `VendorDetailView`,
AR/AP aging views, `creditNoteEngine.ts` (`applyCreditNoteToInvoice` /
`applyVendorCreditToBill` are already mirrored functions).

**Build:** a `PartySide` config — `{ side: 'customer' | 'vendor', party collection,
document collection, credit collection, control account role, labels }` — and one
component per screen that takes it: `PartyListView`, `PartyDetailView`, `AgingReportView`,
`PartyModal`. Delete the duplicated half of each pair.

**Closes:** BA-02 · BA-10 · BA-11 · BA-12 · BA-13 · K-09 · K-10 · E-11 · E-12 · H-05 ·
H-06 · H-09 · H-10. **And every future paired item costs half** — J-01/02, J-04/05,
J-07/08, CB-01/02, CB-10/11, CB-12/13.

**Risk:** low. Pure refactor, no data change. Do it first among the shortcuts.

## 2 · One document engine — closes 39

**Build on:** `documentMath.ts` (the math is already shared), `documentRoutes.ts`,
`pdfService.ts`, `InvoiceModal`/`BillModal`, the numbering-series allocator,
`LedgerPostService`.

**Build:** `defineDocument({ type, collection, side, lineShape, statuses, numberingPrefix,
posts: postingFn | null, convertsTo: [...] })` in a registry, one `DocumentEditor`, one
server router built from the registry (replacing the `if/else` chain with a lookup).
Every document type then gets, for free: PDF + preview · numbering dialog · attachments ·
email with templates · per-recipient links with view tracking · watermark · page numbers ·
recurring · approval · convert-to · void-not-delete · period lock.

**Closes:** M-02 sales orders · M-03 sale receipts · M-04 manual journals · M-05 email
templates · M-09 attachments · M-12 delivery notes · M-16 requisitions · K-03 · K-04 ·
K-05 · K-07 · K-08 · CC-01 · CC-03 proposals · CC-04 · CC-05 · CA-30 · BE-03 · BE-04 ·
BE-05 · BE-08 · BE-11 · BA-07 · BA-08 · BF-06 · BF-07 · Y-16 · Y-17 · BL-05 · BL-06 ·
BL-07 · S-02 · E-08 · E-09 · E-15 · E-16 · E-17 · H-01 · H-02.

A sales order becomes ~40 lines: `defineDocument({ type:'salesOrder', side:'customer',
posts: null, convertsTo:['invoice'] })`. Today it would be ~1,500 lines across 7 files.

## 3 · Entity framework (config → type, rules, indexes, subscription, UI) — closes 73

**This one also ends a bug class.** The customers lockout, the missing `creditNotes`
index and the orphaned `creditNoteEngine` all came from hand-wiring the same five things.

**Build on:** `src/schemas.ts` (33 zod objects already), `WORKSPACE_SCOPED_COLLECTIONS`,
`TanStackDataGrid`, `RadixModal`, the rules-coverage and index guards.

**Build:** `defineEntity({ name, collection, schema: zodObject, indexes, listColumns,
permissions })`. From that one definition:
- the TypeScript type (`z.infer`) — no hand-written interface, no `any`
- the list view and the form (via shortcut 7, accessible by default)
- the `useCollection` subscription (via shortcut 6)
- the `firestore.rules` block with `affectedKeys()` taken from the schema's keys
- the `firestore.indexes.json` entries
- a rules-test row (owner can, viewer cannot, other workspace cannot)

Rules and indexes can't be generated at runtime, so generate them with
`npm run gen:firestore`, commit the output between marker comments, and add a test that
fails if regenerating produces a diff. Follow `AGENTS.md`: top-level collections scoped by
`workspaceId`, never subcollections.

**Closes:** M-01 items · M-06 exchange rates · M-07 · M-08 · M-10 · M-11 · M-13 · M-14 ·
M-20 · K-02 · K-12 · K-14 · K-15 · K-21 · K-29 · K-33 · CC-06..CC-11 · CG-01..CG-04 ·
CG-06 · CD-06 · CD-07 · CF-01 · CF-02 · CF-04..CF-08 · CE-01 · CE-08 · V-02 · V-03 · V-05 ·
Y-21..Y-28 · Y-30 · Y-31 · Y-34 · Y-35 · BB-01..BB-09 · BA-05 · BA-06 · BF-01..BF-03 ·
BF-09 · CA-28 · CA-29 · E-18 · A-14 · A-15 · BM-06 — **73 items**.

## 4 · Report engine + one shell — closes 89 (the biggest)

**Build on:** `computeReports.ts`, `reportGenerators.ts`, `documentMath.ts`,
`PivotSheet.tsx` (754 lines, already a generic pivot), `TransactionQueryEngine.ts`,
`src/lib/exportUtils`, `pdfService`.

**Build:** the shell once — date presets (fiscal-aware), cash/accrual, compare previous
period / previous year, monthly columns, % of total, variance, column chooser, permalink,
drill-down, PDF, Excel, print. Then `defineReport({ id, source: 'ledger' | 'documents',
groupBy, measures, filters })`. Most missing reports are a group-by over data you already
have: "transactions by customer / vendor / reference", "customer / vendor balance
summary", "sales / purchases by item" are the same query with a different `groupBy`.
Dashboard widgets are the same reports rendered small.

Move the 6 existing statement views (3,438 lines) onto it — expect each to shrink to
~100 lines plus its `defineReport`.

**Closes:** F-22 · N-01..N-12 · J-01..J-14 · CB-01..CB-29 · O-04..O-08 · BC-01..BC-11 ·
BD-01 · BD-04..BD-06 · BD-08 · BD-10 · BJ-01 · BJ-02 · BK-07..BK-10 · I-17 · I-18 · D-01 ·
D-08 · F-13 — **89 items**.

## 5 · Event bus — closes 32

**Build on:** `LedgerPostService` (single posting path), the document engine (2), the
entity framework (3), the 13 hand-written audit writes, `useNotificationStore`,
`emailService`, the existing webhook code.

**Build:** every write emits one typed event (`invoice.sent`, `payment.received`,
`bank.feed.disconnected` …). Subscribers: audit log · notifications · webhooks (with
delivery log) · email triggers · activity feed. A notification type becomes one row:
`{ event, audience, channels, template }`. Replace the 13 hand-written audit writes with
one subscriber — that removes a whole category of "forgot to audit" bugs.

**Closes:** S-01..S-20 (all notifications) · K-25 · K-26 dunning · K-32 · K-37 webhook
delivery · BE-01 reminders · BE-02 · BE-06 · BG-01 · BG-04 · CC-16 · BL-01..BL-03.

## 6 · One per-view data hook — closes 13

**Build on:** `useLedgerData.ts`, the truncation flags you already built.

**Build:** `useCollection(name, { where, dateWindow, limit, live })` returning
`{ data, loading, error, truncated }`. Views ask for what they need when they mount,
instead of 24 listeners loading everything at login. Migrate one view at a time; keep
Zustand for derived state.

**Closes:** C-14 · C-15 · C-16 · C-17 · C-20 · AA-06 · I-01..I-05 · D-04 · D-05. Also
the biggest single cut to your Firestore bill.

## 7 · One accessible Field/Form layer — closes 16

**Build on:** Radix `Label` (installed), zod schemas.

**Build:** `<Field label error>` that always wires `htmlFor`, and `<SchemaForm schema>`
that renders fields from a zod object. Shortcuts 2 and 3 use it, so every form they
generate is accessible from the start. The ~400 accessibility warnings then go down as
screens move onto it, without a separate accessibility project.

**Closes:** E-02..E-07 · E-10 · E-13 · E-14 · E-19..E-21 · I-07 · I-08 · I-11 · I-12.

## 8 · Test and document at the registry, not per component — closes 39

**Build on:** `e2e/view-registry-coverage.spec.ts` (89 lines — it already loops over the
registry), `src/config/registry.tsx`.

**Build:** extend that one spec to, for every registered view × every role: mount it,
assert no console errors, run axe (add `@axe-core/playwright`), and check the
loading/empty states. Add a `help` field to each registry entry and generate the in-app
docs page and contextual help from it. **One test file covers 74 views**, instead of
writing 26 component tests. Keep deep unit tests for money code only.

**Closes:** H-03 · H-04 · H-07 · H-08 · H-11..H-30 · E-22..E-30 · BO-01 · BO-02 ·
BO-07 · L-20 · BP-04 · BP-05.

## 9 · Delete, demote, or decide not to build — removes 71 ⚠ needs your decision

Every screen you delete also removes its share of accessibility work, missing states,
tests, `any` and oversized-file items. Two candidates:

- `SystemCommandCenter.tsx` (1,783 lines) runs on simulated data.
- `ApiHub.tsx` (3,149 lines, the second-largest file) has 6 tabs; key management and docs
  are the parts a customer uses.

Consider putting these, plus `IntelligenceCenter`, `DiagnosticConsole`, `AICustomBlueprint`
and `AICommandCenter`, behind a `developer` feature flag. That takes them out of the
product surface without losing them.

**Decide not to build** (listed in the tracker as open; I recommend dropping them):
industry verticals BI-01..BI-16 · e-invoicing for markets you don't sell into T-09..T-15 ·
SSO/SCIM/IP allowlist P-01..P-03 until a customer asks in writing · warehouses M-15 ·
query language / formula engine / E2E encryption CD-03..CD-05 · commerce features
CA-21..CA-24, CG-09..CG-12 · investment tracking CE-02..CE-05 · extra bank aggregators
Y-05..Y-07 (keep one) · SMS BA-14 · integrations Z-23..Z-27 until asked · i18n L-18
(remove the toggle: 15 minutes, versus extracting 150 components).

## 10 · Mechanical cleanup via the ratchet — closes 57, gradually

61 array-index keys · 30 UTC dates · `any` in ~16 files · 14 oversized files ·
`server.ts` size · `console.log` · missing `noopener`. **Do not schedule these.** With the
ratchet (step 0b) in place, each commit that touches a file cleans it up and lowers the
baseline. Closes G-01..G-14 · A-16/17/20/21/23 · B-09 · F-01 · F-04..F-21 · D-03..D-25 ·
L-13 · AD-01 · AD-02 · AG-05.

## 11 · Data-health rule registry — closes 19

**Build on:** `TruthEngine`, `DataHealthView`, `computeBalanceSheet`'s orphan detection.

**Build:** `defineCheck({ id, severity, query, explain, fix })`. Each check is one entry.
The period-close checklist is simply "run these checks, record who signed off".

**Closes:** Z-07..Z-15 · CA-06 · CA-32 · CA-33 · CA-34 (bisect — binary-search the date
the books stopped balancing) · R-01 · R-02 · R-08 · R-09 · BJ-03 · L-07.

## 12 · Import/export adapter registry — closes 11

**Build on:** `mt940Parser.ts`, `camt053Parser.ts`, the OFX code, `exportUtils`.

**Build:** `defineImporter({ format, detect, parse, mapColumns })` plus one wizard that
handles any registered format, with saved column maps, dry-run preview, per-row errors
and rollback. Each new format is then one parser file.

**Closes:** M-18 · BK-02..BK-04 · BK-11 · BK-12 · Y-01 · Y-02 · Y-18 · K-36 · CA-11.

## 13 · One money/number display primitive — closes 7

**Build on:** `Money.tsx` (now wired) and `formatCurrency`.

**Build:** locale-aware symbol placement, separators, accounting-style negatives
`(1,234.56)`, per-currency rounding — all inside `Money` / `formatCurrency` and nowhere
else. Also make the 3-decimal-currency storage decision here.

**Closes:** BM-01..BM-05 · BH-02 · A-03.

## 14 · Use the algorithm registry that already exists — closes 10

**Build on:** `FINANCIAL_ALGORITHMS` + `ToolSandbox` (only 5 algorithms registered today).

These are pure calculations. Per `AGENTS.md`, add each as an algorithm and the UI is
generated automatically — no view to build.

**Closes:** Q-01..Q-06 (depreciation variants, lots, tiered pricing, allocation,
variance) · P-14 cohort analysis · CA-25 seasonal budgets · CA-26 allocation % ·
V-08 WIP.

## 15 · User-built tools with an AI builder — sits on top of 3, 4, 11 and 14

**The rule that makes it safe: users and the AI create CONFIGURATION, never CODE.**
A custom report, filter, rule, check or formula is a JSON object in a fixed vocabulary.
The engines you already have (or build in shortcuts 3/4/11/14) interpret it. Nothing is
ever `eval`'d. (Verified today: the codebase has zero `eval` / `new Function` — keep it
that way.)

**The flow, for every kind of custom tool:**
```
user describes it in words
  → AI returns JSON constrained by a schema   (server.ts:3218 already uses responseSchema)
  → server validates it with zod             (reject anything outside the vocabulary)
  → dry-run preview on real data             ("this rule would have changed 34 past transactions")
  → a person confirms
  → saved per workspace, versioned, can be switched off with one click
```

**Already half-built:** `AutoRule` (10 conditions, 15 actions) · saved views
(`useSavedViewsStore`, 443 lines) · `TransactionQueryEngine` (638) · `query-builder` view ·
`AICustomBlueprint` (describe your business → AI generates a chart of accounts — the same
pattern, working for one thing) · `FINANCIAL_ALGORITHMS` + `ToolSandbox`.

**What users could build, and which engine runs it:**

| User creates | Stored as | Runs on |
|---|---|---|
| Automation rules | `AutoRule` JSON | existing rule engine — **works today** |
| Saved filters / views | saved-view JSON | existing saved views + query engine — **works today** |
| Custom reports | `defineReport` JSON | shortcut 4 |
| Custom fields | schema fragment | shortcut 3 |
| Custom checks / alerts | `defineCheck` JSON | shortcut 11 |
| Calculated columns / formulas | expression string | restricted evaluator (below) |
| Dashboard widgets | report JSON rendered small | shortcut 4 |

**Safety rules — all of them, not some:**
1. **Config only.** No user- or AI-supplied JavaScript runs, ever.
2. **Server-side zod validation** of every saved tool. Client validation is not enough.
3. **Formulas** use a small purpose-built evaluator: numbers, `+ − × ÷ ( )`, comparisons,
   and a whitelist (`SUM AVG MIN MAX IF ROUND ABS`). No variables except named fields, no
   property access, no function calls outside the whitelist, integer-cent maths via
   `documentMath`. Add a test file of escape attempts (`constructor`, `__proto__`,
   `this`, huge exponents, deep nesting) that must all be rejected. Don't reach for a
   general-purpose expression library without checking its security history — several
   have had sandbox escapes.
4. **Money invariants are enforced by the engine, not the config.** Any custom report or
   formula that sums money goes through `isPostable` / `lineAmount` / `documentMath`
   automatically — a user's config cannot switch that off (AGENTS.md rule).
5. **Custom tools read and suggest. Writes go only through existing actions** (rule
   actions → `LedgerPostService`), so period locks, permissions and audit all apply.
6. **Who can create:** owner/accountant (`canAdmin`). Everyone else can use them.
   Top-level collection scoped by `workspaceId`, rules block with `affectedKeys()`.
7. **Prompt injection:** the builder prompt gets the schema, the field names and the
   user's request — **not** raw ledger text. Transaction descriptions and vendor names are
   attacker-controlled; if examples are needed, pass them as clearly delimited data.
8. **Limits:** max tools per workspace, evaluation time limit per rule/formula, AI calls
   charged against the existing compute-credit balance.
9. **Isolation:** each custom widget/report renders inside an error boundary, so a broken
   tool shows an error card instead of breaking the page.
10. **"For the whole system" means templates you review**, not user tools running in other
    workspaces. Start workspace-only. Later, you can publish reviewed templates others can
    copy into their own workspace.

**Order:** the first slice (AI → AutoRule) can ship right after step 0c, because the rule
engine exists **and so does the dry run**: `dryRunRules()` in `src/lib/rulesEngine.ts:235`
already filters with `isPostable` and is already used by `RulesSettings.tsx`. What's
missing is only the zod schema for `AutoRule` (none in `src/schemas.ts` today) and the
"describe it" box. Reports, fields, checks and formulas follow as their shortcuts land —
each one adds a new "kind" to the same builder.

```
PROMPT D — "Describe a rule" AI builder, first slice. Do step 0c first.

1. src/schemas.ts: add AutoRuleSchema (zod) matching the AutoRule interface in
   src/types.ts exactly — every condition field and every action as an enum of the
   existing values. .strict() so unknown keys are rejected. Add a test that a valid
   rule passes and that rules with unknown actions, unknown fields, or extra keys fail.
2. Server: add task 'build-auto-rule' to the restored /api/ai/process handler.
   Prompt = the AutoRule schema + the workspace's account names/ids and category
   names + the user's sentence. Do NOT send transaction descriptions or vendor names.
   Use responseMimeType 'application/json' + responseSchema (same as server.ts
   /api/v1/brain/analyze). Parse the reply with AutoRuleSchema on the SERVER; if it
   fails, return 422 with the zod errors, never a half-valid rule. Any account id the
   AI returns must exist in the workspace's chartAccounts — otherwise 422. Charge
   credits the same way the other tasks do.
3. RulesSettings.tsx: add a "Describe a rule" text box (only for canAdmin roles).
   Send → show the returned rule in the existing rule editor, pre-filled, NOT saved.
   Run dryRunRules([rule], transactions) on it and show "would change N of your last
   90 days of transactions" with the list. Buttons: Save (as inactive), Save and
   activate, Edit, Discard.
4. Saving goes through the existing addDoc path for autoRules (workspaceId field,
   existing rules). Add createdBy: 'ai' and the original sentence so it's auditable.
   Validate with AutoRuleSchema on the client before saving too.
5. Tests: schema tests (step 1); a server test that a malicious reply (extra keys,
   unknown action, an account id from another workspace) is rejected; a test that the
   prompt builder never includes transaction descriptions.
6. No eval, no new Function, no dynamic import of user text — the rule is data only.
```

---

# MERGED DUPLICATES (55)

The same work under more than one ID. Close them together:

bulk import = K-01 = M-18 = BK-01 = Y-03 = CA-12 (+ BK-05, BK-06) · bulk action bar = K-06 =
M-17 · portal = K-27 = M-19 · scheduled reports = K-28 = M-08 · merge contacts = Y-23 =
BA-01 · JE templates = BD-09 = CA-27 · undo = I-09 = BO-08 = CD-02 · onboarding =
L-19 = BO-03 = P-09 · structured logging = L-12 = BN-01 · status page = L-17 = BO-06 ·
invalid ledger entries = CA-35 = CB-20 · rate hierarchy = V-04 = CF-03 · timesheets =
V-01 = CF-01 · deferred revenue = K-16 = J-14 = CB-16 = CA-36 · accruals = K-17 = R-05 ·
RBAC = CG-07 = CG-08 · impersonation = P-04 = CE-07 · switcher = K-34 = BD-02 ·
payment runs = K-24 = CA-31 · clearance = CA-04 = CB-24 · branding = Y-11 = Y-12 = Y-13 =
Y-33 = BA-19 = CC-02 · advances = K-18 = BE-12 = CA-09 · inventory adjustment = K-13 =
BA-04 = W-04 = W-05 · tax rules = T-01 = T-02 = CA-16 = CA-17 = CA-20 · tasks = CC-14 =
BG-03 · rule groups = K-38 = CA-13.

---

# THE 179 THAT REMAIN INDIVIDUAL

Grouped. Most get noticeably cheaper after the shortcuts exist. Payroll and fixed assets
have their core calculations done and verified, so what's left is the part users touch.

- **Money workflows (high value):** CA-01 payment reconciliation · CA-02 unreconcile ·
  CA-03 repost ledger · BA-09 quick payment · BA-15 partial unlock · K-20 undeposited
  funds · K-19 bad debt · K-30 loans · K-31 petty cash · K-22 expense claims · K-23
  requisition approvals
- **Period close:** R-03 soft close · R-04 **year-end retained-earnings roll** · R-05..R-07
  · R-10 · R-11
- **Payroll lifecycle:** U-01..U-11 (payslip PDF first — becomes a `defineDocument` once
  shortcut 2 exists)
- **Fixed-asset lifecycle:** X-01..X-09
- **Inventory:** W-01..W-03 (**W-03 COGS on sale**), W-06..W-09
- **Tax depth:** T-03..T-08
- **Multi-entity:** Z-16..Z-22
- **Banking:** Y-04 · Y-08 feed re-auth · Y-09 · Y-10 · CA-05 · CA-07 · CA-08 · CA-10 ·
  CA-14 · CA-15 · CA-18 · CA-19
- **API:** Z-01..Z-06
- **Platform & ops:** L-05 · L-06 · L-08..L-11 · L-14 · L-15 · P-05..P-08 · P-11..P-13 ·
  BN-02 · BN-03 · BP-01..BP-03 · BP-06 · BP-08 · CG-05 · CG-07 · CG-13..CG-15 · CC-13 ·
  CC-15 · CD-01 · CE-06
- **Compliance:** BJ-04..BJ-09 (BJ-05 legal hold: build it together with the purge job)
- **Other UX/features:** I-06 · I-10 · I-13..I-16 · I-19 · I-20 · K-11 · K-35 · K-39 ·
  K-40 · M-21 · BA-03 · BA-16..BA-20 · BD-03 · BD-07 · BE-07 · BE-09 · BE-10 · BE-13 ·
  BF-04 · BF-05 · BF-08 · BG-02 · BG-05..BG-07 · BL-04 · BL-08 · BO-04 · BO-05 · Y-14 ·
  Y-15 · Y-19 · Y-20 · Y-29 · Y-32 · Z-28..Z-35
- **Loose ends:** B-01 · B-05 · B-06 · C-19 · AE-04 · AF-03 · AF-04 · V-06 · V-07 · V-09

---

# ORDER

Dependencies decide the order. The cheapest and safest come first, and each step makes
the next one cheaper.

```
0a  CI fix (lockfile)                        prerequisite for everything
0b  Ratchet + eslint-plugin-react            ~half a day; then shortcut 10 runs by itself
 E  Make CI green (prompt E, top of file)    NOW — includes 3 security-rule fixes
 F  Real + safe AI endpoint (prompt F)       replaces 0c and D; closes an open-login hole
 9  Decide deletions/deferrals               an hour of decisions; shrinks everything after
 1  Collapse customer/vendor mirrors         ~2–3 days, deletes ~900 lines, low risk
 8  Registry-level smoke + axe test          ~1 day; the safety net for the refactors below
 7  Field/Form layer                         ~2 days; needed by 2 and 3
 6  useCollection data hook                  ~3–4 days incremental; needed by 3 and 4
 3  Entity framework + generated rules       ~1 week; ends the wiring-bug class
 2  Document engine                          ~1 week, on top of 3 + 7
 4  Report engine + shell                    ~1–2 weeks, on top of 6
 5  Event bus                                ~3–4 days, on top of 2 + 3
11 12 13 14                                  small, independent, any time
    then the 179 individual items — with CA-01/02/03, BA-09, BA-15, R-04, W-03 first
```

The day estimates are rough. What doesn't depend on estimates: after step 5, adding a
document type, entity, report, notification, check or import format is a registry entry,
not a feature build.

---

# FIRST PROMPTS

```
PROMPT A — Ratchet (step 0b). Do this right after the CI fix.
[use the step 0b block above verbatim]
```

```
PROMPT B — Collapse the customer/vendor mirrors (shortcut 1).

Sales.tsx and Purchases.tsx are 61% identical after swapping customer<->vendor and
invoice<->bill. CustomerDetailView/VendorDetailView are 78% identical;
ARAgingReportView/APAgingReportView are 70% identical; CustomerModal/VendorModal 39%.

1. Create src/config/partySides.ts exporting CUSTOMER_SIDE and VENDOR_SIDE:
   { side, partyCollection: 'customers'|'vendors', documentCollection: 'invoices'|'bills',
     creditCollection: 'creditNotes'|'vendorCredits', controlAccountRole (resolve via
     resolveAccountRole — never a literal account id), labels: {party, document, credit,
     ...} }.
2. Build PartyDetailView({ side }), AgingReportView({ side }), PartyModal({ side }) and
   PartyListView({ side }) from the more complete half of each pair. Keep every behaviour
   either side currently has; where they differ, make it a field on the side config.
3. Point the registry entries and the Sales/Purchases routes at the new components with
   the right side. Delete the old duplicated files.
4. Tests: run every existing test; add one test that renders each new component with
   both sides. Money must still go through isPostable / lineAmount / documentMath.
5. One commit per pair, tsc green between each, no behaviour change.
6. Report the line count before and after.
```

```
PROMPT C — Registry-level smoke + accessibility test (shortcut 8).

Extend e2e/view-registry-coverage.spec.ts. For every entry in src/config/registry.tsx
and every role (owner, accountant, bookkeeper, viewer):
  - navigate to the view with the seeded emulator workspace
  - assert it renders without console errors
  - run @axe-core/playwright and record violations per view
  - assert the view shows a loading state, then either data or an EmptyState
Write the axe violation count per view into the ratchet baseline so it can only go down.
Do not fail the build on existing violations — fail only on NEW ones.
```

---
---

# LEDGERFLOW — MASTER BACKLOG (tracked)

Measured at `origin/main` @ `936add6` · tsc 0 real errors · 293 tests (291 pass) ·
108,507 lines · `server.ts` 4,693 lines · 1,251 `any`

**Legend**
- `[x]` verified done
- `[→]` closes when the 4 CI steps from the last answer land
- `[~]` partially done (remaining count shown)
- `[ ]` open

---

# SECTION A — CORRECTNESS & DATA SAFETY

- [x] A-01 Remove 1-cent tolerance in trial balance
- [x] A-02 Remove 1-cent tolerance in balance sheet
- [x] A-03 FX rounding: by account role only, refuses without the account, tested
- [x] A-04 Property test: debits === credits exactly
- [x] A-05 `orphanedLines` surfaced in the UI
- [x] A-06 `isBalanced` shown on the balance sheet report
- [x] A-07 Duplicate orphan logic removed from `TruthEngine`
- [x] A-08 `anchorDay` required
- [x] A-09 Exhaustive `never` check on frequency
- [x] A-10 `allowedWorldPaths` protected
- [x] A-11 `billingLedgerChain` protected
- [x] A-12 `analyticalTopology` / `computeHardnessScore` protected
- [x] A-13 `schema-drift.test.ts` asserts protected fields
- [x] A-14 Subscriptions and `WORKSPACE_SCOPED_COLLECTIONS` kept in sync by the guard test (both directions)
- [x] A-15 Test: subscription list === the constant (both directions)
- [x] A-16 UTC date extractions: none left except the allowed fallback in `utils.ts` (5e4dfa9). Server "today" is still UTC, not the workspace's time zone (note for later)
- [x] A-17 `server.ts` (0, was 8)
- [x] A-18 `fiscalCalendar.ts` (0, was 5)
- [x] A-19 `workspaceRoutes.ts` (0, was 4)
- [x] A-20 `recurringEngine.ts` (0, was 4)
- [x] A-21 `transactionRoutes.ts` (0, was 3)
- [x] A-22 PurchaseOrdersView / BackupExportSettings / ToolSandbox / FixedAssetsView (all 0)
- [x] A-23 paymentTerms · depreciationEngine · estimateConverter · creditNoteEngine (all 0)
- [x] A-24 Timezone-safety test

# SECTION B — SECURITY & DEPENDENCIES

- [x] B-01 `npm audit`: 0 (Firebase tools removed with the move to Supabase)
- [x] B-02 `csv-parse` prototype replacement
- [x] B-03 `stream-json` DoS
- [x] B-04 `qs` array-limit bypass
- [x] B-05 `@opentelemetry/core` memory (gone with firebase-tools)
- [x] B-06 `firebase-tools` / `@google-cloud/pubsub` (removed)
- [x] B-07 `esbuild` (bumped to 0.28.2)
- [x] B-08 `npm audit` step configured in CI
- [x] B-09 `rel="noopener noreferrer"` present on all three links
- [x] B-10 `uncaughtException` handler
- [x] B-11 zod — consolidationRoutes
- [x] B-12 zod — documentRoutes
- [x] B-13 zod — inventoryRoutes
- [x] B-14 zod — invoiceEmailRoutes
- [x] B-15 zod — leaseRoutes
- [x] B-16 zod — revenueRoutes
- [x] B-17 zod — supportRoutes
- [x] B-18 `validation-guard` scans route files

# SECTION C — PERFORMANCE & COST

- [x] C-01 `transactionRoutes:1087` transactions scan
- [x] C-02 `transactionRoutes:1046` chartAccounts scan
- [x] C-03 `transactionRoutes:1213` chartAccounts scan
- [x] C-04 `transactionRoutes:1336` chartAccounts scan
- [x] C-05 `transactionRoutes:1749` chartAccounts scan
- [x] C-06 `transactionRoutes:1750` chartAccounts scan
- [x] C-07 `documentRoutes:55` invoices scan
- [x] C-08 `documentRoutes:56` bills scan
- [x] C-09 `documentRoutes:57` payments scan
- [x] C-10 `workspaceRoutes:267` invites scan
- [x] C-11 `server.ts` auditLogs scan
- [x] C-12 `server.ts` jobRuns scan
- [x] C-13 Guard against unbounded scans
- [x] C-14 Screens ask for their data (`useLedgerCollections`); core data at workspace open, the rest on first use, kept live; guard test
- [~] C-15 Date windows not needed at launch sizes: documents load once asked (caps 10,000 with the banner) and changes are fetched incrementally; true date windows come with server-side balances (L-123)
- [x] C-16 Reference lists (templates, partners, patterns, dimensions) read once; tax rates and rules live but fetched incrementally
- [~] C-17 Dev-only document-read counter (code present in 2 files — verify it reports)
- [x] C-18 Sharded counter service
- [ ] C-19 `transactionsArchive` tier for closed years
- [ ] C-20 Seed 200k transactions, record load time + reads

# SECTION D — TYPE SAFETY (420 `any` by the ratchet count, was 1,365; every named file done)

- [x] D-01 `computeReports.ts` (0 `any`)
- [x] D-02 `LedgerPostService.ts` (18 → 0)
- [x] D-03 `useTransactionActions.ts` (codex, `codex/c-5-explicit-types`)
- [x] D-04 `useLedgerStore.ts` (codex, `codex/c-5-explicit-types`)
- [x] D-05 `useLedgerData.ts` (0 `any`)
- [x] D-06 `server.ts` and the route files split from it (0 `any`; Stripe webhook objects typed)
- [x] D-07 `transactionRoutes.ts` (92 → 0 `any`; typed caller, `HttpError`, database types)
- [x] D-08 `reportRoutes.ts` (23 → 0; found L-139, L-140)
- [x] D-09 `workspaceRoutes.ts` (0 `any`; found L-138)
- [x] D-10 `documentRoutes.ts` (0 `any`, one lookup instead of the if/else chain; found L-137)
- [x] D-11 `TransactionQueryEngine.ts` (codex, `codex/c-5-explicit-types`)
- [x] D-12 `algorithms/niche-tools.ts` (codex, `codex/c-5-explicit-types`)
- [x] D-13 `algorithms.ts` (0 `any`; two unused engines removed, 180 lines)
- [x] D-14 `IntelligenceCenter.tsx` (codex, `codex/c-5-explicit-types`)
- [x] D-15 `SystemCommandCenter.tsx` (codex, `codex/d-15-command-center-types`; owner-authorized follow-up)
- [x] D-16 `ApiHub.tsx` (0 `any`; found L-144; billing data it loaded and threw away no longer loaded)
- [x] D-17 `StatementImporter.tsx` (codex, `codex/c-5-explicit-types`)
- [x] D-18 `TransactionGrid.tsx` (codex, `codex/c-5-explicit-types`)
- [x] D-19 `BudgetManager.tsx` (codex, `codex/c-5-explicit-types`)
- [x] D-20 `useUIStore.ts` (0 `any`; display choices from storage checked against the allowed values; found L-143)
- [x] D-21 `ToolSandbox.tsx` (codex, `codex/c-5-explicit-types`)
- [x] D-22 `registry.tsx` (codex, `codex/c-5-explicit-types`)
- [x] D-23 `Ledger.tsx` (0 `any`)
- [x] D-24 `Reconciliation.tsx` / `App.tsx` (0 `any`)
- [x] D-25 `noImplicitAny`: on (part of `strict: true` in tsconfig.json)

# SECTION E — ACCESSIBILITY

- [x] E-01 Lint script — type check and ESLint are separate CI steps now
- [x] E-02 Eligible inputs named and labels linked, including the 46 remaining layouts and fields missed by lint (codex, branch `codex/c-3-accessible-form-labels`, PR pending)
- [x] E-03 Eligible selects linked to labels or given accessible names (codex, branch `codex/c-3-accessible-form-labels`, PR pending)
- [x] E-04 Icon-only buttons and switches named (lint rule now clean)
- [x] E-05 Every table names itself with a caption (43 added, 56 tables; guard test)
- [x] E-06 Both images have alt text (receipt viewer, document vault)
- [x] E-07 Eligible labels use matching htmlFor/id; per-instance IDs verified in Chromium; label-has-associated-control 185 → 46 → 0 (codex, branch `codex/c-3-accessible-form-labels`, PR pending)
- [x] E-08 InvoiceModal — dialog role + name, focus in, Tab kept inside, Escape (asks before discarding), focus returned; axe 0 (browser test)
- [x] E-09 BillModal — same; title says "Edit bill …" when editing; axe 0 (browser test)
- [x] E-10 ReceivePaymentModal — same (useDialog; component test still passes)
- [x] E-11 CustomerModal — same; close button had no name; axe 0 (browser test)
- [x] E-12 VendorModal — same; close button had no name; axe 0 (browser test)
- [x] E-13 TransactionEditModal — same; heading levels fixed
- [x] E-14 JournalEntryModal — its label pointed at an id that did not exist; now named by its title, focus kept inside
- [x] E-15 PurchaseOrder editor — new order + goods received dialogs: focus, Tab, Escape
- [x] E-16 Estimate editor — inline form; axe 0 (browser test)
- [x] E-17 CreditNote editor — dialog role + name, Escape; axe 0 (browser test)
- [x] E-18 Item editor — item and cost-of-sale dialogs in Inventory
- [x] E-19 Payment run — no payment-run screen exists yet (K-24, later); new dialogs get the same behaviour from `useDialog`, and a ratchet counts overlays without a dialog role (40, only goes down)
- [x] E-20 WriteOffModal — same as the other money dialogs
- [x] E-21 `scope` on every header cell (221 added; guard test)
- [x] E-22 Visible focus ring on every keyboard-focused control (index.css; browser test)
- [x] E-23 Keyboard-only invoicing (browser test); native buttons on report rows, grid headers and reconciliation controls; independent filter/Tab behavior (codex, `codex/c-4-keyboard-controls`)
- [x] E-24 Screen-reader pass: axe finds nothing on any of the 33 screens (landmarks: sidebar navigation, status bar, cookie notice; no nested main; named chart slices), checked on every screen by e2e/layout.spec.ts; with captions, scopes, one h1 per screen and dialogs (E-05, E-21, E-30, C-11)
- [x] E-25 `aria-live` for async results — save/fail messages go to the toast live region, loading/failed lines use `role="status"`, field errors `role="alert"`; buttons that wait say so (`aria-busy`)
- [x] E-26 Colour not the only +/− signal — transaction list, pivot sheet and owner overview show "+" / "−" with the colour (`formatSignedAmount`, tested); found L-145
- [x] E-27 Contrast in both themes: axe color-contrast on 6 screens × 2 themes with a baseline (0–4 left per screen)
- [x] E-28 Reduced motion: animations follow the system setting (`MotionConfig reducedMotion="user"` + CSS)
- [x] E-29 Skip-to-content link, first Tab stop (browser test)
- [x] E-30 Headings: one h1 per screen (was the sidebar logo on every screen; 7 screens had none), no skipped levels; checked on all 33 screens by the layout browser test

# SECTION F — CODE STRUCTURE

- [x] F-01 Split `server.ts`: 5,383 → 188 lines. Start-up settings, allowed origins, security headers, rate limits, request log and the long-running server live in `src/server/config` and `src/server/http`; every route in `src/server/routes` (same order: checked by comparing the live route table, 108 entries)
- [x] F-02 Lint rule blocking new routes in `server.ts`
- [x] F-03 `ApiHub.tsx` (3,147)
- [x] F-04 `algorithms.ts` (codex, PR #38; six implementation modules below 800 lines)
- [x] F-05 `useTransactionActions.ts` 2,032 → 68 lines: the actions live in `src/hooks/transactionActions/` (shared context, posting helpers, rules, entries, import, workspace, reconcile, integrity); same names and order returned
- [x] F-06 `transactionRoutes.ts` 1,833 → 24 lines: the routes live in `src/server/routes/transactions/` (one-entry, bulk, reconciliation, period, reversal; same order and middleware, checked against the live router)
- [x] F-07 `SystemCommandCenter.tsx` (1,783)
- [x] F-08 `TransactionGrid.tsx` (1,637)
- [x] F-09 `IntelligenceCenter.tsx`
- [x] F-10 `types.ts` split by domain: `src/model/` ledger, documents, workspace, operations; `src/types.ts` re-exports them, so `import ... from "../types"` is unchanged
- [x] F-11 `LedgerPostService.ts` 1,097 → 27 lines: one file per document type in `src/services/ledgerPost/` (invoice, bill, credits, payment, delete) plus `postingKit.ts` (lookups, lock check, the one server call); `LedgerPostService.*` names unchanged
- [x] F-12 `Reconciliation.tsx`
- [x] F-13 `BalanceSheetView.tsx` — report rendering extracted into `BalanceSheetReport.tsx`; calculations and controller statements preserved (Codex)
- [x] F-14 `TransactionEditModal.tsx` — controller and sibling view; save/reversal/locking callbacks and JSX preserved (Codex)
- [x] F-15 `QBOMigrationWizard.tsx` — migration controller and sibling view; parsing/mapping/commit logic and JSX preserved (Codex)
- [x] F-16 `Inventory.tsx` (798 → 629 lines: item form, stock dialogs, category manager and record-a-sale dialog in their own files)
- [x] F-17 `RulesSettings.tsx` — rules controller and sibling view; rule saving/testing/applying callbacks and JSX preserved (Codex)
- [x] F-18 `PivotSheet.tsx` — pivot controller and sibling view; grouping/matrix calculations and JSX preserved (Codex)
- [x] F-19 `businessTemplates.ts` — three sibling template data modules; all 23 definitions/order and public exports preserved (Codex)
- [x] F-20 `Projects.tsx` — projects controller and sibling view; mutations, project calculations and JSX preserved (Codex)
- [x] F-21 800-line limit — no `max-lines` warnings and filesOver800 0; no baseline raised (Codex)
- [x] F-22 Shared report shell: period presets, compare, permalink and print on the Reports page (Prompt R); one table layout with sticky header and totals (`PartyReportLayout`); one CSV writer for every export (`src/lib/csvExport.ts`, 15 screens moved, guard test)

# SECTION G — REACT CORRECTNESS

- [x] G-01 StatementImporter (4) (codex, PR #32; merged snapshot verified)
- [x] G-02 TransactionRow (3) — the money grid (codex, PR #32; merged snapshot verified)
- [x] G-03 PurchaseOrdersView (3) (no index keys left)
- [x] G-04 ToolSandbox (3) (codex, PR #32; merged snapshot verified)
- [x] G-05 QBOMigrationWizard (3) (codex, PR #32; merged snapshot verified)
- [x] G-06 TransactionEditModal (2) (codex, PR #32; merged snapshot verified)
- [x] G-07 HelpGuideView (2) (codex, PR #32; merged snapshot verified)
- [x] G-08 ForensicAuditor (2) (codex, PR #32; merged snapshot verified)
- [x] G-09 RulesSettings (2) (codex, PR #32; merged snapshot verified)
- [x] G-10 CashFlowPredictor (2) (codex, PR #32; merged snapshot verified)
- [x] G-11 ProjectProfitabilityView (2) (codex, PR #32; merged snapshot verified)
- [x] G-12 IntelligenceCenter / AICustomBlueprint / AICommandCenter / Dashboard (codex, PR #32; merged snapshot verified)
- [x] G-13 Remaining single-occurrence files (codex, PR #32) + `BillModal`, `InvoiceModal` and 3 step/dot lists (Claude); ratchet `arrayIndexKeys` 0
- [x] G-14 `react/no-array-index-key` rule (plugin installed, ESLint passes)
- [x] G-15 Error boundary per view (`MainViewSwitcher`, `key={activeTab}`)
- [x] G-16 Recovery action on the boundary

# SECTION H — TEST COVERAGE (122 of 150 components untested)

- [x] H-01 InvoiceModal (component test: totals, tax on top/included, edit keeps number + memo, no customer no save)
- [x] H-02 BillModal (component test: tax included/excluded, approval limit, edit keeps number)
- [x] H-03 ReceivePaymentModal (component test: open documents only, oldest first, amounts sent, refusal)
- [x] H-04 WriteOffModal (component test: amount still owed, bad debt account, refusal)
- [x] H-05 CustomerDetailView (party-detail-views.test.tsx; found L-162)
- [x] H-06 VendorDetailView (party-detail-views.test.tsx)
- [x] H-07 TaxLiabilityView (tax-liability-view.test.tsx: boxes, who can file, the request, changes since filing)
- [x] H-08 StatementView (statement-view.test.tsx, statement-credits.test.ts; found L-160)
- [x] H-09 ARAgingReportView (aging-views.test.tsx; found L-159)
- [x] H-10 APAgingReportView (aging-views.test.tsx)
- [x] H-11 ExpenseByCategoryReportView (report-views.test.tsx)
- [x] H-12 IncomeBySourceReportView (report-views.test.tsx; found L-158)
- [x] H-13 AverageMonthlyReportView (report-views.test.tsx)
- [x] H-14 TopExpensesIncomeReportView (report-views.test.tsx)
- [x] H-15 TagBreakdownReportView (report-views.test.tsx)
- [x] H-16 ForensicAuditor (forensic-checks.test.ts; found L-164)
- [x] H-17 TanStackDataGrid (ui-primitives.test.tsx; sort headers are buttons now)
- [x] H-18 RadixModal — no longer exists (dialogs use useDialog, tested)
- [x] H-19 RequireRole (ui-primitives.test.tsx; found L-161)
- [x] H-20 AsyncButton (ui-primitives.test.tsx; found L-161)
- [x] H-21 ConfirmButton (ui-primitives.test.tsx)
- [x] H-22 EmptyState (ui-primitives.test.tsx)
- [x] H-23 PublicInvoicePage (public-invoice-page.test.tsx; loading/error states readable by screen readers)
- [x] H-24 EstimatesView (estimate-conversion.test.ts; found L-163)
- [x] H-25 CustomerModal (customer-modal.test.tsx; names and emails are trimmed, blank names refused)
- [x] H-26 AuditLogViewer (audit-log-viewer.test.tsx, codex)
- [x] H-27 `src/components/finance` (account register, payments list; found L-165)
- [x] H-28 `src/hooks` (hooks.test.tsx renders the hooks: ledger totals, reports, role, timers, shortcuts; found L-166)
- [x] H-29 `src/stores` (stores-workspace.test.ts: totals, workspace switch, saved views, data loading, record links; found L-167)
- [x] H-30 Property tests (added) + `test:cov` gate: covers every test file and runs in CI instead of plain `npm test`; fails below 75% lines / 72% branches / 73% functions (measured 76.4 / 72.9–73.0 / 73.6); raise as tests are added

# SECTION I — UX COMPLETENESS

- [x] I-01 Loading state: data status line + "Loading…" on the money lists (guard test)
- [x] I-02 Failed loads shown with "Try again" (data status line); render errors already have the view boundary with retry
- [x] I-03 Empty states: the list screens have one (Projects and Audit trail added, with loading first; the rest already had them)
- [x] I-04 `<ViewShell>` wrapper — done another way: one data status line above every screen (loading / failed with "Try again" / cut at limit), an error boundary per screen with a recovery action, and a guard test that screens ask for their data and show "Loading…" (I-01 I-02 I-05)
- [x] I-05 Guard test: a screen with an empty state that loads data on demand must show loading
- [x] I-06 Optimistic updates with rollback — transaction edits show at once and roll back on failure (verified); other saves wait for the server and the live lists update, so nothing is shown that was not saved
- [x] I-07 Unsaved-changes warning in the invoice and bill dialogs (tested)
- [x] I-08 Void/delete confirmations name the record (Sales, Purchases)
- [x] I-09 30-second undo — "Undo" stays 30 seconds after adding or voiding a transaction, and says whether it worked (a failed undo was silent before)
- [x] I-10 Discoverable keyboard shortcuts — one list (`src/config/shortcuts.ts`) feeds the keys and the card (press ?, or "Keyboard shortcuts" in the command palette); Ctrl/⌘ shown per platform; keys the browser keeps freed: Quick entry ⌘Q → ⌘⇧E (⌘Q quits the browser on a Mac), Focus mode ⌘F → ⌘⇧F (find works again), Reports ⌘P → ⌘4 (print works again); tested C-14 also lists the existing focused-screen/grid/editor/tag/dialog handlers in the question-mark overlay (screenShortcuts.ts); component test.
- [x] I-11 Tabular figures everywhere — table cells, fields and mono text use tabular figures app-wide (one CSS rule; browser test)
- [x] I-12 Dates follow the user's chosen format (formatDate; Preferences); tested
- [x] I-13 Persist column layout per user — the transaction list's Columns menu now really hides account, project, class, location, running balance or status, remembered per person on this device (browser test); it changed nothing before (L-148) C-14 adds per-user widths/order with sanitized storage, reset and responsive alignment; persistence/user-switch/corrupt-storage tests and Chromium header/row geometry check.
- [x] I-14 Sticky headers + totals row — report tables (shared report layout, data grid) scroll in their box with the header kept in view (full length when printed); balance summaries have a totals row over the rows shown (component test) C-14 adds a sticky transaction totals row using the existing filtered stats, with a component test. Invoice and bill lists (Claude, 5 Oct): the header and a totals row (count, total, still due; one line per currency; drafts and voided not counted) stay in view while the list scrolls (tested).
- [x] I-15 Inline row editing — description, account and amount can be changed in the transaction list; changing the amount now resizes both lines of a simple entry (L-147); split entries open the dialog
- [x] I-16 Breadcrumb on drill-down — the account drill-down from P&L, Balance Sheet, Reports and the pivot sheet shows "Report › Account" and goes back from it; it is a proper dialog now (component test)
- [x] I-17 Shareable links: report settings and the transaction list (search + date range) live in the address; opening the link restores them (tested)
- [x] I-18 Print stylesheet (Reports page)
- [x] I-19 Active filters as chips — the transaction list shows each active filter as a chip with a remove button and "Clear All"; the command palette's search now shows there too (L-143) C-14 chips remove individual multi-select values, retain zero-amount filters and clear local/page search independently; Hebrew/zero/empty-filter component tests.
- [x] I-20 "What changed since I last looked" — the Overview opens with "Since your last visit (date): 3 new transactions · 1 invoice paid…" per person and workspace on this device (tested)
- [x] I-21 **Owner request (5 Oct): pin pages.** Done: pin button in the top bar (Alt+P), pinned pages as buttons under the top bar on every page with their report/settings tab, Alt+1 … Alt+9 (also on Mac keyboards, where Alt shortcuts never worked before), kept on the device (tested). A pin button on every page; pinned pages stay as buttons on every other page; keyboard shortcuts to jump to them (zero friction)
- [~] I-22 **Owner request (5 Oct): edit in place everywhere.** Shared `InlineEdit` done (tested). Screens done: customer list (name, email, phone), vendor list (name, category, email, phone), contact page (address, currency, tags), Inventory (name, SKU, category, cost, price; typing a quantity records a stock count), chart of accounts (name, code, description, category; system codes fixed; duplicate codes refused), transactions (description by one click with the workspace's own descriptions suggested; date and amount of entries typed in by hand, both lines change together; category of a plain entry with accounts used most first; class and location on every line; entries from an invoice, bill, payment or bank line keep their amount and date, and document entries their accounts; locked periods read-only), invoice list (due date while open; date while draft), bill list (vendor's number, due date while unpaid, date while draft). **Add in place** (type a name + Enter): customers, vendors, inventory items; entries at the top of the transaction list (description, amount, Enter; the category is suggested from past entries with a similar description, money in/out follows it, bank account and date stay for the next one). **Archive / delete in place**: customer and vendor lists (archive hides it from lists and new invoices/bills, records keep it, "Show archived" brings it back; delete only when nothing refers to it, checked by the server, which names what uses it); recurring schedules: name, how often and next date in place (not before the last run); tax codes: name and rate in place; chart of accounts: Archive / Restore / Delete in each row's menu, archived accounts hidden behind "Show archived accounts", an account with entries is archived instead of deleted). Purchase orders: vendor, expected delivery and the lines (item, quantity, unit price; type a new line + Enter; remove a line) change in place while nothing was received or billed, the total follows; expected delivery can still move after a partial delivery; an order with nothing received or billed can be deleted from its row. Credit notes and vendor credits: number and reason in place (reasons used before are suggested; a number already used is refused), the date while none of the credit was used; viewers no longer see "New credit note". Next: documents (drafts), projects, settings lists, bank lines; then add/delete/rename from the same places. Any field you can see (a vendor's address in the vendor list, an item's price, a customer's email) can be changed right there by typing, without opening another page; one shared component, applied to every list and detail page, and the rule for every new screen (AGENTS.md) C-15 also covers Projects (name/client/planning budget/status, list and pipeline), Employees (name/email/job role), Assets (name/location/category), Budgets (name/planning amount), draft Estimates (reference/date/expiry/notes) and Dimensions (node/axis labels, previous label aliases and unfinished local edits preserved). Each has component coverage and confirmed scoped saves with refusal/retry. New employee creation is now persisted, not only cached.
- [~] I-23 **Owner request (5 Oct): help while typing.** Started: suggestions from the workspace's own data, most used first (vendor and item categories, currencies, transaction descriptions, categories); a new invoice takes the customer's usual payment terms; a new bill the vendor's usual account; "Same as last time" copies the lines of the customer's latest invoice (or the vendor's latest bill, amounts included) in one click, and a new purchase order the vendor's latest order (vendors you order from most are listed first); foreign currency rates fill in. Fields suggest values from the workspace's own data as you type (names, addresses, categories, accounts), ranked by the matching algorithms already in the app

# SECTION J — MISSING REPORTS

- [x] J-01 Customer Balance Summary (as-of date, tested)
- [x] J-02 Vendor Balance Summary (as-of date, tested)
- [x] J-03 Contact Balance Summary (customers and vendors on one list, a business that is both on one row by email or name, net; tested)
- [x] J-04 Transactions by Customer (drafts skipped, FX, credits, date range, tested)
- [x] J-05 Transactions by Vendor (drafts skipped, FX, credits, date range, tested)
- [x] J-06 Transactions by Reference (entry reference, else the invoice/bill number; reversals marked; natural order; tested)
- [x] J-07 Sales by Item: issued invoices, base currency, posted or estimated cost, tested
- [ ] J-08 Purchases by Item — waits: bills have no item lines (only `splits`)
- [x] J-09 Inventory Valuation Sheet (stock at cost, share, reorder flags, compared with the Inventory account in the books; tested)
- [ ] J-10 Inventory Item Details — waits for W-02: only sales move stock today (bills have no item lines), so a movement history would be one-sided
- [x] J-11 Sales Tax Liability Summary (Tax screen: tax by rate, collected and paid, in the home currency; adds up to the return boxes; tested)
- [x] J-12 Journal Sheet: isPostable + lineAmount, unbalanced list, tested
- [ ] J-13 Budget vs Actual with drill-down
- [ ] J-14 Deferred-revenue waterfall

# SECTION K — MISSING FEATURES

- [x] K-01 Bulk import wizard (customers, vendors, items, accounts; undo; tested)
- [x] K-02 Items on invoice lines: pick by name/SKU, fills price + cost, free text unlinks, tested
- [ ] K-03 Sale receipts
- [ ] K-04 Sales orders
- [ ] K-05 Manual journals entity
- [x] K-06 Bulk action bar: transaction list (categorize safely, Enter/Apply, accounts used most first; L-180); invoice and bill lists: tick several, then download the PDFs as a zip, email the invoices to their customers (drafts and voided ones left out, each failure named), or pay them in full at once ("Record payment" / "Pay bills": one payment per customer or vendor into or out of the chosen bank account; drafts, paid and other-currency documents left out with the reason; a refused payment doesn't stop the others; not for viewers) (tested)
- [ ] K-07 Attachments on every entity
- [x] K-08 Email templates (invoice, reminder, receipt; preview)
- [x] K-09 Credit note refunds (DR A/R, CR cash; tested)
- [x] K-10 Vendor credit refunds (DR cash, CR A/P; tested)
- [x] K-11 Payment links: emailed link → pay online → payment recorded, invoice paid, team notified (tested; needs Stripe keys live)
- [x] K-12 Item categories: filter chips on Inventory, existing categories suggested in the item form (renaming a category across items: BA-05)
- [x] K-13 Inventory adjustments: Adjust stock per item (correction, stock received with average cost, opening stock), posted at cost with the quantity in one database transaction (tested)
- [ ] K-14 Account groups
- [ ] K-15 Tags as an entity
- [ ] K-16 Revenue recognition schedules
- [ ] K-17 Prepaids + auto-reversing accruals
- [ ] K-18 Retainers
- [x] K-19 Bad debt with reversal (server, base currency, tested)
- [x] K-20 Undeposited funds (Make deposit; tested)
- [ ] K-21 Expected-bill tracking
- [ ] K-22 Expense claims
- [ ] K-23 Purchase requisitions
- [ ] K-24 Payment runs + bank file
- [x] K-25 Remittance advice: "Pay bills" can email each vendor what was paid, on which date, for which of their bills (new "Payment sent to a vendor" email, editable in Settings → Emails; logged; vendors without an address are skipped) (tested)
- [x] K-26 Dunning: reminders on chosen days after the due date, per-customer opt-out (tested)
- [ ] K-27 Customer portal
- [ ] K-28 Scheduled reports
- [ ] K-29 Exchange-rate history at posting
- [ ] K-30 Loans with amortisation
- [ ] K-31 Petty cash
- [ ] K-32 Notification preferences
- [ ] K-33 Categories management UI
- [ ] K-34 Workspace switcher
- [ ] K-35 Per-workspace inbox address
- [ ] K-36 Transaction enrichment
- [ ] K-37 Webhook delivery tracking
- [ ] K-38 Rule-group UI
- [ ] K-39 Rule actions: accounts + type conversion
- [ ] K-40 OAuth provider

# SECTION L — OPERATIONS & TRUST

- [x] L-01 CI actually running — clean install passes
- [x] L-02 `test:rules` in CI — now the Postgres row level security suite (every collection)
- [x] L-03 `test:e2e` in CI — runs fully (23 pass, 8 fail)
- [x] L-04 `npm audit` in CI — green
- [x] L-05 TZ matrix in CI: Auckland + Los Angeles (94661cd) — found L-79 on its first run
- [~] L-06 Dependencies: all in-range updates applied on main 2026-10-02 (the Dependabot group PR closes itself); majors wait for a feature that needs them (Vite 8, TypeScript 7, Recharts 3, Plaid 47, Stripe 23, React Window 2…); npm audit clean
- [x] L-07 Backup restore test: export → change → restore gives the same trial balance and documents (database test); backup holds all the books
- [x] L-08 Per-workspace retention (Settings → Security → Data retention, owners): recovery window after deletion 30–365 days, email send log, browser error reports; pruned by the daily job; bounces/spam reports always kept; audited (tested)
- [x] L-09 Account deletion: shared workspaces handed over (or blocked with a clear message), solo ones scheduled for deletion, personal data removed (tested)
- [x] L-10 Download my data (Settings → Security; tested)
- [x] L-11 Record of processing activities: docs/privacy/ROPA.md (controller + processor parts, rights; company details for you to fill in)
- [x] L-12 Structured logging: `src/server/utils/logger.ts` (JSON lines) used by server.ts (94661cd)
- [x] L-13 `console.log` in `server.ts`: 0 (94661cd)
- [x] L-14 Browser errors and screen crashes reported to errorLogs with a daily digest; server errors as JSON log lines
- [ ] L-15 Per-workspace usage metrics
- [x] L-16 Health endpoint
- [x] L-17 Status page: public /status (no sign-in) from GET /api/v1/public/status — app, database, daily job (recorded by the cron, late/failed = problems), sign-in, email, card payments, bank feeds (set up or not); 30 s cache (tested + browser test)
- [ ] L-18 i18n: finish or remove
- [x] L-19 Setup wizard for new workspaces: business basics, chart template, opening balances posted as one entry that balances by construction (difference → Opening Balance Equity; receivables/payables come from invoices/bills), or start from zero; owners/accountants; server-side, audited (tested). The old welcome screen's "Explore with sample data" button only showed a toast; removed
- [ ] L-20 Docs page for all 74 views
- [x] L-21 Lockfile-platforms guard test
- [x] L-22 Type check as its own CI step
- [x] L-23 `/api/ai/process` restored: real AI, login, workspace, credits, no invented data
- [x] L-24 Route-contract test: every `/api/...` the browser calls has a server route
- [x] L-25 Un-mocked E2E call to `/api/ai/process` passes
- [x] L-26 AI rule builder: workspace categories, server rejects unknown ones, tested
- [x] L-27 Rules: lock-date check crash fixed
- [x] L-28 Rules: audit-log identity fields must match the signed-in user; viewers only USER_LOGIN
- [x] L-29 Rules: voided documents can no longer be hard-deleted
- [x] L-30 `stream-json` override removed; emulator starts
- [x] L-31 `app/applet/` + `bun.lock` removed, guard test added
- [x] L-32 Write-off, PDF preview and aging drill-down all present
- [x] L-33 Ratchet metrics all measured for real
- [x] L-34 AI endpoint: guest-token login removed, membership failure → 403
- [x] L-35 AI endpoint: no invented data on failure
- [x] L-36 AI rules: delete/overwrite actions stripped, validated on the server, owner/accountant only
- [x] L-37 Copilot `chat` and AI blueprint work again
- [~] L-38 Building blocks: `useCollection` used in AuditLogViewer, `SchemaForm` in Chart of Accounts; `defineEntity` not yet
- [x] L-39 Build broken by deleted Party components — builds again, type check 0
- [x] L-40 Rules test: bankLines treated as server-only
- [x] L-41 Lockfile in sync, `bun.lock` removed with a guard
- [x] L-42 Purchases: pay, void, CSV export back (+ guard test)
- [x] L-43 Customer/vendor pages with invoices, payments, balances
- [x] L-44 Aging export + sort
- [x] L-45 Accessibility check on every view — all pass their limits
- [x] L-46 AI: workspaceId required
- [x] L-47 AI: login checked before the key (E2E test passes)
- [x] L-48 Money shown 100× too small — all 64 fixed + guard test
- [x] L-49 Guest mode shows demo data — lifecycle E2E passes
- [x] L-50 E2E transaction-list tests pass
- [x] L-52 Status bar computes balance with `lineAmount()`
- [x] L-53 `--faint` contrast fixed (4.88:1)
- [x] L-54 Account Statement / Sales Tax start at the fiscal year
- [x] L-55 ESLint back under the limit, limit lowered to 2,813
- [x] L-56 "Never raise the ratchet" is in the wrapper of every prompt
- [x] L-57 Type check 0 errors
- [x] L-58 Demo banner contrast fixed
- [x] L-59 Tax tests pass with their original inputs
- [x] L-60 Report code split: `computeReports.ts` 490 + `partyReports.ts` 309 lines
- [x] L-61 Search bug fixed — view filter and typed search both apply; unit + E2E tests
- [x] L-62 Status-bar green contrast fixed (emerald-700)
- [x] L-63 Saved-view chip is a real button; star is a sibling
- [x] L-64 Accidental reverts undone (keep step 0 "git pull first" in every prompt)
- [x] L-65 Test files use typed helpers (0 `as any`)
- [x] L-66 **CI fully green on GitHub** (both jobs) — 2026-09-23, commit 7160b13
- [ ] L-67 Protect `main`: require both CI jobs before merging (GitHub setting — you) — would have blocked 5119ad2
- [x] L-68 Unused duplicate unmatch endpoint removed — CI green
- [x] L-69 `/reconcile`: role + lock + audit + no-user 401; 3 tests (5e4dfa9)
- [x] L-70 One local-date helper (`getLocalDateISO`)
- [x] L-71 **SECURITY** Payments: workspace (strict) on accounts + documents, 404, cap via `calculateAmountDue`, total cap, role check, void/draft refused, no fake account — d2b8027, 8 tests
- [x] L-72 **SECURITY** Document PDFs: strict workspace check, 404 like missing — d2b8027, tested
- [x] L-73 One audit-entry shape: all server writers use `writeServerAuditLog`; screens read old + new (5e4dfa9)
- [x] L-74 Audit trail no longer deleted after 90 days; guard test (5e4dfa9)
- [x] L-75 Admin Audit Log screen fixed via `auditDescription` / `auditTime` (5e4dfa9)
- [x] L-76 **SECURITY** Same invoice twice in one payment → refused — d2b8027, tested
- [x] L-77 Payment handler: no user → 401 (5e4dfa9, tested)
- [x] L-78 Permission-denied fallback only outside production (5e4dfa9, tested)
- [x] L-79 Dates with no workspace time zone now use the device's zone; tests pass in UTC, Auckland and Los Angeles (2bdcdc7)
- [x] L-81 **SECURITY** workspace restore can't overwrite another workspace's records (tested)
- [x] L-82 Removed AI Studio IAM fallbacks (errors were reported as success) + in-memory billing copy
- [ ] L-83 Verify the database TLS certificate (`DATABASE_CA_CERT`)
- [ ] L-84 Custom SMTP sender for sign-up / reset emails
- [ ] L-85 Two-step login management screen (status, remove, recovery codes)
- [ ] L-86 Move security-definer helpers to a private schema
- [ ] L-87 Sort large lists with an index (with C-14/C-15)
- [x] L-88 Two-step login enforced on Supabase (database + server + code screen)
- [x] L-89 Moved off AI Studio / Firebase to Supabase + Vercel
- [x] L-90 **SECURITY** server write routes check roles (viewers read-only; members/API keys/billing owner-only; labeler membership)
- [x] L-91 Fake success endpoints (/api/v1/ecommerce, marketing, helpdesk, hr, manufacturing, universal-ops) deleted (API-key callers got "success" for nothing); Admin Panel (simulated logs) behind the developer switch (Settings → Developer)
- [x] L-92 Plaid bank connections belong to the workspace; /sync only that workspace's banks (tested)
- [x] L-93 Express 5 compatibility (params types, wildcard routes, empty body)
- [ ] L-94 Build invoice/bill postings on the server (with the document engine)
- [x] L-95 Payments counted twice when a paid invoice/bill was edited (settledByRecordsCents)
- [x] L-96 Credit notes / vendor credits couldn't be created (posting endpoint refused them)
- [x] L-97 Bank statement import always failed (browser wrote server-only bankLines)
- [x] L-98 Receive payment failed without account mappings; vendor payments could hit receivables
- [x] L-99 Payment records lacked direction/contactId/status (reports and customer pages missed them)
- [x] L-100 Time zone / fiscal year / server-set workspace fields refused by the database (settings save failed)
- [x] L-101 Adding a customer failed (`status` not allowed by the database)
- [x] L-106 Emailing an invoice never worked (browser sent no login token); now sent by the server after posting
- [x] L-107 "+" on a customer row saved an empty invoice (misspelled field) instead of opening the invoice form
- [x] L-108 Customers list showed a made-up "Preferred Partner" label on everyone; now the reminders switch
- [x] L-109 Online card payments (Stripe webhook) guessed accounts, created no payment record and converted currency twice — now a real payment into Stripe Clearing (tested)
- [x] L-110 Payments on foreign-currency invoices were booked unconverted and labelled USD (tested)
- [x] L-111 Recurring invoices wrote ledger entries with blank accounts and no workspace every period (instead of invoices); "Pause" on screen didn't stop them; the screen's Run/Delete buttons did nothing (tested)
- [x] L-112 Purchase orders and goods receipts were never saved (only in the open page, with a made-up demo order)
- [x] L-113 **Invoices with tax added on top billed the customer without the tax** (the tax came out of revenue); the form now saves the total owed and the tax explicitly (tested)
- [x] L-114 The server silently dropped invoice/bill fields it didn't list (discount, "tax inclusive", retainage, deposit, a bill's currency…); guard test added
- [x] L-115 **Invoices and bills ignored the account chosen on each line** (everything went to one income / expense account); now each line's account gets its share (tested)
- [x] L-116 Editing an existing invoice gave it a new number and wiped its stored details (email history, reminder counters)
- [x] L-117 Invoice PDF always showed "$" and no tax or discount lines
- [x] L-118 **Credit notes carried no tax**: crediting a taxed sale never reduced the tax owed (or a vendor credit the input tax); credits for a document now take its share of tax, currency and rate (tested)
- [ ] L-119 Later: the old sales-tax report function (`computeTaxLiability`, server /reports) adds document-currency amounts; the Tax return screen uses the home-currency return. Retire it once nothing calls it.
- [x] L-120 **Duplicate invoice** posted a copy at once with the original's payments, write-off and an invalid status; it now opens a new draft with the same customer and lines. Also: invoices and bills couldn't be edited from their lists, and the bill dialog would have renumbered a bill being edited
- [x] L-121 **Balances and reports used only the last 12 months of entries** (older opening balances vanished from the balance sheet), and invoices/bills loaded only on a few tabs, so Reports, Data Health and the dashboard saw none or an old copy. Fixed with on-demand live collections
- [x] L-122 The browser tried to write a `ledgerSnapshots` row (a table that doesn't exist) every time balances changed; removed with its unused storage modules
- [ ] L-123 Later: balances and reports need every entry in the browser. Move them to the server (opening balances per closed year) so the browser can load only open years (with C-19)
- [x] L-124 Deleting a workspace left newer tables behind (bank connections with tokens, API keys, members, notifications, tax returns, purchase orders, email events…); the purge now covers every table that holds workspace data, with a guard test and a database test
- [x] L-125 Invoice dialog: a customer typed but not on the list was saved as a made-up customer id (no customer record: no statement, balance or email); editing an invoice wiped its memo, terms and email text; the currency defaulted to USD in any workspace
- [x] L-126 Payments: "apply to invoices" paid the newest invoices first (the list is newest first), and draft invoices/bills were offered though the server refuses them
- [x] L-127 The empty invoice list offered "Seed demo data", which wrote 20 made-up invoices, bills and entries into a real workspace's books; removed
- [x] L-128 Preferences → Date Display Format saved a choice that no screen used; dates now follow it
- [x] L-129 Dark-mode styles (`dark:`) followed the computer's light/dark setting, not the app's theme, so either theme could show the other's colours; the accent colour was the same in both themes (brass text about 2:1 on light backgrounds); muted grey text fell just under the contrast minimum
- [x] L-130 "Undo workspace deletion" could never run: the backup import in server.ts used the same address (POST /workspaces/:id/restore) and answered first; it now has its own address and a banner. Guard test against two routes on one address (it also found /api/v1/reports mounted twice, so API keys never reached reports)
- [x] L-131 Settings → Security "Initiate purge" deleted a workspace's books at once (no 30-day window, ignoring closed periods, leaving payments and credits behind); it is now the 30-day "Delete workspace"; instant clearing only for demo data
- [x] L-105 Foreign-currency documents converted twice in the ledger (amounts converted, then the rate applied again); fixed, test proves it; old entries: Month-End Close → Repost
- [x] L-104 Bad debt write-off counted the loss twice (voided the sale and booked the expense); FX ignored
- [x] L-103 Fixed Asset Register saved nothing (assets + depreciation only in the page); now saved + server run
- [x] L-102 Applying a chart-of-accounts template failed (`role` not allowed, dashboard layout protected) — now applied by the server
- [x] L-80 "Today in the workspace" (`getLocalDateISO()`) split from "the day a Date stands for" (`calendarDateISO`) and plain date maths (`addToDateISO`, `monthBoundsISO`, `workspaceYearMonth`); month navigator, report defaults, tax reserve, exports and algorithms no longer shift a day when the workspace and device time zones differ (tested; utcDateCount 37 → 35)
- [x] L-136 ESLint blocks CI again (errors fail; warnings capped by `--max-warnings`, now 1436 — it only goes down)
- [x] L-132 Automation rules were never saved (Settings → Rules, AI rule builder, "Create rule" in the list only changed the open page; legacy format the engine ignored) — now saved, guard test (found by Codex)
- [x] L-133 "Apply rules to existing transactions" said it applied them but saved nothing — now saved through the server (role, period lock, balance checked)
- [x] L-134 Adding a budget always failed ("Workspace context missing") — fixed, guard test (found by Codex)
- [x] L-135 Reconciliation matching hung on a single strong match (Hungarian algorithm arrays one short) — rewritten, tested against brute force (found by Codex)
- [x] L-137 Document PDFs (Preview / Download PDF) always failed: Express passed `next` as the handler's third argument, which it took for the database. Fixed; tested through the router and the database. Estimate PDFs now list their lines (they printed a placeholder), statements show dates, strangers get 403
- [x] L-138 New numbering series started with "2026" hard-coded in the prefix (INV-2026-…) whatever the year; now the current year (tested)
- [x] L-139 Server budget-vs-actual report read `accountId`, which budgets don't have (always "Unknown", 0 spent), and summed raw line amounts; now finds the account by id/name/code and uses posted entries in the base currency (tested)
- [x] L-140 Server aging report ignored deposits and foreign currency and left out approved bills; now uses calculateAmountDue in the base currency and the shared open-document rule (cancelled documents are closed everywhere) (tested)
- [x] L-141 **SECURITY** `POST /api/v1/auth/audit` needed no sign-in and wrote a sign-in record for any user id in the body (shown in that person's "Download my data"); now signed-in only, for yourself, body checked (guard test)
- [x] L-142 Bank CSV upload: dates without a clear format fell back to the UTC day (the workspace was never read); now the workspace's time zone, members only
- [x] L-143 Command palette "show …" never filtered the transaction list (it set a filter field nobody read); saved views put fields the filter doesn't know into the filter chips (they did nothing). Now the palette search filters (tested) and a view only adds its date range
- [x] L-144 API Hub request log showed every request as "Error" (read `status`, the server sends `statusCode`)
- [x] L-145 Six amounts were printed with a hard-coded "$" and their own division by 100 (owner overview totals, rule previews, saved-view minimum, transfer matches): wrong in any other currency; now `formatCurrency`, and a guard test stops it · L-146 same for 17 more: command palette results (invoices and bills always "USD"), statement and bank-feed import previews, Copilot's figures sent to the AI, tax reserve card, insights, Magic Entry, document vault, transaction pivot; two more guard patterns
- [x] L-147 An amount changed in the transaction list showed the new number, but only the total was sent; the server works the total out from the lines, so the change was dropped. Both lines of a simple entry now change together (tested); split entries say to open the entry
- [x] L-148 Transaction list on a normal desktop screen: **no rows were drawn** (the list area had no minimum height, so the sections above left it 0 px high); the header's last column wrapped (layout one width short); the pro layout's header split Amount into Debit/Credit while rows had one amount (every later column shifted); the Columns menu changed nothing; the footer always said "Ledger imbalance" (it added positive totals); the running balance added money out as if it came in ($15,000 then $27,000 instead of $3,000). All fixed, browser test + unit tests
- [x] L-149 Light theme green/red text (`--pos`, `--neg`) was below the 4.5:1 minimum even on white; darkened (5.3 and 5.6 on the page); Transactions contrast failures 6/7 → 0/1
- [x] L-150 Sales opened on a tab nothing draws ("pipeline"): below the cards the page was blank until you clicked a tab; now opens on the invoice list
- [x] L-151 Customer balances in Sales added unpaid invoice totals (part-payments ignored), then any receivable posting whose text mentioned the customer's name, and fell back to a stored balance that never updated (demo: Stark "owed" $9,000 with no invoices). Now the Customer Balance Summary calculation. Same "total instead of still owed" mistake fixed in the Sales cards (overdue / 30 days / total receivable), the stored customer/vendor balance, the working-capital aging tool and the 1099 tool (paid = what was paid)
- [x] L-152 Screens cut off on ordinary laptops: the Overview (and Reports, Settings, Projects, admin) were centred flex items that sized to their content (up to 1,360–1,600 px), so on windows under ~1,600 px the right side was hidden; the transaction list's toolbar and table pushed the page 1,160 px wider at 1,280. Now everything fits at 1,280 × 800 (the table scrolls sideways in its box, the toolbar stacks); new browser test opens all 33 screens by address and checks they fit and draw something
- [x] L-153 Pivot Sheet counted foreign-currency entries twice over: `lineAmount()` already converts to the base currency and the sheet (grouped view, cross-tab and its export) multiplied by the rate again (EUR 100 at 1.10 showed 121 instead of 110). Fixed; guard test fails on `lineAmount(...) *`
- [x] L-154 CSV exports: five built the file as a `data:` link through `encodeURI`, which leaves `#` alone, so the file stopped at the first "#" ("Invoice #1001"): General Ledger export, Trial Balance, Audit Trail; most didn't neutralise text a spreadsheet runs as a formula (`=…`, `@…`); none had the UTF-8 marker Excel needs for accented/Hebrew names; money was written as raw cents (bills) or `x/100`. All 15 exports now use `downloadCsv` (quoted cells, formula guard, UTF-8 marker, `csvMoney`); the transaction list exports amounts signed like the screen (in +, out −)
- [x] L-155 Charts screen ("Executive Financial Visualizer") showed every amount 100× too small (it divided by 100, then formatted as cents), added each line's size so a reversed entry counted twice instead of cancelling, gave zero-balance bank accounts an invented 5,000, invented accounts and expenses ("Main Checking", "Payroll") and a runway when there was no data, and always printed "$". Now `src/lib/chartsData.ts` (tested): cents, signed lines, posted entries only, workspace currency, empty states instead of made-up numbers
- [x] L-156 Query builder showed amounts 100× too small (divided by 100, then `formatDecimal`, which takes cents) with a hard-coded "$": the Amount column and each line in the expanded rows. Now `formatCurrency` in the entry's currency; money guard bans `formatDecimal(x / 100)`
- [x] L-157 Expense by Category, Income by Source, Monthly Averages, Top Line Items and Tag Breakdown counted only the positive half of expense lines / negative half of revenue lines: a reversed entry still showed in full (its reversal was skipped) and refunds or credits back to customers never reduced the totals, so these reports disagreed with the P&L. Now every line counts with its sign; top-item lists leave out reversed pairs (reportGenerators.ts, tested)
- [x] L-158 Income by Source report crashed on opening ("Maximum update depth exceeded"): its store selector filtered the transactions, making a new array on every read. Fixed; guard test bans `.filter/.map/...` inside store selectors
- [x] L-159 A/R and A/P aging screens: counted total − paid (deposits and applied credits ignored) in each document's own currency (a EUR invoice added as dollars) and aged by the document date, while the /aging API used what is still owed in the base currency by due date — two different agings. Now one rule, `src/lib/aging.ts` (tested), used by both: Current / 1–30 / 31–60 / 61–90 / over 90 days past due; the drawer says "N days overdue"; rows open from a real button
- [x] L-160 Account statements left out credit notes and vendor credits, so a customer with a credit showed a higher balance than the Customer Balance Summary; refunds of credits were invisible to both (a refunded credit still showed as owed back). Credits now appear on statements (screen, PDF and API); the server records `refundedCents` when a credit is refunded, and statements and balance summaries count a credit less what was refunded (tested; the closing balance equals the summary)
- [x] L-161 Buttons: a quick double click on any AsyncButton (payments, saves, filings) ran the action twice (the "busy" flag only took effect after a re-render; now a ref guards it, test fails on the old code); RequireRole's greyed-out mode only blocked the mouse, Tab + Enter still pressed the button (now `inert`); the data grid's sort headers were mouse-only (now buttons)
- [x] L-162 Customer and vendor pages: "Outstanding" was total − paid (deposits ignored) added across currencies, cancelled invoices counted, and "overdue" compared a due date read as UTC midnight with the current time (a day off in the Americas). Now `partyStats` / the aging rule (still owed, base currency, days past due, tested); each document shows its open amount in its own currency
- [x] L-163 Converting an estimate to an invoice wrote the invoice straight to the database as "sent": no ledger posting (no receivable, no revenue: P&L and balance sheet missed it while Sales and aging showed it), a dropped `totalCents` field, no lines, and a random invoice number when numbering failed. Now a draft invoice with the estimate's lines through the posting path (useEntityOperations), no made-up number or account; guard test: no screen writes invoices, bills, credits, payments or transactions to the database directly
- [x] L-164 Forensic Auditor called balanced foreign-currency entries unbalanced: it converted and rounded each line separately (+5.5 → 6, −5.5 → −5) before adding them up. It now checks the lines in the entry's own currency, like the server's validator (`src/lib/forensicChecks.ts`, tested)
- [x] L-165 Finance screens: the payments list showed foreign payments in the base currency and every allocation as "invoice: undefined"; it now shows the payment's currency and the invoice/bill number. Credit notes and vendor credits showed amounts without their currency. The account register treated cost-of-goods-sold accounts as credit accounts, so their running balance had the wrong sign (tested)
- [x] L-166 Transactions screen totals: a customer's payment was counted as "Filtered Outflow" (any entry without an income or expense line went there, transfers too); now only money entering or leaving bank/cash accounts counts, and transfers count as neither. The search total and "sort by amount" used foreign amounts as if they were in the base currency. The statements' report hook recomputed an unused profit figure on every ledger change; it now only fetches, with the dates encoded. An unknown stored role now shows as Viewer, as the server treats it (tested)
- [x] L-167 The Transactions list opened filtered by a saved view nobody chose ("Liquid Cash & Bank Funds" was switched on at every start and after each workspace switch), so most entries looked missing; no view is on until the person picks one. Switching workspace kept the old workspace's closed periods, lock exception, invites and "data truncated" banner until the new one loaded, and its hidden sidebar tabs for good. Income/expense totals stayed at zero when the entries loaded before the accounts, and each load rebuilt the account list once per entry (tested)
- [x] L-168 Cash flow statement: the server version ("Load Full Server Report") counted only income, expense, receivable and payable lines of every entry, so tax paid, stock bought and other working-capital money were missing and the total didn't match the change in cash; the screen had its own different math. One function now (`computeCashFlow`, direct method: money in and out of bank, cash and undeposited-funds accounts, by what it was for; debt and equity financing, fixed assets investing). The General Ledger report got its first test (tested)
- [x] L-169 The server's tax liability report (`/api/v1/reports/tax-liability`) added foreign invoices' and bills' tax in their own currency; now in the home currency. Data Health called balanced foreign entries "unbalanced" because of per-line rounding (same as L-164), and its findings showed raw cents ("1250 cents"); now money (tested)
- [x] L-170 Document PDFs printed only the first 15 lines (the total still covered all of them), on one page, and only Latin letters (Hebrew names came out as garbage). PDFs are now made with pdfkit and an embedded font (DejaVu Sans): every line over as many pages as needed, Hebrew and mixed Hebrew/English text in reading order, the due date and payment terms printed (tested, including the text read back from the PDF)
- [x] L-171 Customers and vendors could not be edited at all (the forms only added), so a wrong email or name could not be fixed; one shared form now adds and edits (Edit on the contact page). Bills had no currency field, so a bill from a foreign supplier could only be entered in the home currency (tested)
- [x] L-172 **SECURITY** `/api/v1/inventory/adjust` and `/cogs` only checked membership: a viewer could post stock entries and change quantities. Both now need owner, accountant or bookkeeper; `/adjust` also hung (no answer) when its database transaction failed, and both labelled entries USD in any workspace. Stock changes now go through one service: every line in one entry with the new quantities, in the workspace currency, never below zero (tested)
- [x] L-173 Stock quantity could be typed into the item form: it changed what is on hand without any entry, so Inventory on the balance sheet and the stock list drifted apart (the record-a-sale dialog also lowered the stock a second time, and fell back to a made-up $50 cost and to any asset or expense account). Quantity now changes only through the server (database rule + tested); new items' opening stock is posted to Opening Balance Equity
- [x] L-174 Inventory showed each person only the items they created; teammates now see all the workspace's items
- [x] L-175 Bank reconciliation "Auto Align All" reloaded bank lines and entries filtered to the signed-in person's own records, so lines imported by the server or a teammate were never matched, and it ignored the account filter. It now matches what the screen shows (tested, with a screen test of matching, ignoring, undoing and the filters)
- [x] L-176 Quick entry and search phrases: amounts came out as fractions of a cent ("28.99" → 2898.9999…), "between 100 and 250.75" used 0.75 as the upper bound ("between 100 and 250" failed), "hosting 0.29" was read as 0.20, and a typed date on the 31st ("3rd feb") rolled into March (tested)
- [x] L-177 An automatic rule with a "set amount" action rewrote an entry's total without its lines, so the entry and the ledger disagreed; rules never change amounts now (tested)
- [x] L-178 CI was red for 3 pushes: the coverage floor (75%) failed after Codex's split files were counted with few tests; tests added for the reconciliation screen, the category engine, the rules engine, the quick-entry parser and recording a sale (coverage back above 75%)
- [x] L-179 Deactivating an account that has history always failed: it wrote a `status` field the database doesn't allow on accounts; it now sets isArchived (found while adding edit-in-place to the chart of accounts)
- [x] L-180 **Money:** bulk categorize on the transaction list changed "line 0" even when it was the bank line, so entries stored bank-line-first lost their bank side (gone from the bank balance), and transfers/journal entries were rewritten too; it also applied while typing ("Software" before "Software Licenses" was finished) and offered bank accounts as categories. Now: bank/cash lines never change, transfers and journal entries are skipped with a message, Enter or Apply only, categories only (tested)
- [x] L-181 **Money:** "Transfer between accounts" only changed the list on screen: the transfer was gone after a reload and never reached the books. "Link as Transfer" (two entries that are one transfer) only set a flag on screen and left the expense and the income in place. Now the transfer is saved through the server as one balanced entry in the workspace currency, and linking moves both entries' other side to a Transfer Clearing account (added once, reused), so the made-up expense and income disappear (tested)
- [x] L-182 **Money:** the keyboard category editor in the transaction list (Enter on the category cell) changed "line 0", which is the bank line when an entry is stored bank-first, so the entry lost its bank side; it also changed the accounts of entries made by invoices, bills and payments, and the amount editor changed amounts of those too. Now the same rules as clicking in the row: only the category side changes, transfers and journal entries and document entries say where to change them instead (tested)
- [x] L-183 **Money:** a bill could not be saved at all in a workspace without a tax account ("Missing Tax Paid account"), even with no tax on it. A tax account is now needed only when the bill has tax (tested)
- [x] L-184 The Taxes screen (opened from the menu) got no data: it listed no tax codes, "New tax", Edit and Delete did nothing, and the tax estimate used no accounts. It now reads the workspace's tax codes and accounts and saves through the normal path; delete asks first; name and rate (one-part taxes) change in place; viewers only read (tested)
- [x] L-185 The first entry dated in a new year quietly added four made-up tax rates ("Federal compliance 22%", "State 5%", city and county levies) to the workspace, which then showed up as tax codes. Removed
- [x] L-186 Choosing payment terms on an invoice (Net 15/30/60) didn't change its due date: it stayed on the invoice date, so every invoice looked due at once and reminders went out early. The due date now follows the terms and moves with the invoice date; a new invoice for a customer takes the terms of their latest invoice (I-23) (tested)
- [x] L-187 **Money:** "Run month-end revaluation" (currency tool) posted one entry that applied a single exchange rate to every asset and liability account, home-currency ones included, for any member, and the rate service fell back to made-up rates (USD→EUR 0.92…) when it couldn't be reached. Rates are now never invented (an error instead; the converter shows no amount and says why) and the run posts nothing until R-07 is built (it must revalue open foreign invoices and bills, since foreign documents are stored in the home currency) (tested)
- [x] L-188 Credit notes and vendor credits got random numbers (CN-1234, VC-5678) that could repeat and didn't follow any series; a double click on Save made two. They now take the next number of their own series (Settings → Document numbering: credit notes CN-2026-0001…, vendor credits VC-2026-0001…, allocated by the server so two people never get the same one), Save works once, and the amount label shows the workspace currency instead of "$" (tested)
- [x] L-51 Ratchet: all metrics real, fast, warnings via `--max-warnings`

# SECTION AA–AI — DEFECTS FOUND BY EXECUTION

- [x] AA-01 Per-collection truncation flag
- [x] AA-02 Banner naming truncated collections
- [x] AA-03 Block client-side sums on truncated lists
- [x] AA-04 Raise caps on reference data
- [x] AA-05 Truncation guard test
- [~] AA-06 Same as C-15: incremental live lists instead of date windows (L-123 for server-side balances)
- [x] AB Storage purge error handling
- [x] AC `customTemplates` scoping
- [x] AD-01 Timers: all 7 listed already clear themselves (checked 5e4dfa9)
- [x] AD-02 Guard test: effects that start timers return a cleanup (with a self-test)
- [x] AD-03 `PublicInvoicePage` timers
- [x] AE-01 Tax-inclusive branch in posting
- [x] AE-02 Shared `calculateDocumentTax`
- [x] AE-03 Posting === reporting test matrix
- [x] AE-04 Recompute tax: `scripts/recompute-document-tax.ts --workspace <id> [--apply --uid <uid>] [--date]` lists documents whose ledger tax differs and posts one audited adjusting entry each (tax ↔ revenue/expense, never edits old entries, period lock respected, runs twice safely); Data Health lists them too (tested)
- [x] AF-01 Discount/retainage in tax
- [x] AF-02 In shared `documentMath`
- [x] AF-03 Deposits = payment in advance (FOR_YOU 13 default): tax on the full invoice, the deposit lowers the amount due; posted DR Customer Deposits / CR A/R; payments, credits, Stripe link, PDF and public page follow it (tested)
- [x] AF-04 Tie-out fixture: EUR + discount + retainage + tax on top (94661cd)
- [x] AG-01 Canonical `amountCents`
- [x] AG-02 `totalCents` removed from Invoice
- [x] AG-03 `paidAmountCents` removed
- [x] AG-04 `LedgerPostService` typed
- [x] AG-05 Guard exists: no `??`/`||` fallback between money field names
- [x] AH-01 `documentMath.ts`
- [x] AH-02 All three callers use it
- [x] AH-03 `/ (1 +` guard test
- [x] AH-04 Tie-out now structural
- [x] AI-01 Parameters typed
- [x] AI-02 Surfaced issues fixed

---

# SECTION M — ENTITIES

- [ ] M-01 Items / products catalogue
- [ ] M-02 Sales orders
- [ ] M-03 Sale receipts
- [ ] M-04 Manual journals
- [x] M-05 Email templates (= K-08)
- [ ] M-06 Exchange-rate entity
- [ ] M-07 Expected bills
- [ ] M-08 Report schedules
- [ ] M-09 Generic attachments
- [ ] M-10 Transaction links
- [ ] M-11 Price lists
- [ ] M-12 Delivery notes
- [ ] M-13 Commodities
- [x] M-14 Item categories (= K-12)
- [ ] M-15 Warehouses (deferred)
- [ ] M-16 Purchase requisitions
- [x] M-17 Bulk action bar (= K-06)
- [x] M-18 Bulk import wizard (= K-01)
- [ ] M-19 Customer portal
- [ ] M-20 Available budget
- [ ] M-21 Standard costing

# SECTION N — REPORT FEATURE MATRIX

- [x] N-01 Compare previous period (calendar-aware; P&L, Balance Sheet, Cash Flow)
- [x] N-02 Compare same period last year
- [x] N-03 Period columns — P&L activity and balance-sheet closing snapshots, fiscal quarters/months and clipped ranges (C-13; hand-number/component/browser tests)
- [x] N-04 % of total — income on P&L, total assets on balance sheet; zero denominator shown as undefined (C-13)
- [x] N-05 Variance column — comparative amount and percentage, zero/negative previous amounts handled; shared CSV export (C-13)
- [x] N-06 Print / Save as PDF on every report (only the report prints, with title + period)
- [ ] N-07 Presentation currency
- [ ] N-08 Cash vs accrual everywhere
- [x] N-09 As-of date passed to every report (Balance Sheet, balance summaries follow it)
- [ ] N-10 Column chooser
- [x] N-11 Permalink: report, year, period, comparison in the address
- [ ] N-12 Full drill-down

# SECTION O — VISUALISATION

- [ ] O-01 Sunburst
- [ ] O-02 Treemap
- [ ] O-03 Icicle
- [ ] O-04 Brush selector
- [ ] O-05 Chart switcher
- [ ] O-06 Legend toggling
- [ ] O-07 Scatter plot
- [ ] O-08 Consistent tooltips

# SECTION P — PLATFORM & ENTERPRISE

- [ ] P-01 SSO
- [ ] P-02 SCIM
- [ ] P-03 IP allowlist
- [ ] P-04 Support impersonation
- [ ] P-05 Two-person rule
- [ ] P-06 Usage metering
- [x] P-07 In-app changelog (codex, `codex/p-07-in-app-changelog`): Help & Guide → What’s new; dated shipped updates, keyboard-accessible disclosure
- [ ] P-08 Product tour
- [x] P-09 Onboarding (= L-19 setup wizard)
- [ ] P-10 Referrals
- [ ] P-11 Multi-language documents
- [ ] P-12 Per-customer templates
- [ ] P-13 Sales rep + commission
- [ ] P-14 Cohort analysis

# SECTION Q — CALCULATION ENGINES

- [ ] Q-01 Units-of-production depreciation
- [ ] Q-02 Depreciation conventions
- [ ] Q-03 Serial / lot tracking
- [ ] Q-04 Tiered pricing
- [ ] Q-05 Cost allocation rules
- [ ] Q-06 Standard cost variance

# SECTION R — PERIOD CLOSE WORKFLOW

- [x] R-01 Close checklist (tested; blockers + items to sign off)
- [x] R-02 Sign-off per item (who, when, note; final once hard-closed)
- [x] R-03 Soft vs hard close (soft: only owners/accountants post)
- [x] R-04 Year-end retained-earnings roll (`/close-year` + `ClosingEntryEngine`, tested)
- [ ] R-05 Auto-reversing accruals
- [x] R-06 Depreciation run (server, one entry per month, catch-up, tested)
- [x] R-07 FX revaluation run (the old run was switched off, L-187: build it from open foreign-currency invoices and bills, owner/accountant, with a reversal on the next day) — **done 2026-10-05**:
  the rules live in `src/lib/fxRevaluation.ts`, away from the page and the database: only what is
  still open at a stored rate is revalued, foreign-currency only (a home-currency document is never
  mentioned, because moving it would be the mistake L-187 was), and anything skipped is said out loud
  with the reason and what to do — no rate on the document, no receivable/payable account for it, no
  unrealized gain/loss account in the chart (never created by the run), the difference already zero,
  a currency whose live rate cannot be fetched (then nothing is posted, rather than a half run).
  Receivables and payables both move with the currency, and the gain/loss account absorbs the whole
  difference in one line; every line is whole cents and the entry balances to exactly zero, so it
  passes `DoubleEntryValidator`. The reversal is the exact negation dated the day after, which is why
  a month-end date is allowed and any other date is refused, and why undoing it early voids the entry
  that was going to reverse it and writes the mirror today (tested: `src/tests/fx-revaluation.test.ts`,
  19 cases). `src/server/services/fxRevaluationService.ts` reads the documents and the rates, wants
  `close`-level rights, will not run for another day, will not run twice for the same one, posts both
  entries in one transaction through the ordinary validators — so a closed period stops it — and writes
  `FX_REVALUATION_POSTED` / `FX_REVALUATION_UNDONE` to the audit log. The Currencies page previews the
  entry before anything is posted, says what it gains or loses and when it reverses, and offers Undo
  (`src/components/finance/FxRevaluationPanel.tsx`, tested in jsdom, `src/tests/fx-revaluation-ui.test.tsx`,
  7 cases). `POST /api/v1/transactions/revaluation/preview|run|undo`; `LF_ENABLE_LEGACY_REVALUATION`
  and the code behind it are gone. `src/tests/fx-revaluation-server.test.ts` checks the same rules
  against the real database and skips itself when there is none (`npm run db:test-setup`). It is NOT
  gated on the `multi_currency_revaluation` Pro flag: that flag is otherwise unused in the app, and
  which pages a plan gets is the owner's commercial call, not something to slip in here.
- [x] R-08 Unposted-drafts review (drafts in the period block the close, listed)
- [ ] R-09 Close comparison
- [x] R-10 Lock by role (close/reopen owner+accountant; hard reopen owner; soft close by role)
- [ ] R-11 Close package export

# SECTION S — NOTIFICATIONS

- [x] S-01 invoice.sent (email to the customer, logged)
- [ ] S-02 invoice.viewed
- [x] S-03 invoice.overdue (daily, once per invoice, workspace date; tested)
- [x] S-04 payment.received (recorded payments and bank-line payments; online card payments with K-11)
- [ ] S-05 payment.failed
- [x] S-06 bank.feed.disconnected (when a bank login expires)
- [ ] S-07 reconciliation.discrepancy
- [ ] S-08 period.close.reminder
- [ ] S-09 approval events
- [ ] S-10 budget.exceeded
- [ ] S-11 cash.low
- [ ] S-12 job.failed
- [ ] S-13 export.ready
- [x] S-14 user.invited / joined
- [ ] S-15 permission.changed
- [ ] S-16 subscription events
- [ ] S-17 transaction.unusual
- [ ] S-18 Digest vs immediate
- [x] S-19 Per-type opt-out (each person, bell → gear)
- [ ] S-20 Push delivery

# SECTION T — TAX DEPTH

- [x] T-01 Compound tax (a part charged on top of the others; tested)
- [x] T-02 Tax groups (a tax code with several parts, e.g. GST + PST; tested)
- [x] T-03 Reverse charge (bill carries no tax; posted as due and reclaimable; boxes 2 and 4; tested)
- [x] T-04 Zero-rated vs exempt (treatment on the tax code; reported separately in the return)
- [ ] T-05 Party exemption certificates
- [x] T-06 Tax return boxes (generic 9-box layout, home currency, credits included; tested)
- [x] T-07 Filed-return copy (server keeps it, once per period, owners/accountants; tested)
- [~] T-08 Late changes: changes after filing are shown box by box with the difference to report; carrying them into the next return automatically is later
- [ ] T-09 MTD / HMRC (UK only)
- [ ] T-10 EC Sales List (EU only)
- [ ] T-11 Intrastat (EU only)
- [ ] T-12 SAF-T (specific markets)
- [ ] T-13 Peppol / UBL (EU only)
- [ ] T-14 Factur-X (FR/DE only)
- [ ] T-15 Avalara / TaxJar (US only)

# SECTION U — PAYROLL LIFECYCLE

- [ ] U-01 Payslip PDF
- [ ] U-02 Payroll journal posting
- [ ] U-03 YTD tracking
- [ ] U-04 PTO accrual
- [ ] U-05 Benefits and deductions
- [ ] U-06 Garnishments
- [ ] U-07 Multiple pay schedules
- [ ] U-08 Contractor vs employee
- [ ] U-09 Direct deposit file
- [ ] U-10 Payroll approval
- [ ] U-11 Timesheet-driven pay

# SECTION V — PROJECTS & TIME

- [ ] V-01 Time entries
- [ ] V-02 Timer
- [ ] V-03 Billable flag
- [ ] V-04 Rate hierarchy
- [ ] V-05 Timesheet approval
- [ ] V-06 Time → invoice line
- [ ] V-07 Project budget vs actual
- [ ] V-08 WIP / POC
- [ ] V-09 Milestone billing

# SECTION W — INVENTORY DEPTH

- [ ] W-01 Stock per location
- [ ] W-02 Stock-moves ledger
- [x] W-03 COGS posting on sale + stock moves with the ledger (tested)
- [x] W-04 Stock count: enter counted quantities for any items; one entry for all differences (tested)
- [x] W-05 Count variance account: chosen per count (default: an expense named shrinkage/adjustment/variance, else Cost of Goods Sold)
- [ ] W-06 Negative-stock policy
- [ ] W-07 Assembly / kitting
- [ ] W-08 Backorder + drop-ship
- [ ] W-09 Aging + slow-moving reports

# SECTION X — FIXED ASSET LIFECYCLE

- [ ] X-01 Asset from a bill
- [ ] X-02 Depreciation schedule report
- [ ] X-03 Disposal with gain/loss
- [ ] X-04 Partial disposal
- [ ] X-05 Asset transfer
- [ ] X-06 Maintenance log
- [ ] X-07 Asset tag / barcode
- [ ] X-08 Warranty / insurance alerts
- [ ] X-09 Construction in progress

# SECTION Y — BANKING · DOCUMENTS · CONTACTS · SETTINGS

- [ ] Y-01 QIF import
- [ ] Y-02 BAI2 import
- [x] Y-03 Saved CSV column map per bank (by header; tested)
- [ ] Y-04 TrueLayer
- [ ] Y-05 GoCardless
- [ ] Y-06 Salt Edge
- [ ] Y-07 Yodlee
- [x] Y-08 Bank feed re-auth flow (reconnect when the bank login expires; tested)
- [x] Y-09 Split one bank line (tested)
- [x] Y-10 Match one bank line to many invoices/bills → payment record (tested)
- [ ] Y-11 PDF template designer
- [x] Y-12 Logo upload (Settings → Branding & PDFs; PNG/JPEG up to 200 KB, checked by the server)
- [x] Y-13 Brand colour on documents (title, rule and table header)
- [x] Y-14 Custom footer / terms (footer on every page, terms at the end, address under the name)
- [x] Y-15 QR code on invoices (to the invoice's payment page once sent; can be switched off)
- [x] Y-16 Watermark: DRAFT, VOID (void/cancelled) and PAID (invoices, bills) stamped across every page of document PDFs; statements and receipts never (tested)
- [x] Y-17 Page numbers ("Page x of y"; long documents run over pages with the table header repeated)
- [x] Y-18 Batch PDF zip: tick invoices or bills in their lists → "Download PDFs (zip)"; up to 100 per zip, only this workspace's documents (tested)
- [ ] Y-19 Print stylesheet
- [ ] Y-20 Digital signature
- [x] Y-21 Multiple contacts per company (people with role, email, phone on the customer/vendor form and page)
- [x] Y-22 Default currency per contact (new invoices and bills start in it; bills got a currency and rate field)
- [x] Y-23 Merge duplicate contacts: "Merge a duplicate" on a customer's or vendor's page (owners/accountants); likely duplicates listed first; the server moves invoices/bills, estimates, credits, payments, schedules and ledger references in one step, no amount changes, details combined, audited (tested)
- [x] Y-24 Contact tags (on the form, shown on the page, filter chips on the customer and vendor lists)
- [x] Y-25 Notes timeline per contact (newest first, who and when; viewers read)
- [ ] Y-26 Portal access toggle
- [x] Y-27 Preferred delivery method: each customer and vendor says how their documents reach them — Email (the default, and what happened before anyone could choose), Print, Post, or Nothing automatic. Set it in the contact form or on the contact's page (viewers read). Only what the app does by itself obeys it: the daily payment reminder, the monthly statement batch and emailing an invoice when it is saved as "sent" — a customer who gets paper is left out of the statements and their reminder is put in the bell for someone to print or post instead. Pressing Email still sends (it is a person deciding) and the send log says "against their choice" (tested)
- [x] Y-28 Statement send preference: Settings → Emails → "Email each customer their statement on the 1st of every month" (customers with something open; the daily job, once a month, a missed 1st made up the next day); each customer's page has "Monthly statement: email it" to leave them out (tested; database rule: customers.noStatements)
- [ ] Y-29 Sending domain with SPF/DKIM
- [ ] Y-30 2FA enforcement policy
- [ ] Y-31 Password policy
- [ ] Y-32 Data region selection
- [x] Y-33 Branding settings page (with "Preview PDF" of unsaved choices; owners and accountants)
- [x] Y-34 Default terms per document type (invoices, estimates, credit notes, statements, receipts)
- [ ] Y-35 Rounding policy setting

# SECTION Z — API · DATA QUALITY · MULTI-ENTITY · INTEGRATIONS

- [ ] Z-01 OpenAPI spec from code
- [ ] Z-02 Per-key rate limits
- [ ] Z-03 Batch create endpoints
- [ ] Z-04 Sparse fieldsets
- [ ] Z-05 ETag
- [ ] Z-06 Client SDK
- [x] Z-07 Duplicate invoice number check
- [x] Z-08 Duplicate vendor bill ref check
- [x] Z-09 Negative inventory check
- [x] Z-10 Future-dated posting check
- [x] Z-11 Non-zero suspense check (suspense, uncategorized and clearing accounts not at zero; Data Health, tested)
- [ ] Z-12 Missing dimension check
- [x] Z-13 Stale unreconciled check (bank lines unmatched over 30 days, one finding per bank account, opens Reconcile; tested)
- [x] Z-14 Empty invoice / accountless line check
- [x] Z-15 FX line with no rate check
- [ ] Z-16 Parent/child entities
- [ ] Z-17 Currency translation rates
- [ ] Z-18 CTA account
- [ ] Z-19 Intercompany matching report
- [ ] Z-20 Entity selector on reports
- [ ] Z-21 Minority interest
- [ ] Z-22 Equity-method investments
- [ ] Z-23 WooCommerce
- [ ] Z-24 Square
- [ ] Z-25 Drive / Dropbox
- [ ] Z-26 Zapier / Make
- [ ] Z-27 HubSpot / Salesforce
- [ ] Z-28 Connection health monitor
- [ ] Z-29 Sync log per integration
- [ ] Z-30 Disconnect with cleanup
- [x] Z-31 Recent items Last ten distinct openRecord references, scoped by user/workspace, persisted locally and reopened through typed links; store and Chromium tests.
- [x] Z-32 Deep links to any record
- [x] Z-33 Grouped search results Search results grouped by kind; transactions/accounts/invoices/bills open typed records. Unicode comparison matches vocalized Hebrew; Chromium and grouping tests. Removed duplicate palette mounting and made the remaining palette a named dialog.
- [ ] Z-34 Web app manifest
- [x] Z-35 44px touch targets Phone buttons, fields and checkbox/radio targets have 44px minimums; compact virtual transaction rows remain at least 44px on phones. Chromium verifies controls, selection, navigation and no page overflow.

# SECTION BA — DISCRETE USER ACTIONS

- [x] BA-01 Merge duplicate contacts dialog (= Y-23)
- [x] BA-02 Vendor opening balance (customers too): on a vendor's or customer's page, type what was owed on the day the books start and press Enter. It becomes one open bill (invoice) booked against Opening Balance Equity (added if missing), so aging, statements and balances include it and it is paid like any other; not counted as sales or expenses (Sales by Item leaves it out); entered once, then shown (tested)
- [ ] BA-03 Allocate landed cost
- [x] BA-04 Inventory adjustment form (= K-13)
- [x] BA-05 Item category management: rename, merge or remove a category on all its items at once (Inventory → Manage categories; tested)
- [x] BA-06 Add-a-currency dialog: invoices and bills offer the home currency, the ones the workspace uses and 35 common world currencies; switching to one fills the exchange rate (the last rate used for it at once, then today's rate from the rate service; never a guessed number; a typed rate is kept) and says where it came from (tested). A Currencies settings page (BB-02) is still open
- [x] BA-07 Numbering per document type: Settings → Document Numbering (prefix, next number, digits, live preview) for invoices, bills, estimates; a number already used is refused, so numbers never repeat; owners/accountants; audited (tested)
- [x] BA-08 PDF preview per document type: purchase orders (branded, with terms from Branding), bills and vendor credits join invoices, estimates, credit notes, receipts and statements; Preview/Download on each list (tested)
- [x] BA-09 Quick payment from a list row (invoice and bill rows open the payment dialog)
- [x] BA-10 Allocate a credit note to an open invoice (tested)
- [x] BA-11 Allocate a vendor credit to an open bill (tested)
- [x] BA-12 Refund a credit note (dialog)
- [x] BA-13 Refund a vendor credit (dialog)
- [ ] BA-14 Notify via SMS
- [x] BA-15 Partial period unlock (date range, reason, close again)
- [ ] BA-16 Branch activate / deactivate
- [ ] BA-17 Money-In / Money-Out dialogs
- [ ] BA-18 Import uncategorised transactions
- [x] BA-19 Branding templates screen (= Y-33)
- [ ] BA-20 Export dialog

# SECTION BB — SETTINGS PAGES

- [ ] BB-01 Categories
- [ ] BB-02 Currencies
- [ ] BB-03 Defaults
- [x] BB-04 Email (Settings → Emails & Reminders: templates, reminders, thank-you emails, monthly statements)
- [ ] BB-05 Localisation
- [ ] BB-06 Schedule (UI over jobRuns)
- [ ] BB-07 Modules
- [x] BB-08 Invoice settings (Settings → Branding & PDFs for logo, colours, footer and terms; Document Numbering; default terms per document type, Y-34)
- [x] BB-09 Settings search: ⌘K finds every screen, report and settings tab, settings also by what they're about ("logo", "invoice number", "2fa"); opens at once (the palette's 0.4 s pause before every action removed) (tested)

# SECTION BC — DASHBOARD WIDGETS

- [ ] BC-01 Configurable widget grid
- [ ] BC-02 Per-role dashboards
- [ ] BC-03 Dashboard date range
- [ ] BC-04 Widget refresh
- [ ] BC-05 Prior-period comparison
- [ ] BC-06 KPI sparklines
- [ ] BC-07 KPI drill-through
- [ ] BC-08 Receivables widget
- [ ] BC-09 Payables widget
- [ ] BC-10 Account balance widget
- [ ] BC-11 Bank feed health widget

# SECTION BD — ACCOUNTANT PERSONA

- [ ] BD-01 Practice view
- [ ] BD-02 Client switcher
- [ ] BD-03 Adjusting-entry flag
- [ ] BD-04 Workpapers
- [ ] BD-05 TB export for tax software
- [ ] BD-06 Client report pack
- [ ] BD-07 Client queries
- [ ] BD-08 Asset register export
- [ ] BD-09 Journal entry templates
- [ ] BD-10 Checklist per client

# SECTION BE — DOCUMENT WORKFLOW

- [x] BE-01 Reminder schedule (daily job; tested)
- [x] BE-02 Thank-you email after payment: Settings → Emails & Reminders switch (off by default); payments recorded by hand, from a bank line or online send the "Payment received (thank you)" email, logged, skipped for bounced addresses; never holds up the payment (tested)
- [x] BE-03 Recurring pause/resume/delete (and recurring invoices now create draft invoices; tested)
- [x] BE-04 Invoice approval: Settings → Emails & Reminders can say that no invoice over a chosen amount may reach the customer until an owner or an accountant signs it off. It holds the **sending**, not the books: the invoice is dated, saved, posted and counted in accounts receivable exactly as before — only the customer receiving it waits. An owner's or accountant's save of an invoice that is going out *is* the signature; anybody else's leaves it waiting, shown under the invoice's state in the list (the amount and the limit in the tooltip), where an approver can Approve it or Send it back with a reason the author then sees. While it waits it is not emailed, not saved as Sent, and not reminded about; approving it puts the reminders back on. An invoice that already went out before the rule existed is left alone, so switching this on never silences reminders for old invoices. The amount is compared in the workspace's currency, using the exchange rate on the invoice, and an invoice of exactly the limit goes out on its own. The gate sits in the app and in the email endpoint, not in the row: it is a rule about documents, not a lock on the data (tested)
- [ ] BE-05 Deposit invoice from estimate — *not built, and this is why (Claude, 5 Oct): an invoice can already carry `depositCents`, and posting it moves that amount out of the Customer Deposits liability against accounts receivable (`src/services/ledgerPost/invoicePosting.ts`, the AF-03 rule) on the assumption the money was booked there when it arrived. Nothing in the app does that first half: recording money that comes in before an invoice exists would have to be a payment, and a payment settles the invoice it points at. So a deposit invoice made from an estimate would count the same money as income twice. What is missing is an advance payment (a Money-In that credits a liability, BA-17's dialogs being the natural home); until then `convertEstimateToInvoice` stays as it is — one draft invoice for the full amount, net-30, declined estimates refused.*
- [x] BE-06 Auto-apply credits: "Apply open credits" on the credit notes screen (all customers or all vendors) and on each customer's or vendor's page: every open credit, oldest first, goes to that contact's open invoices (bills) in the same currency, the one due first first; drafts, voided and paid ones get nothing; one database transaction on the server, audited; no ledger entry (issuing the credit already lowered what is owed) (tested)
- [x] BE-07 Batch statement send: "Email statements" on the customer list: every active customer with something open gets their statement PDF with the new "Customer statement" email (editable in Settings → Emails); no address, nothing open, archived or bounced customers are skipped and listed with the reason; logged per customer; writers only. Also: the statement PDF now reads only that contact's payments, not the whole workspace's (tested)
- [x] BE-08 Recurring expense: a new bill can be set to repeat (every week, month, quarter or year). The daily job makes a draft copy on each date (vendor, lines, tax and currency; not the number or payments), tells the team, and it is posted only when someone checks it and saves it; paused like other schedules on the Recurring screen; once per date (tested)
- [ ] BE-09 Mileage
- [ ] BE-10 Per-diem
- [x] BE-11 PO → bill conversion (purchase orders saved, goods received, "Create bill"; tested)
- [ ] BE-12 Vendor prepayment
- [ ] BE-13 Cheque printing

# SECTION BF — ITEMS · PRICING · STOCK

- [ ] BF-01 Item type
- [ ] BF-02 Customer price overrides
- [ ] BF-03 Item bundles
- [ ] BF-04 Landed cost on receipt
- [ ] BF-05 Consignment stock
- [ ] BF-06 Sales returns / RMA
- [ ] BF-07 Purchase returns
- [ ] BF-08 Partial fulfilment
- [ ] BF-09 Line-level class / location

# SECTION BG — COLLABORATION

- [ ] BG-01 @mention
- [ ] BG-02 Assign a record
- [ ] BG-03 Task list
- [ ] BG-04 Watch a record
- [ ] BG-05 Shared-inbox triage
- [ ] BG-06 Custom status workflows
- [ ] BG-07 Threshold approvals + delegate

# SECTION BH–BP — CURRENCY · COMPLIANCE · OPS

- [x] BH-01 Currency minor-unit divisor
- [ ] BH-02 Storage model decision for 3-decimal currencies
- [x] BH-03 Round-trip test across exponent classes
- [x] BH-04 Other formatters audited — fixed + `money-format-guard` test
- [ ] BI-01 Fund accounting (vertical — recommend not building)
- [ ] BI-02 Grant tracking
- [ ] BI-03 SOA / SOFP
- [ ] BI-04 Form 990
- [ ] BI-05 Job costing
- [ ] BI-06 AIA G702/G703
- [ ] BI-07 Retainage release
- [ ] BI-08 Certified payroll
- [ ] BI-09 IOLTA trust accounts
- [ ] BI-10 Three-way trust reconciliation
- [ ] BI-11 Matter billing
- [ ] BI-12 Rent roll
- [ ] BI-13 Security deposits
- [ ] BI-14 CAM reconciliation
- [ ] BI-15 Restaurant Z-report
- [ ] BI-16 Marketplace settlement
- [ ] BJ-01 SOC 2 evidence export
- [ ] BJ-02 Audit evidence pack
- [ ] BJ-03 Access review report
- [x] BJ-04 Retention per kind of data: docs/privacy/RETENTION.md
- [x] BJ-05 Legal hold: nothing pruned, a deleted workspace is not purged until lifted; audited (tested)
- [x] BJ-06 Personal data inventory: docs/privacy/PERSONAL_DATA.md
- [ ] BJ-07 Breach notification
- [x] BJ-08 Sub-processor list: docs/privacy/SUBPROCESSORS.md
- [x] BJ-09 DPA template: docs/privacy/DPA_TEMPLATE.md (lawyer review before use)
- [ ] BJ-10 ISO 27001 mapping
- [x] BK-01 Generic CSV import (= K-01; columns matched by header name)
- [ ] BK-02 QBO API import
- [ ] BK-03 Wave import
- [ ] BK-04 FreshBooks import
- [x] BK-05 Per-row import errors (row number + problem)
- [x] BK-06 Import rollback (undo; records in use are kept)
- [ ] BK-07 GL to CSV
- [ ] BK-08 Chart of accounts export
- [ ] BK-09 Contacts export
- [ ] BK-10 Full workspace archive
- [ ] BK-11 QIF export
- [ ] BK-12 OFX export
- [x] BL-01 Bounce handling (provider reports → log + suppression)
- [ ] BL-02 Spam complaints
- [x] BL-03 Suppression list (bounced/complained addresses skipped)
- [ ] BL-04 Sender verification
- [x] BL-05 Send log per document (invoice email dialog)
- [ ] BL-06 Resend
- [ ] BL-07 Open / click tracking
- [x] BL-08 Plain-text fallback (every email)
- [ ] BM-01 Symbol placement per locale
- [ ] BM-02 Separators per locale
- [ ] BM-03 Accounting negatives
- [ ] BM-04 Per-currency rounding
- [ ] BM-05 RTL number alignment
- [ ] BM-06 `rateUsedId` per line
- [x] BM-07 `<Money>` component wired
- [ ] BN-01 Structured JSON logging
- [ ] BN-02 Slow-query log
- [ ] BN-03 Usage dashboard
- [ ] BN-04 SLO tracking
- [ ] BN-05 Synthetic uptime
- [ ] BN-06 Alert routing
- [ ] BN-07 Runbooks
- [ ] BO-01 Contextual help per view
- [ ] BO-02 Searchable docs
- [x] BO-03 First-run wizard (= L-19)
- [ ] BO-04 Video walkthroughs
- [ ] BO-05 Feedback widget
- [x] BO-06 Status page link in Help ("Something not working? System status")
- [x] BO-07 Errors name a remedy (describeError: central reporter, payment and write-off dialogs; tested)
- [ ] BO-08 Undo for destructive actions
- [ ] BP-01 Docker compose
- [ ] BP-02 Emulator setup docs
- [ ] BP-03 ADRs
- [ ] BP-04 Storybook
- [ ] BP-05 Visual regression
- [ ] BP-06 Load tests
- [ ] BP-07 Canary rollout
- [ ] BP-08 Mutation testing on money files

# SECTION CA–CG — FROM 12 OPEN-SOURCE PRODUCTS

- [x] CA-01 Payment reconciliation: bank deposit → payment allocated to invoices, line matched
- [x] CA-02 Unreconcile — exists, now role-checked, lock-checked, audited
- [x] CA-03 Repost accounting ledger (check + repost; tested)
- [ ] CA-04 Bank clearance date
- [ ] CA-05 Finance books
- [ ] CA-06 Closing balance snapshots
- [ ] CA-07 Period closing voucher
- [ ] CA-08 Opening invoice tool
- [ ] CA-09 Advance payment ledger
- [ ] CA-10 Transaction deletion record
- [x] CA-11 Import log (recent imports from the audit log)
- [x] CA-12 Saved column map (= Y-03)
- [ ] CA-13 Bank transaction rules with conditions
- [ ] CA-14 Bank guarantee
- [ ] CA-15 Cheque print template
- [ ] CA-16 Item tax template
- [ ] CA-17 Tax rule engine
- [ ] CA-18 Withholding category
- [ ] CA-19 TDS summary
- [ ] CA-20 Tax category per party
- [ ] CA-21 Pricing rules
- [ ] CA-22 Coupons
- [ ] CA-23 Loyalty
- [ ] CA-24 Shipping rules
- [ ] CA-25 Seasonal budget distribution
- [ ] CA-26 Cost centre allocation %
- [ ] CA-27 JE templates
- [ ] CA-28 Mode of payment
- [ ] CA-29 Party link
- [ ] CA-30 Payment request
- [ ] CA-31 Payment order
- [ ] CA-32 Ledger health monitor
- [ ] CA-33 Ledger merge
- [ ] CA-34 Bisect accounting statements
- [ ] CA-35 Invalid ledger entries
- [ ] CA-36 Process deferred accounting
- [ ] CB-01 Customer ledger summary
- [ ] CB-02 Supplier ledger summary
- [ ] CB-03 Trial balance for party
- [ ] CB-04 Payment period by invoice date
- [ ] CB-05 Voucher-wise balance
- [ ] CB-06 Account balance
- [ ] CB-07 Gross profit
- [ ] CB-08 Profitability analysis
- [ ] CB-09 Financial ratios
- [ ] CB-10 Sales trends
- [ ] CB-11 Purchase trends
- [ ] CB-12 Item-wise sales register
- [ ] CB-13 Item-wise purchase register
- [ ] CB-14 Inactive items
- [ ] CB-15 Partner commission
- [ ] CB-16 Deferred revenue & expense
- [ ] CB-17 Billed not received
- [ ] CB-18 Delivered not billed
- [ ] CB-19 Received not billed
- [ ] CB-20 Invalid ledger entries report
- [ ] CB-21 Incorrectly cleared cheques
- [ ] CB-22 Discount mismatch
- [ ] CB-23 GL vs payment ledger
- [ ] CB-24 Bank clearance summary
- [ ] CB-25 Dimension-wise balance
- [ ] CB-26 Consolidated TB
- [ ] CB-27 Asset depreciation ledger
- [ ] CB-28 POS register
- [ ] CB-29 Sales payment summary
- [ ] CC-01 Per-recipient invitation links + view tracking
- [ ] CC-02 Design templates
- [ ] CC-03 Proposals
- [ ] CC-04 Recurring quotes
- [ ] CC-05 Recurring expenses
- [ ] CC-06 Gateway tokens
- [ ] CC-07 Multiple gateways
- [ ] CC-08 Payment terms entity
- [ ] CC-09 Payment types entity
- [ ] CC-10 Expense categories
- [ ] CC-11 Client-group settings
- [ ] CC-12 Passkeys
- [ ] CC-13 User-defined scheduler
- [ ] CC-14 Tasks + statuses
- [ ] CC-15 E-invoicing log
- [ ] CC-16 System log
- [ ] CD-01 Scheduled transactions
- [ ] CD-02 Undo / redo
- [ ] CD-03 Query language
- [ ] CD-04 Formula engine
- [ ] CD-05 E2E encryption
- [ ] CD-06 Notes on any entity
- [ ] CD-07 Account groups
- [ ] CE-01 Account subtypes
- [ ] CE-02 Holdings
- [ ] CE-03 Securities + prices
- [ ] CE-04 Trades with cost basis
- [ ] CE-05 Market data importer
- [ ] CE-06 Rejected-transfer detection
- [ ] CE-07 Impersonation session
- [ ] CE-08 Invite codes
- [ ] CE-09 Competitor import
- [ ] CE-10 Mobile device registration
- [ ] CF-01 Timesheet entity
- [ ] CF-02 Activity under project
- [ ] CF-03 Rate hierarchy
- [ ] CF-04 Working time / capacity
- [ ] CF-05 Per-user bookmarks
- [ ] CF-06 Export templates
- [ ] CF-07 Comments on customer / project
- [ ] CF-08 Meta fields on any entity
- [ ] CG-01 Custom field entities
- [ ] CG-02 Unit of measure
- [ ] CG-03 Payment method entity
- [ ] CG-04 Exchange rate provider + log
- [ ] CG-05 File disk abstraction
- [ ] CG-06 Teams
- [ ] CG-07 Role permissions as data
- [ ] CG-08 Granular RBAC
- [ ] CG-09 Promotion engine
- [ ] CG-10 Region entity
- [ ] CG-11 Sales channel
- [ ] CG-12 Stock location
- [ ] CG-13 Workflow engine
- [ ] CG-14 Locking module
- [ ] CG-15 Translation module
