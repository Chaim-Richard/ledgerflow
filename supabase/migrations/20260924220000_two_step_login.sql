-- Two-step login: once a user has a verified authenticator app (TOTP), a session that has
-- only passed the password step (aal1) can't read or write anything; the session must be
-- verified with a code first (aal2). Anonymous users and users without an authenticator
-- are unaffected. The same rule is checked by the server's token check.

create or replace function public.lf_mfa_ok() returns boolean
language sql stable security definer set search_path = ''
as $$
  -- The uuid cast sits inside a CASE so a non-uuid subject becomes NULL (no match) even when
  -- the planner evaluates the expression early for its estimates.
  select case
    when coalesce(public.lf_claims()->>'aal', 'aal1') = 'aal2' then true
    else not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = (case when public.lf_uid() ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                              then public.lf_uid() end)::uuid
        and f.factor_type::text = 'totp'
        and f.status::text = 'verified')
  end
$$;

revoke execute on function public.lf_mfa_ok() from public, anon;
grant execute on function public.lf_mfa_ok() to authenticated;

-- A restrictive policy on every table: ANDed with the existing policies. The (select ...)
-- makes Postgres evaluate it once per statement, not once per row.
do $$
declare t text;
begin
  for t in select table_name from public.lf_rules loop
    execute format(
      'create policy two_step_login on public.%I as restrictive for all to authenticated '
      'using ((select public.lf_mfa_ok())) with check ((select public.lf_mfa_ok()))', t);
  end loop;
end $$;
