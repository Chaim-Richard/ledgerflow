-- S-01: server-only, persistent rate-limit counters.
-- Note: pgFirestore discovers tables exclusively through lf_rules. Register the
-- collection WITHOUT any browser RLS policies, triggers, or browser grants.
create table public."rateLimitEntries" (
  id text primary key
    check (char_length(id) between 1 and 127 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index "rateLimitEntries_window_idx"
  on public."rateLimitEntries" (((data->>'windowStart')::bigint));
create index "rateLimitEntries_workspace_idx" on public."rateLimitEntries" (workspace_id);

alter table public."rateLimitEntries" enable row level security;
revoke all on public."rateLimitEntries" from anon, authenticated;

-- A table listed here is accessible to the SERVER adapter, not automatically
-- to browser clients. Without a policy the authenticated/anon roles are denied.
insert into public.lf_rules (table_name, allowed_keys, immutable_keys) values
  ('rateLimitEntries', '{keyHash,count,windowStart,workspaceId}', '{workspaceId}');
