-- Filed tax returns (T-07): a copy that never changes of the return for a period, written only by
-- the server (src/server/services/taxReturnService.ts). Members read them.

create table public."taxReturns" (
  id text primary key
    check (char_length(id) between 1 and 200 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index "taxReturns_ws_idx" on public."taxReturns" (workspace_id);
alter table public."taxReturns" enable row level security;

-- no browser writes (no insert/update/delete policies); the row exists for the guard trigger
insert into public.lf_rules (table_name) values ('taxReturns');
create trigger lf_guard before insert or update or delete on public."taxReturns"
  for each row execute function public.lf_guard();

create policy member_read on public."taxReturns" for select to authenticated
  using (public.lf_is_member(workspace_id));

grant select on public."taxReturns" to authenticated;
revoke all on public."taxReturns" from anon;
