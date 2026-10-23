-- EG-2 step 1: the payment ledger (docs/design/EG-2-payment-ledger.md). One immutable row per settlement of an
-- invoice or bill (id `{sourceKind}-{operationId}-{sourceId}-{documentId}`), written only by the server in the
-- same transaction as the document update (src/server/services/allocationLedger.ts). `allocationOperations`
-- keeps the idempotency key of a later application (applyUnappliedPayment) with its request hash, so a retry
-- writes nothing. Members read both; nobody writes them from the browser (RLS like periodBalances and repostQueue).

create table public."paymentAllocations" (
  id text primary key
    check (char_length(id) between 1 and 600 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists "paymentAllocations_doc_idx" on public."paymentAllocations" (workspace_id, (data->>'documentId'), (data->>'date'));
create index if not exists "paymentAllocations_party_idx" on public."paymentAllocations" (workspace_id, (data->>'partyId'), (data->>'date'));
create index if not exists "paymentAllocations_source_idx" on public."paymentAllocations" (workspace_id, (data->>'sourceId'));
alter table public."paymentAllocations" enable row level security;

create table public."allocationOperations" (
  id text primary key
    check (char_length(id) between 1 and 600 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists "allocationOperations_ws_idx" on public."allocationOperations" (workspace_id);
alter table public."allocationOperations" enable row level security;

-- no browser writes (no insert/update/delete policies); the rows exist for the guard trigger
insert into public.lf_rules (table_name) values ('paymentAllocations'), ('allocationOperations') on conflict (table_name) do nothing;

drop trigger if exists lf_guard on public."paymentAllocations";
create trigger lf_guard before insert or update or delete on public."paymentAllocations"
  for each row execute function public.lf_guard();
drop policy if exists member_read on public."paymentAllocations";
create policy member_read on public."paymentAllocations" for select to authenticated
  using (public.lf_is_member(workspace_id));
grant select on public."paymentAllocations" to authenticated;
revoke all on public."paymentAllocations" from anon;

drop trigger if exists lf_guard on public."allocationOperations";
create trigger lf_guard before insert or update or delete on public."allocationOperations"
  for each row execute function public.lf_guard();
drop policy if exists member_read on public."allocationOperations";
create policy member_read on public."allocationOperations" for select to authenticated
  using (public.lf_is_member(workspace_id));
grant select on public."allocationOperations" to authenticated;
revoke all on public."allocationOperations" from anon;
