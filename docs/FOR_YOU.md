# For you: things only you can do or decide

Claude keeps working while these wait. It never stops to wait for an answer: where a decision
is needed, it takes the default written below and moves on. When you have time, answer as many
as you like in one message, e.g. **"1 done, 4 yes, 11 hide, 10 keep Hebrew"**. Answered items are
removed from this list.

Last updated: 2026-10-02.

## A. Settings only you can change (a few minutes each)

0. **Most important: let database changes go through without you (1 minute).** Open
   https://claude.ai/customize/connectors → **Supabase** → tool permissions → set
   `apply_migration`, `execute_sql` and `list_migrations` to **Always allow**.
   *Why:* these tools ask you to approve every single time, and while an approval is waiting
   the whole session stops. That is what paused work from 26 to 28 September. Until you do
   this, Claude calls them as rarely as possible, and the 5-hour check-in cancels any
   approval that is still waiting so work carries on.
   *Both waiting changes (`tax_returns`, `updated_at_indexes`) were applied on 2 Oct while you were here.*
1. **Sign-in addresses (Supabase).** supabase.com → project *ledgerflow* → Authentication → URL
   Configuration. Site URL: `https://ledgerflow-one-pearl.vercel.app`. Redirect URLs: add
   `https://ledgerflow-one-pearl.vercel.app/**` and `http://localhost:3000/**`.
   Without it, sign-up confirmation and password-reset emails link to the wrong place.
2. **Replace the four secrets Claude generated** (Vercel → project ledgerflow → Settings →
   Environment Variables): `SESSION_SECRET`, `INVITE_SECRET`, `CRON_SECRET`, `SYSTEM_SALT`.
   Put in long random values of your own. **Do `SYSTEM_SALT` before any bank is connected
   with Plaid**: it encrypts the stored bank tokens, and changing it later disconnects banks.
3. **Try sign-up on the live site** and tell Claude what happened (email arrived? could you log
   in and create a workspace?).
4. **Deployment protection (Vercel).** Right now only people logged in to your Vercel account
   can open the site. Before customers: Vercel → Settings → Deployment Protection → turn off for
   Production (or add your own domain). *Default meanwhile: leave it on.*
5. **Email sender (Supabase).** The built-in sender only sends a few emails per hour. Before real
   users: Authentication → Emails → SMTP Settings (e.g. Resend, Postmark, SendGrid).
6. **Database certificate.** Supabase → Database → SSL: download the certificate and paste it in
   Vercel as `DATABASE_CA_CERT`, so the server checks it is really talking to your database.
7. **Email sending (needed for invoices and reminders by email).** Pick a provider (Resend is the
   simplest), then in Vercel → Environment Variables add `RESEND_API_KEY` and `EMAIL_FROM`
   (e.g. `invoices@yourdomain.com`, a domain you verified with the provider). For bounce reports,
   also add `EMAIL_WEBHOOK_SECRET` (any long random text) and in the provider's webhook settings
   use `https://ledgerflow-one-pearl.vercel.app/api/v1/email-events?token=<that secret>`.
   *Until then, "Email invoice" says email is not set up yet.*
8. **Stripe (customers pay invoices online by card) — 2 steps left.** Claude connected your Stripe
   *sandbox* ("terranex sandbox", test mode: no real money): the webhook that tells LedgerFlow an
   invoice was paid exists and its secret is saved in Vercel (`STRIPE_WEBHOOK_SECRET`).
   Stripe never shows secret keys to Claude, so you copy two keys: Stripe dashboard (sandbox) →
   Developers → API keys. In Vercel → Environment Variables set `STRIPE_SECRET_KEY` = the
   **Secret key** (`sk_test_…`) and `VITE_STRIPE_PUBLIC_KEY` = the **Publishable key** (`pk_test_…`).
   Payments reach LedgerFlow only once item 4 (deployment protection) is off. Later, for real
   money, the same with the live keys. Other optional keys (currency rates, tax): tell Claude
   which ones you want. Plaid (bank feeds): Claude has no Plaid connection; the `PLAID_*` values
   in Vercel must come from your Plaid dashboard (use the sandbox first).
9. **Old settings to delete** in Vercel (unused since the move to Supabase): `FIREBASE_PROJECT_ID`,
   `SQL_*`, `JWT_SECRET`.

17. **Privacy papers (before real customers, 15 minutes + a lawyer).** Put your company name,
   address and privacy email into `docs/privacy/ROPA.md` and `docs/privacy/DPA_TEMPLATE.md`
   (Claude wrote everything else from the code), then have someone who knows the law where you
   operate read them.

