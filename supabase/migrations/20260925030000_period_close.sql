-- Closing the books (R-03 soft/hard close, R-10 lock by role, BA-15 partial unlock).
-- Same rule as src/lib/periodLock.ts:
--   lockDate      hard close: nobody posts on or before it
--   softLockDate  soft close: only owners and accountants post on or before it
--   lockException partial unlock: {fromDate, toDate} inside the closed period is open again
-- Closing, reopening and unlocking go through the server (audited, role-checked), so the three
-- fields can no longer be changed from the browser, and close records (periods) are server-only.

update public.lf_rules
set allowed_keys = allowed_keys || array['softLockDate', 'lockException'],
    immutable_keys = immutable_keys || array['lockDate', 'softLockDate', 'lockException']
where table_name = 'workspaces' and not ('softLockDate' = any(allowed_keys));

create or replace function public.lf_period_open(ws text, d text) returns boolean
language sql stable security definer set search_path = public
as $$
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
                then coalesce(public.lf_ws_role(ws) in ('owner', 'accountant'), false)
              else true
            end
       from public.workspaces w where w.id = ws),
    true)
$$;

-- Close records (sign-offs, who closed and reopened) are written only by the server.
drop policy if exists writer_insert on public.periods;
drop policy if exists writer_update on public.periods;
drop policy if exists writer_delete on public.periods;

update public.lf_rules
set allowed_keys = allowed_keys || array['signOffs', 'closeMode', 'closedByUid', 'reopenedByUid']
where table_name = 'periods' and not ('signOffs' = any(allowed_keys));
