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

select 'ALL RLS TESTS PASSED' as result;
rollback;
