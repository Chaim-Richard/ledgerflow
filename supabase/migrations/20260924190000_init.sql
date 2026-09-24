-- LedgerFlow on Supabase: document tables + row level security.
--
-- Every former Firestore collection becomes one table with the same document shape:
--   id text, data jsonb (the document), workspace_id (generated from data->>'workspaceId'),
--   created_at, updated_at.
-- Security mirrors the old firestore.rules:
--   * row visibility and who may write: RLS policies (helpers lf_is_member / lf_can_write / lf_can_admin)
--   * field-level rules (allowed keys, immutable fields, lock date, drafts-only delete):
--     the lf_guard trigger, driven by the lf_rules table.
-- Server code connects as a privileged role and bypasses both (it does its own checks).

-- ---------------------------------------------------------------------------
-- Request identity helpers
-- ---------------------------------------------------------------------------

create or replace function public.lf_claims() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

-- True for browser requests (PostgREST as anon/authenticated). Server connections
-- (service_role key or a direct database login) are trusted and skip client rules.
create or replace function public.lf_is_client() returns boolean
language sql stable
as $$
  select coalesce(public.lf_claims()->>'role', '') in ('authenticated', 'anon')
$$;

create or replace function public.lf_uid() returns text
language sql stable
as $$
  select nullif(public.lf_claims()->>'sub', '')
$$;

create or replace function public.lf_email() returns text
language sql stable
as $$
  select public.lf_claims()->>'email'
$$;

create or replace function public.lf_is_platform_admin() returns boolean
language sql stable
as $$
  select coalesce((public.lf_claims()->'app_metadata'->>'admin')::boolean, false)
      or coalesce(public.lf_claims()->'app_metadata'->>'role', '') = 'admin'
$$;

-- ---------------------------------------------------------------------------
-- Rule table used by the guard trigger (one row per document table)
-- ---------------------------------------------------------------------------

create table public.lf_rules (
  table_name text primary key,
  allowed_keys text[],                                -- null = any keys
  max_keys int,                                       -- null = no limit
  immutable_keys text[] not null default '{workspaceId}',
  dated boolean not null default false,               -- lock-date checks on writes
  date_required boolean not null default false,       -- create must carry a date
  delete_draft_only boolean not null default false    -- only drafts (or no status) may be deleted
);
alter table public.lf_rules enable row level security;  -- no policies: not readable by clients

-- ---------------------------------------------------------------------------
-- Document tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  all_tables text[] := array[
    -- workspace documents
    'transactions','journalEntries','invoices','payments','bills','creditNotes','vendorCredits',
    'chartAccounts','projects','estimates','inventory','recurring','budgets','autoRules',
    'fixedAssets','assets','taxRates','dimensionNodes','vendors','customers','periods',
    'rulePatterns','scenarios','employees','payRuns','partners','reconciliations','workspaceShards',
    -- server-written, members may read
    'invites','bankLines','billingLedgerTraces','deepAuditJobs',
    -- server only
    'stripeProcessedEvents','idempotencyKeys','external_api_cache','jobRuns','loginAudits',
    'emailEvents','numberingSeries','members','banks',
    -- special rules
    'users','workspaces','presence','auditLogs','learnedDeltas','customTemplates',
    'supportTickets','supportMessages','errorLogs','apiKeys','admins',
    -- generic fallback (old wildcard rule)
    'documents'
  ];
