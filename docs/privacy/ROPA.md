# Record of processing activities (L-11)

The register GDPR Article 30 asks for, in two parts: what LedgerFlow does as a **controller**
(its own users' accounts) and as a **processor** (the books a workspace keeps about its
customers, vendors and employees). Written from the code; the details behind each row are in
[PERSONAL_DATA.md](PERSONAL_DATA.md) (what and where), [RETENTION.md](RETENTION.md) (how long)
and [SUBPROCESSORS.md](SUBPROCESSORS.md) (who else). Review it whenever one of those changes.

**Before real customers:** fill in the company details below and have it checked by someone who
knows the law where you operate. This is a working draft, not legal advice.

## Who

| | |
|---|---|
| Controller / processor | *(your company name, address, registration number)* |
| Contact for privacy questions | *(email address)* |
| Representative in the EU / UK | *(only if the company is outside them and serves people there)* |
| Data protection officer | *(only if required; usually not for a company this size)* |

## Part 1 — LedgerFlow as controller

| Activity | Purpose | Legal basis | People | Personal data | Recipients | Transfers outside the EEA | Kept | Security |
|---|---|---|---|---|---|---|---|---|
| Accounts and sign-in | Let people sign in and keep their account safe | Contract | Users | Email, password hash, sessions, two-step login secret | Supabase (auth) | US (Supabase): standard contractual clauses | Until the account is deleted | Hashing, two-step login, row level security |
| Workspace membership and roles | Decide who sees and changes which books | Contract | Users | Name, email, role per workspace | Other members of the same workspace | US (Supabase) | While the membership exists | Roles checked in the database and on the server |
| Sign-in history | Detect misuse of accounts | Legitimate interest (security) | Users | Time, device/browser of each sign-in | — | US (Supabase) | Until the account is deleted | Readable only by the user |
| Audit trail | Show who did what in the books | Legal obligation (accounting records) and legitimate interest | Users | User id, email, action, time | Owners/accountants of that workspace | US (Supabase) | Permanently (FOR_YOU item 16) | Written by the server only; nobody can edit it |
| Notifications and emails to users | Tell users about invites, payments, overdue invoices | Contract | Users | Email, notification text | Email provider (when set up) | US/EU (provider) | Read 60 days, all 180 days | Per-user, opt-out per type |
| Error reports | Find and fix bugs | Legitimate interest | Users | Page, browser, error message (no form contents or secrets) | — | US (Supabase) | With the workspace | Secrets stripped before saving |
| Subscription billing | Charge for LedgerFlow | Contract | Paying users | Email, plan, payment status (card details stay at Stripe) | Stripe | US/EU (Stripe) | As long as tax law requires invoices to be kept | Card data never reaches LedgerFlow |
| AI features | Read receipts, suggest categories, answer questions | Contract (only when the user uses the feature) | Users, and people named in the sent text or file | Whatever the user sends to the feature | Google (Gemini API) | US (Google) | Not stored by LedgerFlow beyond the answer | Login, workspace check, per-request scope |

## Part 2 — LedgerFlow as processor (for each workspace)

The workspace owner is the controller; LedgerFlow processes on their instructions under the DPA
([DPA_TEMPLATE.md](DPA_TEMPLATE.md)).

| Processing | People | Personal data | Sub-processors | Transfers outside the EEA | Kept | Security |
|---|---|---|---|---|---|---|
| Keeping the books (invoices, bills, payments, credits, contacts) | Customers, vendors and their contacts | Names, emails, phones, addresses, tax ids, amounts | Supabase, Vercel | US: standard contractual clauses | While the workspace exists; purged 30 days after it is deleted | Row level security per workspace, roles, period locks |
| Sending invoices and reminders | Customers | Email, invoice content, delivery status | Email provider | US/EU | Delivery log with the workspace | Bounces and complaints suppress further sending |
| Online payment of invoices | Customers | Email, amount (card at Stripe) | Stripe | US/EU | With the workspace | Payment links per invoice, webhook signatures checked |
| Bank feeds and statement import | Account holders, counterparties | Bank account, statement lines | Plaid (feeds) | US | With the workspace; bank tokens deleted with the connection or workspace | Tokens encrypted with `SYSTEM_SALT` |
| Payroll | Employees | Name, salary, deductions, pay runs | Supabase, Vercel | US | With the workspace | Owner/accountant only |
| Backups and exports | Everyone in the books | All of the above | — (downloaded by the owner) | Wherever the owner keeps it | Owner's responsibility | Owners only |

## People's rights — how each is handled

| Right | How |
|---|---|
| Access, portability | Settings → Security → "Download my data"; the books: workspace backup (owners) |
| Rectification | Users edit their profile; workspaces edit their contacts |
| Erasure | Settings → Security → "Delete account"; "Delete workspace" (30 days). The audit trail stays (legal record) |
| Objection, restriction | By email to the privacy contact above; handled by hand |
| Requests about a workspace's customers or employees | Passed to that workspace's owner (the controller) |
