-- Recovery codes for two-step login (L-85): one row per person (id = their user id) with the keyed
-- hashes of their one-time codes and which were used. Read and written only by the server
-- (src/server/services/recoveryCodeService.ts); nobody reaches it from the browser.

create table public."recoveryCodes" (
  id text primary key
    check (char_length(id) between 1 and 200 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public."recoveryCodes" enable row level security;
revoke all on public."recoveryCodes" from anon, authenticated;

-- known to the server's data layer; still no browser access (lf_set runs with the caller's rights,
-- and there are no policies or grants)
insert into public.lf_rules (table_name) values ('recoveryCodes');