## B. Decisions (Claude uses the default until you say otherwise)

10. **Hebrew data — decided by owner (2 Oct).** Keep menus and options in English. The system and algorithms must handle Hebrew and mixed Hebrew/English names, labels, item descriptions and other record text throughout search/matching, imports/exports and documents. This is data-language support, not a request to translate the interface. Codex is auditing it after C-6…C-11; existing financial rules must stay intact.
11. **Demo and fake features.** Some screens and endpoints return made-up data (the "API Hub" demo
    endpoints for e-commerce/marketing/HR, the Admin "command center" with simulated logs).
    Delete them, or keep them behind a "developer" switch? *Default: hide them behind a
    developer switch when Claude gets to the clean-up step.* **Done (2 Oct):** the fake API endpoints are deleted (they answered "success" to API-key users without doing anything); the Admin Panel with simulated logs shows only with Settings → Developer → Developer switch on.
12. **Which country's tax rules first?** (VAT/GST return boxes, reverse charge, US sales tax…)
    *Default: generic rules that work anywhere (tax groups, compound tax, zero-rated vs exempt,
    reverse charge, configurable return boxes).*
13. **Deposits on invoices.** Is a deposit a payment in advance (tax on the full invoice; the
    deposit only lowers the amount still due) or a discount? *Default: payment in advance
    (normal practice).* **Built that way (2 Oct).** Record the deposit money to a "Customer
    Deposits" liability account when it arrives; the invoice then moves it against what the
    customer owes. An invoice with a deposit needs that account (it says so if missing).
14. **Dependency updates** (the open Dependabot pull requests on GitHub). *Default: Claude
    applies the safe updates directly on `main` during the trust & compliance step and closes
    the PRs they replace; the big ones (Plaid 47) wait until a feature needs them.*

15. **Restoring a backup after closing months.** A backup can't replace closed periods: once any month is closed, restore is refused (reopen first). *Default: refuse.* Say if you prefer "restore only the months after the lock date".

16. **Audit trail after a workspace is deleted.** The workspace's data is deleted after 30 days, but its audit trail is kept (it is the legal record of who did what). *Default: keep it.* If you want it deleted after a number of years, say how many.

17. **The "LATER" pile (about 480 of the open items).** They came from comparing LedgerFlow with
   12 big products (payroll extras, industry add-ons, extra reports, integrations…). Doing all of
   them one by one takes weeks. *Default: Claude finishes the QUALITY items, then builds the LATER
   items most small businesses use daily (data checks, everyday reports, invoice extras) and leaves
   the niche ones until a customer asks.* Say "do them all" or name the ones you want first.
18. **Go faster: run Codex alongside Claude (updated 5 Oct).** Codex's last branch (C-9 file splits,
   C-10 tests, Hebrew data) is merged into main. Three new tasks are waiting for it in
   docs/COORDINATION.md (C-12 file splits, C-13 report columns, C-14 everyday screen comforts), chosen
   so they don't touch the files Claude is working in. Start it in the Codex app with the usual prompt
   ("Read AGENTS.md and docs/COORDINATION.md. Do the next task…"). Both now run the slow browser tests
   only every ~5 changes (your suggestion); GitHub runs everything on every push.

## C. Good to know (no action needed)

- **Keyboard shortcuts changed (2 Oct)** so they no longer take the browser's own keys: Quick entry
  ⌘⇧E (was ⌘Q, which quits the browser on a Mac), Focus mode ⌘⇧F (⌘F is find again), Reports ⌘4
  (⌘P prints again). Press **?** to see them all.

- **New (3 Oct): Settings → Branding & PDFs.** Add your logo, colour, address, a footer (bank
  details) and the terms printed on invoices, estimates and receipts; "Preview PDF" shows a sample.
  Invoice PDFs now print every line (they stopped at 15), run over several pages with page numbers,
  show Hebrew names correctly, and carry a QR code to the payment page once the invoice is sent.
- **New reports (3 Oct):** Contact Balance Summary, Inventory Valuation, Transactions by Reference,
  and "Tax by rate" on the Sales Tax screen. Data Health also flags money left in suspense or
  clearing accounts and bank lines unmatched for over 30 days.
- Vercel deploys by itself about a minute after each push to `main`.
- Database changes are applied to Supabase by Claude and tested on a local copy first.
- Progress and the full list: [TRACKER.md](TRACKER.md).
