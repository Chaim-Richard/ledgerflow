-- Groups of books (DA-01): a person's own grouping of the workspaces they can open (holding
-- structures, related companies, an accountant's clients), the base for moving between them and,
-- later, for reports across them (Z-16). A group has a stable id, a name, its owner and its members.
-- Belonging to a group changes nothing in a workspace: not its ledger, roles or rules. Only the
-- server writes groups (src/server/services/workspaceGroupService.ts), adding only workspaces the
-- owner can open; the owner reads their own. A member the owner can no longer open is left out when
-- the group is read, so it stays invisible.

create table public."workspaceGroups" (
  id text primary key
    check (char_length(id) between 1 and 200 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists "workspaceGroups_owner_idx" on public."workspaceGroups" ((data->>'ownerUid'));
alter table public."workspaceGroups" enable row level security;

-- no browser writes (no insert/update/delete policies); the row exists for the guard trigger
insert into public.lf_rules (table_name) values ('workspaceGroups') on conflict (table_name) do nothing;
drop trigger if exists lf_guard on public."workspaceGroups";
create trigger lf_guard before insert or update or delete on public."workspaceGroups"
  for each row execute function public.lf_guard();

drop policy if exists own_read on public."workspaceGroups";
create policy own_read on public."workspaceGroups" for select to authenticated
  using (data->>'ownerUid' = public.lf_uid());

grant select on public."workspaceGroups" to authenticated;
revoke all on public."workspaceGroups" from anon;
