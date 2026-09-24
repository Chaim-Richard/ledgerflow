-- Makes a plain Postgres look enough like Supabase to run the migrations and RLS tests
-- (used by the local/CI RLS test suite; Supabase itself already has these roles).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;

-- The parts of Supabase's auth schema the server reads and writes (src/server/auth/supabaseAuth.ts).
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email varchar(255),
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_sign_in_at timestamptz,
  deleted_at timestamptz
);
create table if not exists auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now()
);
