-- EG-3: the period-closing document (docs/design/EG-3-period-closing.md). One immutable record per workspace,
-- year end and version (id `<workspaceId>_<yearEnd>_v<n>`), written only by the server
-- (src/server/services/periodClosingService.ts): `/close-year` with the lock writes it in the same transaction
-- that moves the lock date and writes the L-123 snapshot. It holds the year's profit and loss per account, the
-- transfer to retained earnings as figures (no journal entry is posted: CA-07), the balance-sheet totals at the
-- year end, the snapshot checksum, the lock date and who closed it. Reopening the year marks it superseded (the
-- only change the server ever makes to it); the next close writes the next version.
-- Members read it; nobody writes it from the browser (RLS like periodBalances).

create table public."periodClosings" (
  id text primary key
    check (char_length(id) between 1 and 200 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists "periodClosings_ws_idx" on public."periodClosings" (workspace_id, (data->>'yearEnd'));
alter table public."periodClosings" enable row level security;

-- no browser writes (no insert/update/delete policies); the row exists for the guard trigger
insert into public.lf_rules (table_name) values ('periodClosings') on conflict (table_name) do nothing;
drop trigger if exists lf_guard on public."periodClosings";
create trigger lf_guard before insert or update or delete on public."periodClosings"
  for each row execute function public.lf_guard();

drop policy if exists member_read on public."periodClosings";
create policy member_read on public."periodClosings" for select to authenticated
  using (public.lf_is_member(workspace_id));

grant select on public."periodClosings" to authenticated;
revoke all on public."periodClosings" from anon;
