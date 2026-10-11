-- L-86: the three helpers the row rules and the document functions call (`lf_ws_role`: the caller's
-- role in a workspace; `lf_mfa_ok`: whether the caller passed two-step login; `lf_assert_table`: is
-- this a document table) move out of `public`, so the API no longer offers them as callable
-- functions (the Supabase advisor flagged them). Row rules point at the functions themselves, so
-- they keep working; the functions that call them by name are re-created to call `private.…`.
-- Signed-in users keep EXECUTE (the rules run as them); the `private` schema is not exposed by the API.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter function public.lf_ws_role(text) set schema private;
alter function public.lf_mfa_ok() set schema private;
alter function public.lf_assert_table(text) set schema private;

CREATE OR REPLACE FUNCTION public.lf_can_admin(ws text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select public.lf_uid() is not null
     and (public.lf_is_platform_admin() or private.lf_ws_role(ws) in ('owner', 'accountant'))
$function$
;
CREATE OR REPLACE FUNCTION public.lf_can_write(ws text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select public.lf_uid() is not null
     and (public.lf_is_platform_admin()
          or private.lf_ws_role(ws) in ('owner', 'accountant', 'bookkeeper'))
$function$
;
CREATE OR REPLACE FUNCTION public.lf_delete(p_table text, p_id text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  n int;
  visible boolean;
begin
  perform private.lf_assert_table(p_table);
  execute format('delete from public.%I where id = $1', p_table) using p_id;
  get diagnostics n = row_count;
  if n = 0 then
    execute format('select exists (select 1 from public.%I where id = $1)', p_table) into visible using p_id;
    if visible then
      raise exception 'Permission denied: %/%', p_table, p_id using errcode = '42501';
    end if;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.lf_is_member(ws text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select public.lf_uid() is not null
     and (public.lf_is_platform_admin() or private.lf_ws_role(ws) is not null)
$function$
;
CREATE OR REPLACE FUNCTION public.lf_period_open(ws text, d text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select case
              when d is not null
                   and coalesce(w.data->'lockException'->>'fromDate', '') <> ''
                   and left(d, 10) >= w.data->'lockException'->>'fromDate'
                   and left(d, 10) <= w.data->'lockException'->>'toDate' then true
              when coalesce(w.data->>'lockDate', '') <> ''
                   and (d is null or left(d, 10) <= w.data->>'lockDate') then false
              when coalesce(w.data->>'softLockDate', '') <> ''
                   and (d is null or left(d, 10) <= w.data->>'softLockDate')
                then coalesce(private.lf_ws_role(ws) in ('owner', 'accountant'), false)
              else true
            end
       from public.workspaces w where w.id = ws),
    true)
$function$
;
CREATE OR REPLACE FUNCTION public.lf_set(p_table text, p_id text, p_data jsonb, p_merge boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  n int;
  visible boolean;
begin
  perform private.lf_assert_table(p_table);
  if p_merge then
    execute format('update public.%I set data = public.lf_deep_merge(data, $2) where id = $1', p_table)
      using p_id, p_data;
  else
    execute format('update public.%I set data = $2 where id = $1', p_table) using p_id, p_data;
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    execute format('select exists (select 1 from public.%I where id = $1)', p_table) into visible using p_id;
    if visible then
      raise exception 'Permission denied: %/%', p_table, p_id using errcode = '42501';
    end if;
    execute format('insert into public.%I (id, data) values ($1, $2)', p_table) using p_id, p_data;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.lf_update(p_table text, p_id text, p_set jsonb, p_unset text[] DEFAULT '{}'::text[], p_inc jsonb DEFAULT '{}'::jsonb, p_union jsonb DEFAULT '{}'::jsonb, p_remove jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  n int;
  visible boolean;
begin
  perform private.lf_assert_table(p_table);
  execute format('update public.%I set data = public.lf_apply_patch(data, $1, $2, $3, $4, $5) where id = $6', p_table)
    using p_set, p_unset, p_inc, p_union, p_remove, p_id;
  get diagnostics n = row_count;
  if n = 0 then
    execute format('select exists (select 1 from public.%I where id = $1)', p_table) into visible using p_id;
    if visible then
      raise exception 'Permission denied: %/%', p_table, p_id using errcode = '42501';
    end if;
    raise exception 'No document to update: %/%', p_table, p_id using errcode = 'P0002';
  end if;
end $function$
;
