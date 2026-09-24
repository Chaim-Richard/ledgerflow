-- Row level security tests (replaces the Firestore rules emulator tests).
-- Run against a database with the migrations applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
-- Every check raises an exception when the result is not the expected one, and the
-- whole run is rolled back, so it can run against any database without leaving data.

begin;

create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', uid, 'email', uid || '@test.local')::text, true);
  execute 'set local role authenticated';
end $$;

-- expect_ok / expect_denied run one statement as a user inside a savepoint-like block
create function pg_temp.expect_ok(label text, uid text, stmt text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(uid);
  begin
    execute stmt;
  exception when others then
    execute 'reset role';
    raise exception 'FAIL %: expected ok, got: %', label, sqlerrm;
  end;
  execute 'reset role';
end $$;

create function pg_temp.expect_denied(label text, uid text, stmt text) returns void language plpgsql as $$
declare denied boolean := false;
begin
  perform pg_temp.as_user(uid);
  begin
    execute stmt;
  exception when others then
    denied := true;
  end;
  execute 'reset role';
  if not denied then
    raise exception 'FAIL %: expected to be refused, but it succeeded', label;
  end if;
end $$;

create function pg_temp.expect_count(label text, uid text, q text, expected bigint) returns void language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.as_user(uid);
  execute q into n;
  execute 'reset role';
  if n is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, n;
  end if;
end $$;

create function pg_temp.expect_value(label text, q text, expected text) returns void language plpgsql as $$
declare v text;
begin
  execute q into v;
  if v is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, v;
  end if;
end $$;

-- workspace ws1: owner u-owner; accountant u-acct; bookkeeper u-book; viewer u-view. u-out is an outsider.
select pg_temp.expect_ok('owner creates workspace', 'u-owner',
  $$insert into workspaces(id,data) values ('ws1', '{"uid":"u-owner","name":"Acme","roles":{"u-acct":"accountant","u-book":"bookkeeper","u-view":"viewer"}}')$$);
select pg_temp.expect_denied('create a workspace owned by someone else', 'u-out',
  $$insert into workspaces(id,data) values ('ws-x', '{"uid":"u-owner","name":"X"}')$$);
select pg_temp.expect_denied('create a workspace on a paid plan', 'u-out',
  $$insert into workspaces(id,data) values ('ws-y', '{"uid":"u-out","name":"Y","plan":"enterprise"}')$$);

-- documents: members read, writers write, outsiders see nothing
select pg_temp.expect_ok('bookkeeper adds invoice', 'u-book',
  $$insert into invoices(id,data) values ('inv1', '{"workspaceId":"ws1","status":"sent","date":"2026-03-01","amountCents":1000}')$$);
select pg_temp.expect_denied('viewer adds invoice', 'u-view',
  $$insert into invoices(id,data) values ('inv2', '{"workspaceId":"ws1","status":"draft","date":"2026-03-01"}')$$);
select pg_temp.expect_count('viewer reads invoices', 'u-view', 'select count(*) from invoices', 1);
select pg_temp.expect_count('outsider reads invoices', 'u-out', 'select count(*) from invoices', 0);
select pg_temp.expect_denied('outsider writes into ws1', 'u-out',
  $$insert into invoices(id,data) values ('inv3', '{"workspaceId":"ws1","status":"draft"}')$$);
select pg_temp.expect_denied('move a document to another workspace', 'u-book',
  $$select lf_update('invoices','inv1','{"workspaceId":"ws2"}'::jsonb)$$);

-- drafts only may be deleted
select pg_temp.expect_denied('delete a sent invoice', 'u-book', $$select lf_delete('invoices','inv1')$$);
select pg_temp.expect_ok('delete a draft invoice', 'u-book',
  $$insert into invoices(id,data) values ('inv4', '{"workspaceId":"ws1","status":"draft","date":"2026-03-02"}'); select lf_delete('invoices','inv4')$$);

-- lock date
select pg_temp.expect_denied('bookkeeper sets the lock date', 'u-book',
  $$select lf_update('workspaces','ws1','{"lockDate":"2026-01-31"}'::jsonb)$$);
select pg_temp.expect_ok('accountant sets the lock date', 'u-acct',
  $$select lf_update('workspaces','ws1','{"lockDate":"2026-01-31"}'::jsonb)$$);
select pg_temp.expect_denied('transaction in a locked period', 'u-book',
  $$insert into transactions(id,data) values ('tx1', '{"workspaceId":"ws1","date":"2026-01-15","lines":[]}')$$);
select pg_temp.expect_denied('transaction without a date while locked', 'u-book',
  $$insert into transactions(id,data) values ('tx2', '{"workspaceId":"ws1","lines":[]}')$$);
select pg_temp.expect_ok('transaction in an open period', 'u-book',
  $$insert into transactions(id,data) values ('tx3', '{"workspaceId":"ws1","date":"2026-02-01","status":"draft","lines":[]}')$$);
select pg_temp.expect_denied('move a transaction into a locked period', 'u-book',
  $$select lf_update('transactions','tx3','{"date":"2026-01-10"}'::jsonb)$$);

-- workspace billing fields can't be changed by users
select pg_temp.expect_denied('owner changes plan', 'u-owner',
  $$select lf_update('workspaces','ws1','{"plan":"enterprise"}'::jsonb)$$);

-- allowed fields
select pg_temp.expect_denied('customer with an unknown field', 'u-book',
  $$insert into customers(id,data) values ('c1', '{"workspaceId":"ws1","name":"A","hack":1}')$$);
select pg_temp.expect_ok('customer', 'u-book',
  $$insert into customers(id,data) values ('c2', '{"workspaceId":"ws1","name":"A"}')$$);

-- chart of accounts
select pg_temp.expect_denied('bookkeeper adds an account', 'u-book',
  $$insert into "chartAccounts"(id,data) values ('a1', '{"workspaceId":"ws1","name":"Cash","type":"asset"}')$$);
select pg_temp.expect_ok('accountant adds a system account', 'u-acct',
  $$insert into "chartAccounts"(id,data) values ('a2', '{"workspaceId":"ws1","name":"Cash","type":"asset","code":"1000","isSystem":true}')$$);
select pg_temp.expect_denied('change a system account code', 'u-acct',
  $$select lf_update('chartAccounts','a2','{"code":"9999"}'::jsonb)$$);
select pg_temp.expect_denied('delete a system account', 'u-acct', $$select lf_delete('chartAccounts','a2')$$);

-- server-only tables
select pg_temp.expect_denied('browser writes a bank line', 'u-owner',
  $$insert into "bankLines"(id,data) values ('b1', '{"workspaceId":"ws1"}')$$);
select pg_temp.expect_denied('browser reads idempotency keys', 'u-owner',
  $$do $d$ begin if (select count(*) from "idempotencyKeys") >= 0 then null; end if; end $d$;
    insert into "idempotencyKeys"(id,data) values ('k1','{}')$$);

-- audit logs: append-only, identity must match
select pg_temp.expect_denied('audit log with a spoofed uid', 'u-book',
  $$insert into "auditLogs"(id,data) values ('l1', '{"workspaceId":"ws1","uid":"u-owner","action":"X"}')$$);
select pg_temp.expect_ok('audit log as yourself', 'u-book',
  $$insert into "auditLogs"(id,data) values ('l2', '{"workspaceId":"ws1","uid":"u-book","email":"u-book@test.local","action":"X","timestamp":"2026-01-01T00:00:00Z"}')$$);
select pg_temp.expect_ok('viewer logs a sign-in', 'u-view',
  $$insert into "auditLogs"(id,data) values ('l3', '{"workspaceId":"ws1","uid":"u-view","action":"USER_LOGIN"}')$$);
select pg_temp.expect_denied('viewer logs another action', 'u-view',
  $$insert into "auditLogs"(id,data) values ('l4', '{"workspaceId":"ws1","uid":"u-view","action":"DELETE_ALL"}')$$);
select pg_temp.expect_denied('edit an audit log', 'u-owner', $$select lf_update('auditLogs','l2','{"action":"Y"}'::jsonb)$$);
select pg_temp.expect_denied('delete an audit log', 'u-owner', $$select lf_delete('auditLogs','l2')$$);

-- user profiles
select pg_temp.expect_denied('make yourself a platform admin', 'u-out',
  $$insert into users(id,data) values ('u-out', '{"uid":"u-out","email":"u-out@test.local","role":"admin"}')$$);
select pg_temp.expect_ok('create your own profile', 'u-out',
  $$insert into users(id,data) values ('u-out', '{"uid":"u-out","email":"u-out@test.local","role":"client"}')$$);
select pg_temp.expect_count('read another user profile', 'u-book', $$select count(*) from users where id='u-out'$$, 0);

-- write helpers keep Firestore semantics
select pg_temp.expect_ok('update with a dotted path', 'u-book',
  $$select lf_update('customers','c2','{"address.city":"Paris","name":"B"}'::jsonb)$$);
select pg_temp.expect_value('dotted path result', $$select data::text from customers where id='c2'$$,
  '{"name": "B", "address": {"city": "Paris"}, "workspaceId": "ws1"}');
select pg_temp.expect_denied('update a missing document', 'u-book',
  $$select lf_update('customers','nope','{"name":"x"}'::jsonb)$$);
select pg_temp.expect_ok('set with merge', 'u-book',
  $$select lf_set('customers','c2','{"address":{"zip":"75001"}}'::jsonb, true)$$);
select pg_temp.expect_value('merge result', $$select data::text from customers where id='c2'$$,
  '{"name": "B", "address": {"zip": "75001", "city": "Paris"}, "workspaceId": "ws1"}');
select pg_temp.expect_ok('unset a field', 'u-book', $$select lf_update('customers','c2','{}'::jsonb, '{address.city}')$$);
select pg_temp.expect_value('unset result', $$select data::text from customers where id='c2'$$,
  '{"name": "B", "address": {"zip": "75001"}, "workspaceId": "ws1"}');
select pg_temp.expect_ok('increment twice', 'u-owner',
  $$select lf_update('invoices','inv1','{}'::jsonb,'{}','{"amountPaidCents":250}'::jsonb);
    select lf_update('invoices','inv1','{}'::jsonb,'{}','{"amountPaidCents":250}'::jsonb)$$);
select pg_temp.expect_value('increment result', $$select data->>'amountPaidCents' from invoices where id='inv1'$$, '500');
select pg_temp.expect_ok('array union then remove', 'u-owner',
  $$select lf_update('workspaces','ws1','{}'::jsonb,'{}','{}'::jsonb,'{"members":["u-a","u-b"]}'::jsonb);
    select lf_update('workspaces','ws1','{}'::jsonb,'{}','{}'::jsonb,'{"members":["u-b","u-c"]}'::jsonb,'{"members":["u-a"]}'::jsonb)$$);
select pg_temp.expect_value('array result', $$select (data->'members')::text from workspaces where id='ws1'$$, '["u-b", "u-c"]');
select pg_temp.expect_denied('batch with one refused write', 'u-book',
  $$select lf_batch('[{"op":"set","table":"vendors","id":"v1","data":{"workspaceId":"ws1","name":"V"}},{"op":"set","table":"bankLines","id":"b9","data":{"workspaceId":"ws1"}}]'::jsonb)$$);
select pg_temp.expect_value('batch is all-or-nothing', $$select count(*)::text from vendors where id='v1'$$, '0');
select pg_temp.expect_denied('batch on a system table', 'u-book',
  $$select lf_batch('[{"op":"delete","table":"pg_authid","id":"x"}]'::jsonb)$$);

-- ===== Table-driven checks (ported from the Firestore rules suite) =====

create function pg_temp.try_as(uid text, stmt text) returns boolean language plpgsql as $$
begin
  perform pg_temp.as_user(uid);
  begin
    execute stmt;
  exception when others then
    execute 'reset role';
    return false;
  end;
  execute 'reset role';
  return true;
end $$;

create function pg_temp.count_rows(uid text, q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.as_user(uid);
  execute q into n;
  execute 'reset role';
  return n;
end $$;

-- Every standard workspace table: writers add, viewers only read, outsiders see and change nothing.
do $$
declare
  t text;
  doc text;
begin
  foreach t in array array[
    'transactions','journalEntries','invoices','payments','bills','creditNotes','vendorCredits',
    'projects','estimates','inventory','recurring','budgets','autoRules','fixedAssets','assets',
    'taxRates','dimensionNodes','vendors','customers','periods','rulePatterns','scenarios',
    'employees','payRuns','partners','reconciliations','workspaceShards'
  ] loop
    doc := case when t = 'transactions' then '{"workspaceId":"ws1","date":"2026-02-15","status":"draft"}'
                else '{"workspaceId":"ws1"}' end;
    if not pg_temp.try_as('u-book', format('insert into public.%I (id, data) values (%L, %L::jsonb)', t, 'iso-' || t, doc)) then
      raise exception 'FAIL %: bookkeeper could not add a document', t;
    end if;
    if pg_temp.try_as('u-view', format('insert into public.%I (id, data) values (%L, %L::jsonb)', t, 'iso-v-' || t, doc)) then
      raise exception 'FAIL %: viewer added a document', t;
    end if;
    if pg_temp.try_as('u-out', format('insert into public.%I (id, data) values (%L, %L::jsonb)', t, 'iso-o-' || t, doc)) then
      raise exception 'FAIL %: outsider added a document', t;
    end if;
    if pg_temp.count_rows('u-view', format('select count(*) from public.%I where id = %L', t, 'iso-' || t)) <> 1 then
      raise exception 'FAIL %: viewer cannot read', t;
    end if;
    if pg_temp.count_rows('u-out', format('select count(*) from public.%I where id = %L', t, 'iso-' || t)) <> 0 then
      raise exception 'FAIL %: outsider can read', t;
    end if;
    if pg_temp.try_as('u-out', format('select lf_update(%L, %L, %L::jsonb)', t, 'iso-' || t, '{"workspaceId":"ws1"}')) then
      raise exception 'FAIL %: outsider updated a document', t;
    end if;
    if pg_temp.try_as('u-view', format('select lf_update(%L, %L, %L::jsonb)', t, 'iso-' || t, '{"workspaceId":"ws1"}')) then
      raise exception 'FAIL %: viewer updated a document', t;
    end if;
  end loop;
end $$;

-- Every dated table: nothing is posted into, or moved into, a locked period (ws1 is locked to 2026-01-31).
do $$
declare t text;
begin
  for t in select table_name from public.lf_rules where dated order by 1 loop
    if pg_temp.try_as('u-book', format('insert into public.%I (id, data) values (%L, %L::jsonb)', t, 'lock-in-' || t,
        '{"workspaceId":"ws1","date":"2026-01-15","status":"draft"}')) then
      raise exception 'FAIL %: posted into a locked period', t;
    end if;
    if not pg_temp.try_as('u-book', format('insert into public.%I (id, data) values (%L, %L::jsonb)', t, 'lock-out-' || t,
        '{"workspaceId":"ws1","date":"2026-02-15","status":"draft"}')) then
      raise exception 'FAIL %: could not post into an open period', t;
    end if;
    if pg_temp.try_as('u-book', format('select lf_update(%L, %L, %L::jsonb)', t, 'lock-out-' || t, '{"date":"2026-01-10"}')) then
      raise exception 'FAIL %: moved a document into a locked period', t;
    end if;
  end loop;
end $$;

-- Every financial document table: only drafts can be deleted (void instead).
do $$
declare
  t text;
  st text;
begin
  for t in select table_name from public.lf_rules where delete_draft_only order by 1 loop
    foreach st in array array['sent', 'posted', 'paid', 'void'] loop
      perform set_config('request.jwt.claims', '', true);
      execute format('insert into public.%I (id, data) values (%L, %L::jsonb)', t, 'del-' || st || '-' || t,
        json_build_object('workspaceId', 'ws1', 'date', '2026-02-20', 'status', st)::text);
      if pg_temp.try_as('u-owner', format('select lf_delete(%L, %L)', t, 'del-' || st || '-' || t)) then
        raise exception 'FAIL %: deleted a % document', t, st;
      end if;
    end loop;
    if not pg_temp.try_as('u-owner', format('select lf_delete(%L, %L)', t, 'lock-out-' || t)) then
      raise exception 'FAIL %: could not delete a draft', t;
    end if;
  end loop;
end $$;

-- Server-only tables: no browser reads or writes at all.
do $$
declare t text;
begin
  foreach t in array array['stripeProcessedEvents','idempotencyKeys','external_api_cache','jobRuns','loginAudits',
                           'emailEvents','numberingSeries','members','banks','admins'] loop
    perform set_config('request.jwt.claims', '', true);
    execute format('insert into public.%I (id, data) values (%L, %L::jsonb)', t, 'srv-' || t, '{"workspaceId":"ws1","uid":"u-owner"}');
    if pg_temp.count_rows('u-owner', format('select count(*) from public.%I', t)) <> 0 then
      raise exception 'FAIL %: a browser user can read a server-only table', t;
    end if;
    if pg_temp.try_as('u-owner', format('insert into public.%I (id, data) values (%L, %L::jsonb)', t, 'cli-' || t, '{"workspaceId":"ws1"}')) then
      raise exception 'FAIL %: a browser user can write a server-only table', t;
    end if;
  end loop;
end $$;

-- Platform admin comes from app_metadata (set by the server), never from an email address.
do $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', 'u-evil', 'email', 'admin@ledgerflow.app')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from workspaces where id = 'ws1';
  execute 'reset role';
  if n <> 0 then raise exception 'FAIL an admin-looking email reads other workspaces'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', 'u-admin', 'app_metadata', json_build_object('admin', true))::text, true);
  execute 'set local role authenticated';
  select count(*) into n from workspaces where id = 'ws1';
  execute 'reset role';
  if n <> 1 then raise exception 'FAIL a platform admin cannot read workspaces'; end if;
end $$;

-- Profiles and balances the browser may not change
select pg_temp.expect_denied('change your own role', 'u-out', $$select lf_update('users','u-out','{"role":"admin"}'::jsonb)$$);
select pg_temp.expect_denied('profile with someone else''s email', 'u-new',
  $$insert into users(id,data) values ('u-new', '{"uid":"u-new","email":"other@test.local","role":"client"}')$$);
select pg_temp.expect_denied('change an account balance', 'u-acct', $$select lf_update('chartAccounts','a2','{"balanceCents":999}'::jsonb)$$);
select pg_temp.expect_denied('change an opening balance', 'u-acct', $$select lf_update('chartAccounts','a2','{"openingBalanceCents":5}'::jsonb)$$);
select pg_temp.expect_ok('posting without a lock date', 'u-out',
  $$insert into workspaces(id,data) values ('ws-open', '{"uid":"u-out","name":"Open"}');
    insert into transactions(id,data) values ('tx-open', '{"workspaceId":"ws-open","date":"2020-01-01","lines":[]}')$$);

-- Support tickets and messages
select pg_temp.expect_ok('member opens a ticket', 'u-view',
  $$insert into "supportTickets"(id,data) values ('t1', '{"workspaceId":"ws1","uid":"u-view","subject":"Help","status":"open","createdAt":"2026-02-01"}')$$);
select pg_temp.expect_denied('open a ticket for someone else', 'u-view',
  $$insert into "supportTickets"(id,data) values ('t2', '{"workspaceId":"ws1","uid":"u-book","subject":"Help","status":"open"}')$$);
select pg_temp.expect_denied('outsider opens a ticket in ws1', 'u-out',
  $$insert into "supportTickets"(id,data) values ('t3', '{"workspaceId":"ws1","uid":"u-out","subject":"Help","status":"open"}')$$);
select pg_temp.expect_count('outsider reads ws1 tickets', 'u-out', $$select count(*) from "supportTickets" where workspace_id = 'ws1'$$, 0);
select pg_temp.expect_ok('user closes their ticket', 'u-view', $$select lf_update('supportTickets','t1','{"status":"closed"}'::jsonb)$$);
select pg_temp.expect_denied('user reopens a ticket', 'u-view', $$select lf_update('supportTickets','t1','{"status":"open"}'::jsonb)$$);
select pg_temp.expect_ok('member posts a message', 'u-view',
  $$insert into "supportMessages"(id,data) values ('m1', '{"ticketId":"t1","workspaceId":"ws1","authorUid":"u-view","authorRole":"user","body":"Hi"}')$$);
select pg_temp.expect_denied('member poses as support staff', 'u-view',
  $$insert into "supportMessages"(id,data) values ('m2', '{"ticketId":"t1","workspaceId":"ws1","authorUid":"u-view","authorRole":"admin","body":"Hi"}')$$);
select pg_temp.expect_denied('edit a message', 'u-view', $$select lf_update('supportMessages','m1','{"body":"changed"}'::jsonb)$$);

-- document ids: browser writes keep firestore.rules isValidId; server writes may be long
select pg_temp.expect_ok('browser id of 127 characters', 'u-book',
  format($f$select lf_set('vendors', %L, '{"workspaceId":"ws1","name":"V"}'::jsonb)$f$, repeat('v', 127)));
select pg_temp.expect_denied('browser id of 128 characters', 'u-book',
  format($f$select lf_set('vendors', %L, '{"workspaceId":"ws1","name":"V"}'::jsonb)$f$, repeat('v', 128)));
select pg_temp.expect_denied('browser id with a space', 'u-book',
  $$select lf_set('vendors', 'has space', '{"workspaceId":"ws1","name":"V"}'::jsonb)$$);
select set_config('request.jwt.claims', '', true);  -- back to a server connection
insert into "idempotencyKeys" (id, data) values (repeat('k', 400), '{"workspaceId":"ws1"}');
select pg_temp.expect_value('server id of 400 characters', $$select count(*)::text from "idempotencyKeys" where id = repeat('k', 400)$$, '1');

-- two-step login: a user with a verified authenticator needs a code-verified (aal2) session
select set_config('request.jwt.claims', '', true);
insert into auth.users (id, email) values ('7a0c5c4e-0000-4000-8000-00000000a001', 'mfa@test.local');
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
  values ('7a0c5c4e-0000-4000-8000-00000000f001', '7a0c5c4e-0000-4000-8000-00000000a001', 'totp', 'verified', now(), now());
insert into workspaces (id, data) values ('ws-mfa', '{"uid":"7a0c5c4e-0000-4000-8000-00000000a001","name":"MFA"}');
create function pg_temp.count_as(uid text, aal text, q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', uid, 'aal', aal)::text, true);
  execute 'set local role authenticated';
  execute q into n;
  execute 'reset role';
  return n;
end $$;
select pg_temp.expect_value('password-only session sees nothing',
  $$select pg_temp.count_as('7a0c5c4e-0000-4000-8000-00000000a001', 'aal1', 'select count(*) from workspaces')::text$$, '0');
select pg_temp.expect_value('code-verified session sees its workspace',
  $$select pg_temp.count_as('7a0c5c4e-0000-4000-8000-00000000a001', 'aal2', 'select count(*) from workspaces')::text$$, '1');
select pg_temp.expect_count('users without an authenticator are unaffected', 'u-owner', $$select count(*) from workspaces where id = 'ws1'$$, 1);
do $$
declare refused boolean := false;
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', '7a0c5c4e-0000-4000-8000-00000000a001', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin
    insert into customers (id, data) values ('c-mfa', '{"workspaceId":"ws-mfa","name":"X"}');
  exception when others then refused := true;
  end;
  execute 'reset role';
  if not refused then raise exception 'FAIL password-only session wrote a document'; end if;
end $$;

select 'ALL RLS TESTS PASSED' as result;
rollback;
