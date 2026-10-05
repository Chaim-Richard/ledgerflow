-- Invoice approval (BE-04) is a decision only owners and accountants make. The server stamps it
-- (who, when) on every invoice it saves; this guard stops a browser writing an invoice row
-- directly from setting `approval` to approved or sent back for anyone else (L-191).
create or replace function public.lf_guard_invoice_approval() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  newa jsonb := new.data->'approval';
  olda jsonb := case when tg_op = 'UPDATE' then old.data->'approval' end;
begin
  if not public.lf_is_client() then
    return new;
  end if;
  if newa is distinct from olda
     and coalesce(newa->>'state', '') in ('approved', 'rejected')
     -- workspace_id is computed from the data after BEFORE triggers run, so read the data itself
     and not coalesce(public.lf_can_admin(new.data->>'workspaceId'), false) then
    raise exception 'Only owners and accountants approve invoices' using errcode = '42501';
  end if;
  return new;
end
$$;

revoke execute on function public.lf_guard_invoice_approval() from public, anon, authenticated;

drop trigger if exists lf_guard_invoice_approval on public.invoices;
create trigger lf_guard_invoice_approval before insert or update on public.invoices
  for each row execute function public.lf_guard_invoice_approval();
