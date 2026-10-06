-- Scheduled reports (K-28): owners and accountants keep `scheduledReports` on the workspace, a list of
-- { id, report, frequency, recipients } (at most 10 schedules, 10 addresses each). The daily job writes
-- `scheduledReportsSent` ({ scheduleId: period }) with the server's own access; it is not an allowed field,
-- so the app cannot change what was sent. The shape is checked here so a bad value can't be saved around the app.
update public.lf_rules
set allowed_keys = allowed_keys || array['scheduledReports']
where table_name = 'workspaces' and not ('scheduledReports' = any(allowed_keys));

create or replace function public.lf_valid_report_schedules(v jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select v is null or jsonb_typeof(v) = 'null' or (
    jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 10
    and not exists (
      select 1 from jsonb_array_elements(v) s
      where jsonb_typeof(s) <> 'object'
         or s - array['id', 'report', 'frequency', 'recipients'] <> '{}'::jsonb
         or jsonb_typeof(s->'id') <> 'string' or char_length(s->>'id') not between 1 and 64
         or coalesce(s->>'report', '') not in ('profit-and-loss', 'balance-sheet', 'receivables-aging')
         or coalesce(s->>'frequency', '') not in ('weekly', 'monthly')
         or jsonb_typeof(s->'recipients') <> 'array'
         or jsonb_array_length(s->'recipients') not between 1 and 10
         or exists (select 1 from jsonb_array_elements(s->'recipients') r
                    where jsonb_typeof(r) <> 'string' or char_length(r #>> '{}') > 254
                       or (r #>> '{}') !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$')
    )
  )
$$;

alter table public.workspaces drop constraint if exists workspaces_report_schedules_shape;
alter table public.workspaces add constraint workspaces_report_schedules_shape
  check (public.lf_valid_report_schedules(data->'scheduledReports')) not valid;
