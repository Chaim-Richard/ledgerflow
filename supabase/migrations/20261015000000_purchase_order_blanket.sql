-- A-62 blanket purchase orders: an agreement (a total and a validity period) that several goods
-- receipts and vendor bills draw down. The agreement lives on the order itself — `blanket` =
-- { validUntil, capCents? } — and the draw-down is a report figure the screen computes from the
-- documents explicitly linked to the order. Nothing here posts; the order, its receipts and its
-- bills keep their own screens and posting paths.
--
-- Listed for review while Claude is away (docs/FOR_YOU.md): until this is applied the database
-- refuses the `blanket` field, so the Blanket Purchase Orders report cannot save a new mark (it
-- shows the write error and the orders stay unmarked). The field is display and report metadata
-- only — no amount is read from it that the order itself does not already carry.
update public.lf_rules
set allowed_keys = allowed_keys || array['blanket']
where table_name = 'purchaseOrders' and not ('blanket' = any(allowed_keys));

create or replace function public.lf_valid_blanket(v jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select v is null or jsonb_typeof(v) = 'null' or (
    jsonb_typeof(v) = 'object'
    and v - array['validUntil', 'capCents'] = '{}'::jsonb
    and jsonb_typeof(v->'validUntil') = 'string'
    and (v->>'validUntil') ~ '^\d{4}-\d{2}-\d{2}$'
    and (v->'capCents' is null
         or (jsonb_typeof(v->'capCents') = 'number'
             and (v->>'capCents')::numeric >= 0
             and (v->>'capCents')::numeric = floor((v->>'capCents')::numeric)))
  )
$$;

alter table public."purchaseOrders" drop constraint if exists purchase_orders_blanket_shape;
alter table public."purchaseOrders" add constraint purchase_orders_blanket_shape
  check (public.lf_valid_blanket(data->'blanket')) not valid;
