-- Server-written ids can be long (idempotency keys built from a client-supplied key, cache
-- keys): allow up to 1,500 characters, Firestore's own limit. Ids created from the browser keep
-- the old firestore.rules isValidId rule (under 128 characters, no spaces or control
-- characters), now checked in lf_guard.

do $$
declare t text;
begin
  for t in select table_name from public.lf_rules loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_id_check');
    execute format('alter table public.%I add constraint %I check (char_length(id) between 1 and 1500 and id !~ ''[[:cntrl:]]'')',
                   t, t || '_id_check');
  end loop;
end $$;

create or replace function public.lf_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r public.lf_rules;
  k text;
  newd jsonb;
  oldd jsonb;
  ws text;
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  if not public.lf_is_client() then
    return coalesce(new, old);
  end if;

  -- Browser-created ids follow the old isValidId rule (firestore.rules).
  if tg_op = 'INSERT' and (char_length(new.id) >= 128 or new.id ~ '[[:space:][:cntrl:]]') then
    raise exception 'Invalid document id' using errcode = '42501';
  end if;

  select * into r from public.lf_rules where table_name = tg_table_name;
  if not found then
    raise exception 'No access rules for %', tg_table_name using errcode = '42501';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then newd := new.data; end if;
  if tg_op in ('UPDATE', 'DELETE') then oldd := old.data; end if;

  if newd is not null then
    if r.allowed_keys is not null then
      for k in select jsonb_object_keys(newd) loop
        if not (k = any (r.allowed_keys)) then
          raise exception 'Field "%" is not allowed on %', k, tg_table_name using errcode = '42501';
        end if;
      end loop;
    end if;
    if r.max_keys is not null and (select count(*) from jsonb_object_keys(newd)) >= r.max_keys then
      raise exception 'Too many fields on %', tg_table_name using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    foreach k in array r.immutable_keys loop
      if (oldd->k) is distinct from (newd->k) then
        raise exception 'Field "%" cannot be changed', k using errcode = '42501';
      end if;
    end loop;
  end if;

  if r.dated then
    ws := coalesce(newd->>'workspaceId', oldd->>'workspaceId');
    if tg_op = 'INSERT' then
      if (r.date_required or newd ? 'date') and not public.lf_period_open(ws, newd->>'date') then
        raise exception 'This period is locked' using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' then
      if (r.date_required or oldd ? 'date') and not public.lf_period_open(ws, oldd->>'date') then
        raise exception 'This period is locked' using errcode = '42501';
      end if;
      if newd ? 'date' and not public.lf_period_open(ws, newd->>'date') then
        raise exception 'This period is locked' using errcode = '42501';
      end if;
    else
      if oldd ? 'date' and not public.lf_period_open(ws, oldd->>'date') then
        raise exception 'This period is locked' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' and r.delete_draft_only
     and coalesce(oldd->>'status', 'draft') <> 'draft' then
    raise exception 'Only drafts can be deleted; void it instead' using errcode = '42501';
  end if;

  return coalesce(new, old);
end $$;
