# Personal data in LedgerFlow (BJ-06)

What LedgerFlow stores about people, where, why, and for how long. Written from the code
(`supabase/migrations`, `src/server`); update it when a table or field holding personal data is
added. Retention rules are in [RETENTION.md](RETENTION.md); outside services in
[SUBPROCESSORS.md](SUBPROCESSORS.md).

## People who use LedgerFlow (users)

| Data | Where | Why |
|---|---|---|
| Email, password hash, sign-in sessions, two-step login secret | Supabase Auth (`auth` schema) | Signing in |
| Profile (name, settings) | `users` table | Showing who did what; preferences |
| Membership and role per workspace | `workspaces.members`, `workspaces.roles` | Access control |
| Sign-in history (time, device) | `loginAudits` | Security |
| Actions (who changed which record, when) | `auditLogs` | Legal audit trail of the books |
| Notifications | `notifications` | Telling people about invoices, payments, invites |
| Errors seen in the browser (page, browser, message without secrets) | `errorLogs` | Fixing bugs |

## People in a workspace's books (customers, vendors, employees)

Entered by the workspace; the workspace is the controller, LedgerFlow the processor.

| Data | Where |
|---|---|
| Customer and vendor names, emails, phones, addresses, tax ids | `customers`, `vendors` |
| Names and amounts on invoices, bills, payments, credit notes | `invoices`, `bills`, `payments`, `creditNotes`, `vendorCredits` |
| Bank statement lines (counterparty names, amounts) | `bankLines` |
| Employees and pay (salary, deductions) | `employees`, `payRuns` |
| Emails sent and their delivery status | `emailEvents` |
| Bank connection tokens (Plaid) | `banks` |

## Rights requests

- **Access / portability:** Settings → Security → "Download my data" (profile, workspaces and
  roles, notifications, sign-ins, own audit entries). The books: workspace backup (owners).
- **Erasure:** Settings → Security → "Delete account" (personal data and sign-in; workspaces only
  that person uses are deleted after 30 days; shared books stay with their other owners). A
  workspace's own data: "Delete workspace" (purged after 30 days).
- **Kept after erasure:** the audit trail (who did what in the books) — see RETENTION.md.
