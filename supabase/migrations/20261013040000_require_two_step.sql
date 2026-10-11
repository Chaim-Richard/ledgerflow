-- Y-30: an owner can require two-step login for everyone in a workspace (`requireTwoStep` on the
-- workspace, set only by the server). Then a password-only (aal1) session of anyone who belongs
-- to that workspace can't read or write anything, whether or not they have an authenticator yet:
-- they set one up first (the app shows them how). Users in no such workspace are unaffected, as
-- before. The server's token check applies the same rule.

create or replace function private.lf_mfa_ok() returns boolean
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
    and not exists (
      select 1 from public.workspaces w
      where (w.data->>'requireTwoStep') = 'true'
        and (w.data->>'uid' = public.lf_uid()
             or jsonb_typeof(w.data->'roles'->public.lf_uid()) = 'string'
             or (w.data->'admins'->public.lf_uid()) = 'true'::jsonb
             or coalesce(w.data->'members', '[]'::jsonb) ? public.lf_uid()))
  end
$$;

-- the few workspaces that require it, found without reading the others
create index if not exists workspaces_require_two_step_idx on public.workspaces (id)
  where (data->>'requireTwoStep') = 'true';