begin
  foreach t in array all_tables loop
    execute format($f$
      create table public.%I (
        id text primary key
          check (char_length(id) between 1 and 127 and id !~ '[[:space:][:cntrl:]]'),
        data jsonb not null default '{}'::jsonb,
        workspace_id text generated always as (data->>'workspaceId') stored,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )$f$, t);
    execute format('create index %I on public.%I (workspace_id)', t || '_ws_idx', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Query indexes for the filters and sort orders the app uses
create index transactions_ws_date_idx on public.transactions (workspace_id, (data->>'date'));
create index "journalEntries_ws_date_idx" on public."journalEntries" (workspace_id, (data->>'date'));
create index invoices_ws_date_idx on public.invoices (workspace_id, (data->>'date'));
create index invoices_customer_idx on public.invoices (workspace_id, (data->>'customerId'));
create index invoices_payment_token_idx on public.invoices ((data->>'paymentToken'));
create index bills_ws_date_idx on public.bills (workspace_id, (data->>'date'));
create index bills_vendor_idx on public.bills (workspace_id, (data->>'vendorId'));
create index payments_ws_date_idx on public.payments (workspace_id, (data->>'date'));
create index "bankLines_ws_date_idx" on public."bankLines" (workspace_id, (data->>'date'));
create index "auditLogs_ws_ts_idx" on public."auditLogs" (workspace_id, (data->>'timestamp'));
create index "auditLogs_ts_idx" on public."auditLogs" ((data->>'timestamp'));
create index invites_token_idx on public.invites ((data->>'token'));
create index recurring_occurrence_idx on public.recurring (workspace_id, (data->>'recurrenceOccurrenceKey'));
create index "supportTickets_uid_idx" on public."supportTickets" ((data->>'uid'));
create index "supportMessages_ticket_idx" on public."supportMessages" ((data->>'ticketId'));
create index "customTemplates_uid_idx" on public."customTemplates" ((data->>'uid'));
create index "apiKeys_uid_idx" on public."apiKeys" ((data->>'uid'));
create index "jobRuns_finished_idx" on public."jobRuns" ((data->>'finishedAt'));
create index workspaces_owner_idx on public.workspaces ((data->>'uid'));

-- ---------------------------------------------------------------------------
-- Workspace role helpers (security definer: they read workspaces regardless of RLS)
-- ---------------------------------------------------------------------------

-- Role of the signed-in user in a workspace, or null when not a member.
-- Mirrors firestore.rules: owner = data.uid; roles[uid]; admins[uid] == true -> owner.
create or replace function public.lf_ws_role(ws text) returns text
language sql stable security definer set search_path = public
as $$
  select case
    when public.lf_uid() is null or w.id is null then null
    when w.data->>'uid' = public.lf_uid() then 'owner'
    when jsonb_typeof(w.data->'roles'->public.lf_uid()) = 'string' then w.data->'roles'->>public.lf_uid()
    when (w.data->'admins'->public.lf_uid()) = 'true'::jsonb then 'owner'
    else null
  end
  from (select 1) one
  left join public.workspaces w on w.id = ws
$$;

create or replace function public.lf_is_member(ws text) returns boolean
language sql stable
as $$
  select public.lf_uid() is not null
     and (public.lf_is_platform_admin() or public.lf_ws_role(ws) is not null)
$$;

create or replace function public.lf_can_write(ws text) returns boolean
language sql stable
as $$
  select public.lf_uid() is not null
     and (public.lf_is_platform_admin()
          or public.lf_ws_role(ws) in ('owner', 'accountant', 'bookkeeper'))
$$;

create or replace function public.lf_can_admin(ws text) returns boolean
language sql stable
as $$
  select public.lf_uid() is not null
     and (public.lf_is_platform_admin() or public.lf_ws_role(ws) in ('owner', 'accountant'))
$$;

-- A date is writable when the workspace has no lock date or the date is after it.
create or replace function public.lf_period_open(ws text, d text) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select case
              when coalesce(w.data->>'lockDate', '') = '' then true
              when d is null then false
              else d > (w.data->>'lockDate')
            end
       from public.workspaces w where w.id = ws),
    true)
$$;

-- ---------------------------------------------------------------------------
-- Guard trigger: field-level rules for browser writes
-- ---------------------------------------------------------------------------

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

