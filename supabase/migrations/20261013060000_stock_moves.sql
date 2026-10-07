-- The stock-moves ledger (W-02): one row for every change to an item's quantity on hand, written by
-- the server in the same database transaction as the change and its ledger entry.
-- - Sales and reversals: src/server/services/cogsStockService.ts.
-- - Purchases, opening stock, adjustments and counts: stockAdjustmentService.ts.
-- - Imported opening stock: recordImportService.ts.
-- - The manual cost-of-goods-sold entry: inventoryRoutes.ts.
-- Each row keeps the quantity before and after, so the history explains the item's quantity and
-- the nightly check can say when they disagree. Members read it; nobody writes it from the browser.

create table public."stockMoves" (
  id text primary key
    check (char_length(id) between 1 and 200 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists "stockMoves_ws_idx" on public."stockMoves" (workspace_id);
create index if not exists "stockMoves_item_idx" on public."stockMoves" (workspace_id, (data->>'itemId'), (data->>'seq'));
alter table public."stockMoves" enable row level security;

-- no browser writes (no insert/update/delete policies); the row exists for the guard trigger
insert into public.lf_rules (table_name) values ('stockMoves') on conflict (table_name) do nothing;
drop trigger if exists lf_guard on public."stockMoves";
create trigger lf_guard before insert or update or delete on public."stockMoves"
  for each row execute function public.lf_guard();

drop policy if exists member_read on public."stockMoves";
create policy member_read on public."stockMoves" for select to authenticated
  using (public.lf_is_member(workspace_id));

grant select on public."stockMoves" to authenticated;
revoke all on public."stockMoves" from anon;
