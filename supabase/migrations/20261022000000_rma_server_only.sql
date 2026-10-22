-- ISS-143 (GitHub #143): return authorizations (RMAs) are kept on the customer, under
-- data->'metadata'->'returnAuthorizationsById', and are requested, approved, declined, received and closed only
-- through the server (POST /api/v1/workspaces/:ws/return-authorizations, returnAuthorizationService.ts), which
-- checks the role from the workspace's membership, refuses self-approval, keeps every invoice line's returns within
-- what was sold and compares the status it expects, in one transaction. A browser can still create and edit
-- customers, but no longer write that part of a customer by any path (lf_update, lf_set, lf_batch or a direct insert
-- or update), so the approval history cannot be written around the server. Server writes (lf_is_client() false)
-- are not affected.
create or replace function public.lf_rma_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.lf_is_client() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.data->'metadata'->'returnAuthorizationsById', '{}'::jsonb) <> '{}'::jsonb then
      raise exception 'Return authorizations are requested and decided through the server (Warehouse → Return authorizations)'
        using errcode = '42501';
    end if;
  elsif (old.data->'metadata'->'returnAuthorizationsById') is distinct from (new.data->'metadata'->'returnAuthorizationsById') then
    raise exception 'Return authorizations are requested and decided through the server (Warehouse → Return authorizations)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists lf_rma_guard on public.customers;
create trigger lf_rma_guard before insert or update on public.customers
  for each row execute function public.lf_rma_guard();
