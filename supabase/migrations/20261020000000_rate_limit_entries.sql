-- S-01: Shared rate limiter table
-- Rate limit entries for Postgres-backed rate limiting that works across all server instances.
-- Each entry tracks request counts for a specific key (IP, API key, user) and shard.

create table public.rateLimitEntries (
  id text primary key
    check (char_length(id) between 1 and 127 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rateLimitEntries_ws_idx on public.rateLimitEntries (workspace_id);
create index rateLimitEntries_key_idx on public.rateLimitEntries ((data->>'key'));
create index rateLimitEntries_shard_idx on public.rateLimitEntries ((data->>'shardId'));
create index rateLimitEntries_window_idx on public.rateLimitEntries ((data->>'windowStart'));

alter table public.rateLimitEntries enable row level security;

-- RLS policies for rateLimitEntries
-- Only the service role (server) can read/write rate limit entries
create policy "rateLimitEntries: service role full access"
  on public.rateLimitEntries
  for all
  using (public.lf_is_platform_admin() = true);

-- Insert into lf_rules for guard trigger
insert into public.lf_rules (table_name, allowed_keys, immutable_keys, dated, delete_draft_only)
values ('rateLimitEntries', array['key', 'shardId', 'count', 'windowStart', 'workspaceId'], array['workspaceId'], false, false)
on conflict (table_name) do nothing;
