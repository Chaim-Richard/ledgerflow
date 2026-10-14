-- Custom fields (A-37, tracker CG-01): owner-defined extra fields on customers, vendors and items.
-- The definitions live on the workspace (`customFields` = a list of { id, entityType, key, label,
-- type, choices?, required? }, at most 40); each record's value lives in that record's own
-- `metadata.customFields` and needs no new field. Display and metadata only — no amount is ever
-- read from them. The shape is checked here so a bad value can't be saved around the app.
update public.lf_rules
set allowed_keys = allowed_keys || array['customFields']
where table_name = 'workspaces' and not ('customFields' = any(allowed_keys));

create or replace function public.lf_valid_custom_fields(v jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select v is null or jsonb_typeof(v) = 'null' or (
    jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 40
    and not exists (
      select 1 from jsonb_array_elements(v) f
      where jsonb_typeof(f) <> 'object'
         or f - array['id', 'entityType', 'key', 'label', 'type', 'choices', 'required'] <> '{}'::jsonb
         or jsonb_typeof(f->'id') <> 'string' or char_length(f->>'id') not between 1 and 64
         or coalesce(f->>'entityType', '') not in ('customer', 'vendor', 'item')
         or coalesce(f->>'key', '') !~ '^[A-Za-z][A-Za-z0-9_-]{0,39}$'
         or jsonb_typeof(f->'label') <> 'string' or char_length(f->>'label') not between 1 and 120
         or coalesce(f->>'type', '') not in ('text', 'number', 'date', 'choice')
         or (f->'required' is not null and jsonb_typeof(f->'required') <> 'boolean')
         or (f->'choices' is not null
             and (jsonb_typeof(f->'choices') <> 'array'
                  or coalesce(f->>'type', '') <> 'choice'
                  or jsonb_array_length(f->'choices') not between 1 and 20
                  or exists (select 1 from jsonb_array_elements(f->'choices') c
                             where jsonb_typeof(c) <> 'string' or char_length(c #>> '{}') not between 1 and 120)))
    )
    -- one key per record kind (matching app rule `entityType:key`, case-insensitive)
    and not exists (
      select 1 from jsonb_array_elements(v) a, jsonb_array_elements(v) b
      where a->>'id' <> b->>'id'
        and a->>'entityType' = b->>'entityType'
        and lower(a->>'key') = lower(b->>'key')
    )
  )
$$;

alter table public.workspaces drop constraint if exists workspaces_custom_fields_shape;
alter table public.workspaces add constraint workspaces_custom_fields_shape
  check (public.lf_valid_custom_fields(data->'customFields')) not valid;
