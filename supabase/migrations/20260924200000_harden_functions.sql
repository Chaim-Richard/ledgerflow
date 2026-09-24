-- Hardening after the Supabase security advisor:
-- 1. Pin search_path on every helper (all references are schema-qualified).
-- 2. Internal helpers are not callable by anonymous visitors, and trigger / lock-date
--    helpers are not callable over the API at all.
-- (Tables without policies — banks, emailEvents, idempotencyKeys, ... — are server-only on purpose.)

alter function public.lf_claims() set search_path = '';
alter function public.lf_is_client() set search_path = '';
alter function public.lf_uid() set search_path = '';
alter function public.lf_email() set search_path = '';
alter function public.lf_is_platform_admin() set search_path = '';
alter function public.lf_is_member(text) set search_path = '';
alter function public.lf_can_write(text) set search_path = '';
alter function public.lf_can_admin(text) set search_path = '';
alter function public.lf_set_path(jsonb, text[], jsonb) set search_path = '';
alter function public.lf_deep_merge(jsonb, jsonb) set search_path = '';
alter function public.lf_apply_patch(jsonb, jsonb, text[], jsonb, jsonb, jsonb) set search_path = '';

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'lf\_%'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

-- Only the security-definer internals are also closed to signed-in users.
revoke execute on function public.lf_guard() from authenticated;
revoke execute on function public.lf_guard_special() from authenticated;
revoke execute on function public.lf_period_open(text, text) from authenticated;

-- Signed-in users need these (row policies and the write helpers call them).
grant execute on function
  public.lf_claims(), public.lf_is_client(), public.lf_uid(), public.lf_email(),
  public.lf_is_platform_admin(), public.lf_ws_role(text), public.lf_is_member(text),
  public.lf_can_write(text), public.lf_can_admin(text), public.lf_assert_table(text),
  public.lf_set_path(jsonb, text[], jsonb), public.lf_deep_merge(jsonb, jsonb),
  public.lf_apply_patch(jsonb, jsonb, text[], jsonb, jsonb, jsonb),
  public.lf_update(text, text, jsonb, text[], jsonb, jsonb, jsonb),
  public.lf_delete(text, text), public.lf_set(text, text, jsonb, boolean),
  public.lf_batch(jsonb)
to authenticated;
