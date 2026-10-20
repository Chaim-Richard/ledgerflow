-- ISS-130 (GitHub #130): the unit cost of stock on hand changes only through the server's revaluation
-- (POST /api/v1/inventory/revalue, stockRevaluationService.ts), which posts the change in value to the
-- Inventory account in the same database transaction. A browser may still set the cost of an item with
-- nothing on hand (a cost template: no value is on the books) and edit names, prices and other fields,
-- but no longer change unitCostCents while quantityAtHand is above zero, so the stock list and the
-- Inventory account cannot drift apart. Stock at or below zero has no value on the books (negative stock
-- is valued at 0), so its cost stays editable, the same rule as the revaluation (#259 review). Server writes (lf_is_client() false) are not affected.
create or replace function public.lf_inventory_cost_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.lf_is_client() then
    return new;
  end if;
  if coalesce((old.data->>'quantityAtHand')::numeric, 0) > 0
     and (old.data->'unitCostCents') is distinct from (new.data->'unitCostCents') then
    raise exception 'The cost of stock on hand changes only through a revaluation (Inventory → Revalue)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists lf_inventory_cost_guard on public.inventory;
create trigger lf_inventory_cost_guard before update on public.inventory
  for each row execute function public.lf_inventory_cost_guard();
