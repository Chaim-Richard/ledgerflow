# Retention (BJ-04)

How long each kind of data is kept, as the code does it today. Decisions still open are in
`docs/FOR_YOU.md` (items 15–16).

| Data | Kept | Then |
|---|---|---|
| The books (entries, invoices, bills, payments, contacts, items, bank lines…) | While the workspace exists | Deleted 30 days after the workspace is deleted (`workspacePurgeService.ts`, every table: guard test `workspace-purge-db.test.ts`) |
| A deleted workspace | 30 days (an owner can keep it: banner "Keep this workspace") | Purged |
| Audit trail (`auditLogs`) | Permanently, also after the workspace is purged | — (legal record of the books; FOR_YOU item 16) |
| Filed tax returns (`taxReturns`) | With the workspace; a backup restore never removes them | Purged with the workspace |
| Notifications | Read ones 60 days, all 180 days (`pruneNotifications`) | Deleted daily |
| Personal data of a deleted account (profile, templates, notifications, sign-in log) | Until the account is deleted | Deleted at once (`accountDeletionService.ts`) |
| Browser error reports (`errorLogs`) | With the workspace | Purged with the workspace |
| Backups downloaded by owners | Outside LedgerFlow (the owner's own copy) | — |

Countries' rules on keeping accounting records (often 5–10 years) apply to the workspace's
owner; LedgerFlow keeps the books as long as the workspace exists.