do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'lf_rules'
  loop
    execute format('create trigger lf_guard before insert or update or delete on public.%I
                    for each row execute function public.lf_guard()', t);
  end loop;
end $$;

-- Table-specific checks that don't fit the generic rule table
create or replace function public.lf_guard_special() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  newd jsonb := case when tg_op in ('INSERT', 'UPDATE') then new.data end;
  oldd jsonb := case when tg_op in ('UPDATE', 'DELETE') then old.data end;
  k text;
begin
  if not public.lf_is_client() then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'chartAccounts' and tg_op = 'UPDATE'
     and coalesce((oldd->>'isSystem')::boolean, false) then
    foreach k in array array['type', 'code', 'classification'] loop
      if (oldd->k) is distinct from (newd->k) then
        raise exception 'System accounts cannot change "%"', k using errcode = '42501';
      end if;
    end loop;
  end if;

  if tg_table_name = 'workspaces' then
    if tg_op = 'INSERT' then
      if char_length(coalesce(newd->>'name', '')) >= 128
         or char_length(coalesce(newd->>'description', '')) >= 1000
         or (newd ? 'plan' and newd->>'plan' not in ('starter', 'free'))
         or (newd ? 'computeCreditBalance' and (newd->>'computeCreditBalance')::numeric > 100)
         or (newd ? 'bypassBilling' and newd->'bypassBilling' <> 'false'::jsonb)
         or (newd ? 'maxSeats' and (newd->>'maxSeats')::numeric > 5) then
        raise exception 'Workspace values not allowed' using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' and not public.lf_is_platform_admin() then
      if (oldd->'lockDate') is distinct from (newd->'lockDate') and not public.lf_can_admin(old.id) then
        raise exception 'Only owners and accountants can change the lock date' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_table_name = 'supportTickets' and tg_op = 'UPDATE' and not public.lf_is_platform_admin() then
    if (newd->>'status') is distinct from (oldd->>'status')
       and coalesce(newd->>'status', '') not in ('closed', 'resolved') then
      raise exception 'Users can only close or resolve a ticket' using errcode = '42501';
    end if;
  end if;

  return coalesce(new, old);
end $$;

create trigger lf_guard_special before insert or update or delete on public."chartAccounts"
  for each row execute function public.lf_guard_special();
create trigger lf_guard_special before insert or update or delete on public.workspaces
  for each row execute function public.lf_guard_special();
create trigger lf_guard_special before insert or update or delete on public."supportTickets"
  for each row execute function public.lf_guard_special();

-- ---------------------------------------------------------------------------
-- Rules per table (allowed keys copied from firestore.rules)
-- ---------------------------------------------------------------------------

insert into public.lf_rules (table_name, dated, date_required, delete_draft_only) values
  ('transactions', true, true, true),
  ('journalEntries', true, false, true),
  ('invoices', true, false, true),
  ('payments', true, false, true),
  ('bills', true, false, true);

insert into public.lf_rules (table_name, allowed_keys, dated, delete_draft_only) values
  ('creditNotes', '{id,uid,workspaceId,customerId,customerName,number,invoiceId,amountCents,remainingCents,date,reason,status,currency,createdAt,updatedAt}', true, true),
  ('vendorCredits', '{id,uid,workspaceId,vendorId,vendorName,number,billId,amountCents,remainingCents,date,reason,status,currency,createdAt,updatedAt}', true, true);

insert into public.lf_rules (table_name, allowed_keys, immutable_keys) values
  ('chartAccounts', '{id,uid,workspaceId,name,code,type,category,subtype,taxCategory,description,currency,balanceCents,openingBalanceCents,asOfDate,parentId,projectAllocations,isContra,isArchived,archived,isActive,createdAt,updatedAt,isSystem,classification}',
                    '{workspaceId,uid,balanceCents,openingBalanceCents,isSystem}'),
  ('projects', '{id,uid,workspaceId,name,description,type,status,pipelineStage,budgetCents,costCodes,laborBuckets,materialsBuckets,subcontractCosts,dimensions,tags,splitRules,metadata,createdAt,updatedAt}', '{workspaceId}'),
  ('customers', '{id,uid,workspaceId,name,email,phone,balanceCents,pipelineStage,customerSegment,expectedRevenueCents,probability,score,tags,metadata,notes,isForeign,address,taxId,taxNumber,currency,paymentTerms,createdAt,updatedAt,billingAddress,website}', '{workspaceId}'),
  ('periods', '{id,uid,workspaceId,periodId,status,closedAt,closedBy,startDate,endDate,reopenedAt,reopenedBy,reopenReason,notes,createdAt,updatedAt}', '{workspaceId}'),
  ('rulePatterns', '{id,uid,workspaceId,description,accountId,accountName,count,lastUpdated,createdAt,updatedAt}', '{workspaceId}'),
  ('scenarios', '{id,uid,workspaceId,name,description,ghosts,isActive,createdAt,updatedAt}', '{workspaceId}'),
  ('users', '{uid,email,role,createdAt,updatedAt,customLimit,computeCreditLimit}', '{role,email}'),
  ('workspaces', '{id,uid,name,businessType,type,description,createdAt,updatedAt,lockDate,currency,matchingThreshold,isDemoLoaded,plan,billingCycle,concurrentUserLimit,activeUserCount,maxSeats,billingLedgerChain,apiQuotaTotalCentsUsed,apiQuotaMonthlyLimitCents,computeCreditBalance,strategicAdvice,lockedUntilDate,seatCount,stripeCustomerId,stripeSubscriptionId,status,adminCount,admins,roles,dateFormat,aiModel,notifications,analyticalTopology,totalQueriesThisMonth,computeHardnessScore,defaultAccountMappings,dimensions,allowedWorldPaths,bypassBilling,members}',
                 '{uid,plan,computeCreditBalance,apiQuotaMonthlyLimitCents,maxSeats,concurrentUserLimit,apiQuotaTotalCentsUsed,stripeCustomerId,seatCount,status,lockedUntilDate,bypassBilling,stripeSubscriptionId,billingLedgerChain,allowedWorldPaths,analyticalTopology,computeHardnessScore}'),
  ('presence', '{uid,email,displayName,photoURL,lastActive,activeTab,state,currentWorkspaceId}', '{}'),
  ('auditLogs', '{id,uid,userId,workspaceId,action,details,severity,userEmail,email,actorUid,actorEmail,documentId,entityId,collectionName,entityType,metadata,timestamp}', '{workspaceId}'),
  ('learnedDeltas', '{id,uid,workspaceId,apiKeyId,description,category,timestamp}', '{workspaceId,uid}'),
  ('customTemplates', '{name,industry,accounts,analyticalTopology,uid,createdAt}', '{uid}'),
  ('supportTickets', '{id,workspaceId,uid,subject,status,priority,createdAt,updatedAt,lastMessageAt,lastMessageBy,unreadForUser,unreadForAdmin,errorLogId,errorDiagnostics}', '{workspaceId,uid,createdAt}'),
  ('supportMessages', '{id,ticketId,workspaceId,authorUid,authorRole,body,createdAt}', '{workspaceId}'),
  ('errorLogs', '{id,workspaceId,userId,userEmail,message,stack,componentStack,url,userAgent,appVersion,release,source,severity,metadata,ticketId,createdAt}', '{workspaceId}');

insert into public.lf_rules (table_name, max_keys, immutable_keys) values
  ('documents', 60, '{workspaceId,uid}');

insert into public.lf_rules (table_name)
select t from unnest(array[
  'estimates','inventory','recurring','budgets','autoRules','fixedAssets','assets','taxRates',
  'dimensionNodes','vendors','employees','payRuns','partners','reconciliations','workspaceShards',
  'invites','bankLines','billingLedgerTraces','deepAuditJobs','stripeProcessedEvents','idempotencyKeys',
  'external_api_cache','jobRuns','loginAudits','emailEvents','numberingSeries','members','banks',
  'apiKeys','admins'
]) t;

-- ---------------------------------------------------------------------------
-- Row level security policies
-- ---------------------------------------------------------------------------

-- Standard workspace documents: members read; owner/accountant/bookkeeper write.
do $$
declare t text;
begin
  foreach t in array array[
    'transactions','journalEntries','invoices','payments','bills','creditNotes','vendorCredits',
    'projects','estimates','inventory','recurring','budgets','autoRules','fixedAssets','assets',
    'taxRates','dimensionNodes','vendors','customers','periods','rulePatterns','scenarios',
    'employees','payRuns','partners','reconciliations','workspaceShards'
  ] loop
    execute format('create policy member_read on public.%I for select to authenticated using (public.lf_is_member(workspace_id))', t);
    execute format('create policy writer_insert on public.%I for insert to authenticated with check (public.lf_can_write(workspace_id))', t);
    execute format('create policy writer_update on public.%I for update to authenticated using (public.lf_can_write(workspace_id)) with check (public.lf_can_write(workspace_id))', t);
    if t <> 'workspaceShards' then
      execute format('create policy writer_delete on public.%I for delete to authenticated using (public.lf_can_write(workspace_id))', t);
    end if;
  end loop;

  -- written only by the server; members may read
  foreach t in array array['invites','bankLines','billingLedgerTraces','deepAuditJobs'] loop
    execute format('create policy member_read on public.%I for select to authenticated using (public.lf_is_member(workspace_id))', t);
  end loop;
end $$;

-- Chart of accounts: owners/accountants write; system accounts can't be deleted.
create policy member_read on public."chartAccounts" for select to authenticated
  using (public.lf_is_member(workspace_id));
create policy admin_insert on public."chartAccounts" for insert to authenticated
  with check (public.lf_can_admin(workspace_id));
create policy admin_update on public."chartAccounts" for update to authenticated
  using (public.lf_can_admin(workspace_id)) with check (public.lf_can_admin(workspace_id));
create policy admin_delete on public."chartAccounts" for delete to authenticated
  using (public.lf_can_admin(workspace_id) and coalesce((data->>'isSystem')::boolean, false) = false);

-- Users: each user only their own profile; can't make themselves admin.
create policy self_read on public.users for select to authenticated using (id = public.lf_uid());
create policy self_insert on public.users for insert to authenticated
  with check (id = public.lf_uid()
              and data->>'email' = public.lf_email()
              and (data->>'role' = 'client' or (data->>'role' = 'admin' and public.lf_is_platform_admin())));
create policy self_update on public.users for update to authenticated
  using (id = public.lf_uid()) with check (id = public.lf_uid());

-- Workspaces
create policy member_read on public.workspaces for select to authenticated
  using (public.lf_is_platform_admin() or public.lf_is_member(id));
create policy owner_insert on public.workspaces for insert to authenticated
  with check (data->>'uid' = public.lf_uid());
create policy admin_update on public.workspaces for update to authenticated
  using (public.lf_is_platform_admin() or data->>'uid' = public.lf_uid() or public.lf_can_admin(id))
  with check (public.lf_is_platform_admin() or data->>'uid' = public.lf_uid() or public.lf_can_admin(id));

-- Presence
create policy presence_read on public.presence for select to authenticated
  using (id = public.lf_uid()
         or (data->>'currentWorkspaceId' is not null and public.lf_is_member(data->>'currentWorkspaceId')));
create policy presence_insert on public.presence for insert to authenticated with check (id = public.lf_uid());
create policy presence_update on public.presence for update to authenticated
  using (id = public.lf_uid()) with check (id = public.lf_uid());

-- Audit logs: append-only; identity fields must be the signed-in user; viewers may only log sign-ins.
create policy member_read on public."auditLogs" for select to authenticated
  using (public.lf_is_member(workspace_id));
create policy member_insert on public."auditLogs" for insert to authenticated
  with check (
    public.lf_is_member(workspace_id)
    and (not data ? 'uid' or data->>'uid' = public.lf_uid())
    and (not data ? 'userId' or data->>'userId' = public.lf_uid())
    and (not data ? 'actorUid' or data->>'actorUid' = public.lf_uid())
    and (not data ? 'userEmail' or data->>'userEmail' = public.lf_email())
    and (not data ? 'email' or data->>'email' = public.lf_email())
    and (not data ? 'actorEmail' or data->>'actorEmail' = public.lf_email())
    and (public.lf_can_write(workspace_id) or data->>'action' = 'USER_LOGIN')
  );

-- Learned deltas: append/update own entries only.
create policy member_read on public."learnedDeltas" for select to authenticated
  using (public.lf_is_member(workspace_id));
create policy own_insert on public."learnedDeltas" for insert to authenticated
  with check (data->>'uid' = public.lf_uid() and public.lf_is_member(workspace_id)
              and jsonb_typeof(data->'description') = 'string' and char_length(data->>'description') <= 500
              and jsonb_typeof(data->'category') = 'string' and char_length(data->>'category') <= 100);
create policy own_update on public."learnedDeltas" for update to authenticated
  using (data->>'uid' = public.lf_uid())
  with check (data->>'uid' = public.lf_uid() and public.lf_is_member(workspace_id)
              and jsonb_typeof(data->'description') = 'string' and char_length(data->>'description') <= 500
              and jsonb_typeof(data->'category') = 'string' and char_length(data->>'category') <= 100);

-- Custom templates: private to their creator.
create policy own_all on public."customTemplates" for all to authenticated
  using (data->>'uid' = public.lf_uid()) with check (data->>'uid' = public.lf_uid());

-- Support tickets
create policy ticket_read on public."supportTickets" for select to authenticated
  using (public.lf_is_platform_admin() or data->>'uid' = public.lf_uid() or public.lf_is_member(workspace_id));
create policy ticket_insert on public."supportTickets" for insert to authenticated
  with check (data->>'uid' = public.lf_uid()
              and (public.lf_is_platform_admin() or public.lf_is_member(workspace_id))
              and jsonb_typeof(data->'subject') = 'string' and char_length(data->>'subject') <= 200
              and data->>'status' = 'open');
create policy ticket_update on public."supportTickets" for update to authenticated
  using (public.lf_is_platform_admin() or public.lf_is_member(workspace_id))
  with check (public.lf_is_platform_admin() or public.lf_is_member(workspace_id));

-- Support messages: append-only.
create policy message_read on public."supportMessages" for select to authenticated
  using (public.lf_is_platform_admin() or data->>'authorUid' = public.lf_uid() or public.lf_is_member(workspace_id));
create policy message_insert on public."supportMessages" for insert to authenticated
  with check (data->>'authorUid' = public.lf_uid()
              and jsonb_typeof(data->'body') = 'string' and char_length(data->>'body') <= 5000
              and case when public.lf_is_platform_admin() then data->>'authorRole' = 'admin'
                       else public.lf_is_member(workspace_id) and data->>'authorRole' = 'user' end);

-- Error logs: append-only.
create policy error_read on public."errorLogs" for select to authenticated
  using (public.lf_is_platform_admin() or data->>'userId' = public.lf_uid() or public.lf_is_member(workspace_id));
create policy error_insert on public."errorLogs" for insert to authenticated
  with check ((public.lf_is_platform_admin() or public.lf_is_member(workspace_id) or data->>'userId' = public.lf_uid())
              and jsonb_typeof(data->'message') = 'string' and char_length(data->>'message') <= 4000);

-- API keys: owners can see their own keys; writes are server-side.
create policy own_read on public."apiKeys" for select to authenticated using (data->>'uid' = public.lf_uid());

-- Platform admins list
create policy admin_read on public.admins for select to authenticated using (public.lf_is_platform_admin());

-- Generic fallback (old wildcard rule): members read; own documents create/update; no deletes.
create policy member_read on public.documents for select to authenticated
  using (public.lf_is_member(workspace_id));
create policy own_insert on public.documents for insert to authenticated
  with check (data->>'uid' = public.lf_uid() and public.lf_is_member(workspace_id));
create policy own_update on public.documents for update to authenticated
  using (data->>'uid' = public.lf_uid() and public.lf_is_member(workspace_id))
  with check (data->>'uid' = public.lf_uid() and public.lf_is_member(workspace_id));

-- ---------------------------------------------------------------------------
-- Write helpers used by the browser data layer (security invoker: RLS applies)
-- ---------------------------------------------------------------------------

create or replace function public.lf_assert_table(p_table text) returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.lf_rules where table_name = p_table) then
    raise exception 'Unknown collection %', p_table using errcode = '42P01';
  end if;
