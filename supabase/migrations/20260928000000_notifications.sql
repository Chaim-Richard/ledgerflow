-- In-app notifications (S-01 S-03 S-04 S-06 S-14) with per-person read state and opt-out (S-19).
-- The server writes one row per person (src/server/services/notificationService.ts). A person can
-- read, mark as read and delete only their own rows, and only while they are a member of the
-- workspace. Browsers can't create notifications.

create table public.notifications (
  id text primary key
    check (char_length(id) between 1 and 127 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_ws_idx on public.notifications (workspace_id);
create index notifications_user_idx on public.notifications ((data->>'uid'), workspace_id, (data->>'createdAt'));
create index notifications_created_idx on public.notifications ((data->>'createdAt'));
alter table public.notifications enable row level security;

insert into public.lf_rules (table_name, allowed_keys, immutable_keys) values
  ('notifications', '{id,workspaceId,uid,kind,title,message,linkTab,recordId,eventKey,read,readAt,createdAt}',
                    '{id,workspaceId,uid,kind,title,message,linkTab,recordId,eventKey,createdAt}');

create trigger lf_guard before insert or update or delete on public.notifications
  for each row execute function public.lf_guard();

create policy own_read on public.notifications for select to authenticated
  using (data->>'uid' = public.lf_uid() and public.lf_is_member(workspace_id));
create policy own_update on public.notifications for update to authenticated
  using (data->>'uid' = public.lf_uid() and public.lf_is_member(workspace_id))
  with check (data->>'uid' = public.lf_uid() and public.lf_is_member(workspace_id));
create policy own_delete on public.notifications for delete to authenticated
  using (data->>'uid' = public.lf_uid() and public.lf_is_member(workspace_id));

grant select, update, delete on public.notifications to authenticated;
revoke all on public.notifications from anon;

-- The bell updates live (only on Supabase, where the publication exists).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Each person's choice of notifications, on their own profile.
update public.lf_rules
set allowed_keys = allowed_keys || array['notificationPrefs']
where table_name = 'users' and not ('notificationPrefs' = any(allowed_keys));

-- Customers can be left out of automatic payment reminders (BE-01, K-26).
update public.lf_rules
set allowed_keys = allowed_keys || array['noReminders']
where table_name = 'customers' and not ('noReminders' = any(allowed_keys));

-- The daily job looks for invoices that just became overdue.
create index invoices_due_idx on public.invoices ((data->>'dueDate'));
