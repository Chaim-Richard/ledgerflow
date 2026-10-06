-- Client queries (BD-07): a question about an entry ("what was this?") and its answer, between the
-- bookkeeper or accountant and the owner. Written only by the server (src/server/services/clientQueryService.ts:
-- who may ask, answer or close, notifications, audit); members read them.

create table public."clientQueries" (
  id text primary key
    check (char_length(id) between 1 and 200 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index "clientQueries_ws_idx" on public."clientQueries" (workspace_id);
alter table public."clientQueries" enable row level security;

-- no browser writes (no insert/update/delete policies); the row exists for the guard trigger
insert into public.lf_rules (table_name) values ('clientQueries');
create trigger lf_guard before insert or update or delete on public."clientQueries"
  for each row execute function public.lf_guard();

create policy member_read on public."clientQueries" for select to authenticated
  using (public.lf_is_member(workspace_id));

grant select on public."clientQueries" to authenticated;
revoke all on public."clientQueries" from anon;

-- the Questions screen updates live
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public."clientQueries";
  end if;
end $$;
