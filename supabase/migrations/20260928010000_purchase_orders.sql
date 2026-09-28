-- Purchase orders are saved (before this they lived only in the open page), with their goods
-- receipts, and turn into a bill (BE-11). Members read; owners, accountants and bookkeepers write.

create table public."purchaseOrders" (
  id text primary key
    check (char_length(id) between 1 and 127 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index "purchaseOrders_ws_idx" on public."purchaseOrders" (workspace_id);
alter table public."purchaseOrders" enable row level security;

insert into public.lf_rules (table_name, allowed_keys, immutable_keys) values
  ('purchaseOrders', '{id,uid,workspaceId,poNumber,vendorId,vendorName,issueDate,expectedDeliveryDate,status,items,totalAmountCents,currency,notes,approvalStatus,approvedBy,approvedAt,receipts,billId,createdAt,updatedAt}',
                     '{workspaceId}');

create trigger lf_guard before insert or update or delete on public."purchaseOrders"
  for each row execute function public.lf_guard();

create policy member_read on public."purchaseOrders" for select to authenticated
  using (public.lf_is_member(workspace_id));
create policy writer_insert on public."purchaseOrders" for insert to authenticated
  with check (public.lf_can_write(workspace_id));
create policy writer_update on public."purchaseOrders" for update to authenticated
  using (public.lf_can_write(workspace_id)) with check (public.lf_can_write(workspace_id));
create policy writer_delete on public."purchaseOrders" for delete to authenticated
  using (public.lf_can_write(workspace_id));

grant select, insert, update, delete on public."purchaseOrders" to authenticated;
revoke all on public."purchaseOrders" from anon;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public."purchaseOrders";
  end if;
end $$;
