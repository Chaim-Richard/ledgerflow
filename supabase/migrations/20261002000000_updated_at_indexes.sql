-- Live lists in the browser fetch only rows changed since the last fetch
-- (src/lib/db/liveQuery.ts: workspace_id = $1 and updated_at > $2 order by updated_at).
-- These indexes keep that query cheap on the large tables.
create index if not exists "transactions_ws_updated_idx" on public."transactions" (workspace_id, updated_at);
create index if not exists "chartAccounts_ws_updated_idx" on public."chartAccounts" (workspace_id, updated_at);
create index if not exists "invoices_ws_updated_idx" on public."invoices" (workspace_id, updated_at);
create index if not exists "bills_ws_updated_idx" on public."bills" (workspace_id, updated_at);
create index if not exists "payments_ws_updated_idx" on public."payments" (workspace_id, updated_at);
create index if not exists "bankLines_ws_updated_idx" on public."bankLines" (workspace_id, updated_at);
create index if not exists "customers_ws_updated_idx" on public."customers" (workspace_id, updated_at);
create index if not exists "vendors_ws_updated_idx" on public."vendors" (workspace_id, updated_at);
create index if not exists "creditNotes_ws_updated_idx" on public."creditNotes" (workspace_id, updated_at);
create index if not exists "vendorCredits_ws_updated_idx" on public."vendorCredits" (workspace_id, updated_at);
create index if not exists "estimates_ws_updated_idx" on public."estimates" (workspace_id, updated_at);
create index if not exists "journalEntries_ws_updated_idx" on public."journalEntries" (workspace_id, updated_at);
create index if not exists "inventory_ws_updated_idx" on public."inventory" (workspace_id, updated_at);
create index if not exists "auditLogs_ws_updated_idx" on public."auditLogs" (workspace_id, updated_at);
