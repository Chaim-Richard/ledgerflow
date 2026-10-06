-- How money is shown in this workspace (C-25, display only; AI #2 builds the Appearance controls):
-- `moneyDisplay` = { locale?: BCP 47 tag, at most 64 characters; negativeStyle?: 'minus' | 'accounting' }.
-- Amounts are never written from it. The workspaces policy already limits writes to owners and accountants;
-- the shape is checked here so a bad value can't be saved around the app.
update public.lf_rules
set allowed_keys = allowed_keys || array['moneyDisplay']
where table_name = 'workspaces' and not ('moneyDisplay' = any(allowed_keys));

alter table public.workspaces drop constraint if exists workspaces_money_display_shape;
alter table public.workspaces add constraint workspaces_money_display_shape check (
  data->'moneyDisplay' is null
  or jsonb_typeof(data->'moneyDisplay') = 'null'
  or (
    jsonb_typeof(data->'moneyDisplay') = 'object'
    and (data->'moneyDisplay') - array['locale', 'negativeStyle'] = '{}'::jsonb
    and (data->'moneyDisplay'->'locale' is null
         or (jsonb_typeof(data->'moneyDisplay'->'locale') = 'string'
             and char_length(data->'moneyDisplay'->>'locale') between 1 and 64
             and data->'moneyDisplay'->>'locale' ~ '^[A-Za-z0-9-]+$'))
    and (data->'moneyDisplay'->'negativeStyle' is null
         or data->'moneyDisplay'->>'negativeStyle' in ('minus', 'accounting'))
  )
) not valid;
