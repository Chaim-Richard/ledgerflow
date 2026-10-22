-- L-123 step 1: a balance snapshot per closed year end (docs/design/L-123-server-balances.md).
-- One document per workspace and year end (id `<workspaceId>_<asOf>`), written only by the server
-- (src/server/services/balanceService.ts): `/close-year` builds it in the same transaction that moves the
-- lock date, and the rebuild path makes the snapshots of years closed earlier. It holds every account's
-- base-currency cents (debit positive) over the postable entries dated on or before `asOf`, the same by
-- label, the cumulative profit, and how many entries it sums with a checksum over them.
-- Members read it; nobody writes it from the browser (RLS like stockMoves).
--
-- Keeping it right: any insert, update or delete of an entry dated on or before a snapshot's `asOf` (its
-- old or its new date), from any path, the server's included, marks that snapshot stale. A stale
-- snapshot is never read: balancesAsOf falls back to the newest fresh one before it, or to the entries.

create table public."periodBalances" (
  id text primary key
    check (char_length(id) between 1 and 200 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists "periodBalances_ws_idx" on public."periodBalances" (workspace_id, (data->>'asOf'));
alter table public."periodBalances" enable row level security;

-- no browser writes (no insert/update/delete policies); the row exists for the guard trigger
insert into public.lf_rules (table_name) values ('periodBalances') on conflict (table_name) do nothing;
drop trigger if exists lf_guard on public."periodBalances";
create trigger lf_guard before insert or update or delete on public."periodBalances"
  for each row execute function public.lf_guard();

drop policy if exists member_read on public."periodBalances";
create policy member_read on public."periodBalances" for select to authenticated
  using (public.lf_is_member(workspace_id));

grant select on public."periodBalances" to authenticated;
revoke all on public."periodBalances" from anon;

-- The stale mark. Security definer: a member editing an entry in a reopened range has no write access to
-- the snapshots, yet must mark them.
create or replace function public.lf_period_balances_stale() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  d text;
  ws text;
begin
  for ws, d in
    select x.ws, left(x.d, 10) from (values
      (case when tg_op in ('UPDATE', 'DELETE') then old.workspace_id end, case when tg_op in ('UPDATE', 'DELETE') then old.data->>'date' end),
      (case when tg_op in ('INSERT', 'UPDATE') then new.workspace_id end, case when tg_op in ('INSERT', 'UPDATE') then new.data->>'date' end)
    ) as x(ws, d)
  loop
    if ws is null or coalesce(d, '') = '' then continue; end if;
    update public."periodBalances"
       set data = data || jsonb_build_object('stale', true, 'staleSince', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
           updated_at = now()
     where workspace_id = ws and data->>'asOf' >= d and coalesce(data->>'stale', 'false') <> 'true';
  end loop;
  return null;
end;
$$;
revoke execute on function public.lf_period_balances_stale() from public, anon, authenticated;

drop trigger if exists lf_period_balances_stale on public.transactions;
create trigger lf_period_balances_stale after insert or update or delete on public.transactions
  for each row execute function public.lf_period_balances_stale();