end $$;

-- Set a value at a dotted path, creating intermediate objects as needed.
create or replace function public.lf_set_path(doc jsonb, path text[], val jsonb) returns jsonb
language plpgsql immutable
as $$
declare
  head text;
  child jsonb;
begin
  if array_length(path, 1) is null then
    return val;
  end if;
  head := path[1];
  if array_length(path, 1) = 1 then
    return coalesce(doc, '{}'::jsonb) || jsonb_build_object(head, val);
  end if;
  child := coalesce(doc->head, '{}'::jsonb);
  if jsonb_typeof(child) <> 'object' then
    child := '{}'::jsonb;
  end if;
  return coalesce(doc, '{}'::jsonb)
         || jsonb_build_object(head, public.lf_set_path(child, path[2:], val));
end $$;

-- Recursive merge used by set(..., { merge: true }).
create or replace function public.lf_deep_merge(a jsonb, b jsonb) returns jsonb
language sql immutable
as $$
  select case
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
      coalesce(a, '{}'::jsonb) || coalesce((
        select jsonb_object_agg(k,
                 case when jsonb_typeof(a->k) = 'object' and jsonb_typeof(b->k) = 'object'
                      then public.lf_deep_merge(a->k, b->k) else b->k end)
          from jsonb_object_keys(b) k), '{}'::jsonb)
    else b
  end
