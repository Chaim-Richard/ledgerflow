# 3. Postgres with one jsonb document table per collection

## Status
Accepted (replaces the Firestore-era assumption in [ADR 1](0001-top-level-collections.md); the
top-level, workspace-scoped shape stays).

## Context
The app was written against `firebase-admin`'s Firestore API — `collection().doc().get()/set()/
update()`, queries with `where/orderBy/limit/startAfter`, batched writes and transactions — in the
browser (`src/lib/db/`) and in about a hundred server modules. The data has to live in Supabase
Postgres, because the product needs SQL-level security rules, one database the server and the
browser can both be checked against, and a normal backup/restore story.

Rewriting every caller to SQL would have touched the whole codebase at once — the riskiest kind of
change in an accounting system.

## Decision
Keep the API, change the storage engine. Every collection is one table:

```sql
create table <collection> (
  id text primary key,
  data jsonb not null,
  workspace_id text generated always as (data->>'workspaceId') stored,
  created_at timestamptz, updated_at timestamptz
);
```

- `src/server/db/pgFirestore.ts` implements the part of the Firestore API the server uses, on
  Postgres; `src/server/db/firestore.ts` chooses it with `getDb()`.
- The browser keeps the same Firestore-style helpers in `src/lib/db/`, which talk to Supabase and
  are subject to row level security.
- Reserved keys stay out of `data` (see `lf_rules`), so a document cannot smuggle itself into
  another workspace or past a check.

## Consequences
- Callers did not change; the security model is enforced in one place (the database), not in every
  route.
- Firestore semantics we depend on are re-implemented and pinned by tests (transactions are
  `SERIALIZABLE` with retries; `create()` fails with `ALREADY_EXISTS`; queries order by document id
  last; missing order-by fields are excluded).
- A new collection needs a migration with its table, `lf_rules` row and policies — see
  `AGENTS.md` §5 and `generateEntitySql()`.
- Trade-off: jsonb columns are not self-documenting in SQL. Types live in `src/model/` and the
  field-level guards in `lf_rules`/`lf_guard` are the schema for browser writes.
