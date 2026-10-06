-- Loans (A-2, K-30, AI #3): a loan the workspace owes — the lender, principal, rate, term, the
-- liability account it sits in, the interest-expense account and the bank it is paid from
-- (src/lib/loans.ts, src/lib/loanSchedule.ts, src/components/finance/LoansView.tsx).
--
-- The row is ordinary workspace data: members read it; owners, accountants and bookkeepers write it
-- (the standard writer policies, the same rule the posting screens follow), and workspaceId may not
-- move. Every entry a loan posts goes through the ordinary /api/v1/transactions route carrying the
-- loan's own reference (LOAN-…), so the ledger stays the ledger and no money is written here.
--
-- NOT APPLIED: the Arena sandbox has no database connection, so this file is checked in for the
-- lead to review and run (the same pattern as the other helper-AI migrations). Until it is applied,
-- saving a loan is refused by the browser and the screen says nothing was saved.

create table public.loans (
  id text primary key
    check (char_length(id) between 1 and 127 and id !~ '[[:space:][:cntrl:]]'),
  data jsonb not null default '{}'::jsonb,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index loans_ws_idx on public.loans (workspace_id);
alter table public.loans enable row level security;

insert into public.lf_rules (table_name, allowed_keys, immutable_keys) values
  ('loans', '{id,uid,workspaceId,lender,principalCents,annualRate,termMonths,startDate,firstPaymentDate,liabilityAccountId,interestAccountId,bankAccountId,currency,reference,note,payments,createdAt,updatedAt}',
            '{workspaceId}');

create trigger lf_guard before insert or update or delete on public.loans
  for each row execute function public.lf_guard();

create policy member_read on public.loans for select to authenticated
  using (public.lf_is_member(workspace_id));
create policy writer_insert on public.loans for insert to authenticated
  with check (public.lf_can_write(workspace_id));
create policy writer_update on public.loans for update to authenticated
  using (public.lf_can_write(workspace_id)) with check (public.lf_can_write(workspace_id));
create policy writer_delete on public.loans for delete to authenticated
  using (public.lf_can_write(workspace_id));

grant select, insert, update, delete on public.loans to authenticated;
revoke all on public.loans from anon;

-- The Loans screen updates live, like the other collections a screen keeps open.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.loans;
  end if;
end $$;