$$;

-- Firestore update semantics: keys may be dotted paths; p_unset removes paths;
-- p_inc adds numbers (FieldValue.increment); p_union / p_remove edit arrays.
create or replace function public.lf_apply_patch(doc jsonb, p_set jsonb, p_unset text[],
                                                 p_inc jsonb, p_union jsonb default '{}'::jsonb,
                                                 p_remove jsonb default '{}'::jsonb)
returns jsonb
language plpgsql immutable
as $$
declare
  k text;
  v jsonb;
  cur jsonb;
  path text[];
begin
  for k, v in select key, value from jsonb_each(coalesce(p_set, '{}'::jsonb)) loop
    doc := public.lf_set_path(doc, string_to_array(k, '.'), v);
  end loop;
  for k, v in select key, value from jsonb_each(coalesce(p_inc, '{}'::jsonb)) loop
    path := string_to_array(k, '.');
    cur := doc #> path;
    doc := public.lf_set_path(doc, path,
             to_jsonb(coalesce(case when jsonb_typeof(cur) = 'number' then (cur #>> '{}')::numeric end, 0)
                      + (v #>> '{}')::numeric));
  end loop;
  for k, v in select key, value from jsonb_each(coalesce(p_union, '{}'::jsonb)) loop
    path := string_to_array(k, '.');
    cur := case when jsonb_typeof(doc #> path) = 'array' then doc #> path else '[]'::jsonb end;
    doc := public.lf_set_path(doc, path,
             cur || coalesce((select jsonb_agg(e) from jsonb_array_elements(v) e where not cur @> jsonb_build_array(e)), '[]'::jsonb));
  end loop;
  for k, v in select key, value from jsonb_each(coalesce(p_remove, '{}'::jsonb)) loop
    path := string_to_array(k, '.');
    cur := case when jsonb_typeof(doc #> path) = 'array' then doc #> path else '[]'::jsonb end;
    doc := public.lf_set_path(doc, path,
             coalesce((select jsonb_agg(e) from jsonb_array_elements(cur) e where not v @> jsonb_build_array(e)), '[]'::jsonb));
  end loop;
  if p_unset is not null then
    foreach k in array p_unset loop
      doc := doc #- string_to_array(k, '.');
    end loop;
  end if;
  return doc;
end $$;

create or replace function public.lf_update(p_table text, p_id text, p_set jsonb,
                                            p_unset text[] default '{}', p_inc jsonb default '{}',
                                            p_union jsonb default '{}', p_remove jsonb default '{}')
returns void
language plpgsql security invoker set search_path = public
as $$
declare
  n int;
  visible boolean;
begin
  perform public.lf_assert_table(p_table);
  execute format('update public.%I set data = public.lf_apply_patch(data, $1, $2, $3, $4, $5) where id = $6', p_table)
    using p_set, p_unset, p_inc, p_union, p_remove, p_id;
  get diagnostics n = row_count;
  if n = 0 then
    execute format('select exists (select 1 from public.%I where id = $1)', p_table) into visible using p_id;
    if visible then
      raise exception 'Permission denied: %/%', p_table, p_id using errcode = '42501';
    end if;
    raise exception 'No document to update: %/%', p_table, p_id using errcode = 'P0002';
  end if;
end $$;

create or replace function public.lf_delete(p_table text, p_id text) returns void
language plpgsql security invoker set search_path = public
as $$
declare
  n int;
  visible boolean;
begin
  perform public.lf_assert_table(p_table);
  execute format('delete from public.%I where id = $1', p_table) using p_id;
  get diagnostics n = row_count;
  if n = 0 then
    execute format('select exists (select 1 from public.%I where id = $1)', p_table) into visible using p_id;
    if visible then
      raise exception 'Permission denied: %/%', p_table, p_id using errcode = '42501';
    end if;
  end if;
end $$;

-- set() / set(..., { merge: true }): update when the document exists, else insert.
-- (Not INSERT ... ON CONFLICT: that checks insert rules even for existing rows,
-- which would refuse partial merges that leave out workspaceId.)
create or replace function public.lf_set(p_table text, p_id text, p_data jsonb, p_merge boolean default false)
returns void
language plpgsql security invoker set search_path = public
as $$
declare
  n int;
  visible boolean;
begin
  perform public.lf_assert_table(p_table);
  if p_merge then
    execute format('update public.%I set data = public.lf_deep_merge(data, $2) where id = $1', p_table)
      using p_id, p_data;
  else
    execute format('update public.%I set data = $2 where id = $1', p_table) using p_id, p_data;
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    execute format('select exists (select 1 from public.%I where id = $1)', p_table) into visible using p_id;
    if visible then
      raise exception 'Permission denied: %/%', p_table, p_id using errcode = '42501';
    end if;
    execute format('insert into public.%I (id, data) values ($1, $2)', p_table) using p_id, p_data;
  end if;
end $$;

-- Several writes in one database transaction (writeBatch / client runTransaction).
-- ops: [{ op: 'set'|'update'|'delete', table, id, data?, merge?, unset?, inc?, union?, remove? }]
create or replace function public.lf_batch(p_ops jsonb) returns void
language plpgsql security invoker set search_path = public
as $$
declare o jsonb;
begin
  for o in select value from jsonb_array_elements(p_ops) loop
    case o->>'op'
      when 'set' then
        perform public.lf_set(o->>'table', o->>'id', coalesce(o->'data', '{}'::jsonb), coalesce((o->>'merge')::boolean, false));
      when 'update' then
        perform public.lf_update(o->>'table', o->>'id', coalesce(o->'data', '{}'::jsonb),
          coalesce(array(select jsonb_array_elements_text(o->'unset')), '{}'),
          coalesce(o->'inc', '{}'::jsonb), coalesce(o->'union', '{}'::jsonb), coalesce(o->'remove', '{}'::jsonb));
      when 'delete' then
        perform public.lf_delete(o->>'table', o->>'id');
      else
        raise exception 'Unknown batch op %', o->>'op';
    end case;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  for t in select table_name from public.lf_rules loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
revoke all on public.lf_rules from anon, authenticated;

-- Live updates for the tables the app listens to (only on Supabase, where the publication exists).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'transactions','chartAccounts','projects','taxRates','customTemplates','partners','autoRules',
      'rulePatterns','dimensionNodes','invoices','creditNotes','payments','estimates','customers',
      'bills','vendorCredits','vendors','inventory','budgets','payRuns','employees','bankLines',
      'reconciliations','periods','scenarios','recurring','assets','invites','journalEntries',
      'workspaceShards','billingLedgerTraces','supportTickets','supportMessages','workspaces','auditLogs'
    ] loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;
