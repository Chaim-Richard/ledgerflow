# Runbook: a database migration fails while deploying

**What people see:** a deployment that stops, logs ending with `ERROR: …` and a migration file name,
or CI red at **Prepare the test database (Supabase migrations)**.

Migrations are the database's own history: `supabase/migrations/*.sql`, applied **in file-name
order**. A failing file stops the ones after it, so the answer is never "skip it".

## 1. Read the failing line before touching anything

Each migration is a plain SQL file. The error line tells you which of these it is:

| Error | Meaning | Do |
|---|---|---|
| `already exists` (table, column, policy, function) | the statement was applied before, by hand or by a half-finished run | the migration needs `if not exists` (a code change, reviewed) — do **not** delete the object to make it pass |
| `relation … does not exist` | an earlier migration never ran, or ran in the wrong database | apply the missing earlier files in order, or restore the database from before the change |
| `permission denied` | the connection string is not the owner/`postgres` role | use the database owner's connection string; the app's runtime user is not enough |
| `duplicate key value` | a data-migration statement inserted a row that is already there | the statement needs `on conflict do nothing` — a code change |
| `canceling statement due to lock timeout` | another connection holds the table | retry when idle; if it repeats, the owner checks for long-running queries |

## 2. In CI (the safe place to see it)

```
npm run db:test-setup        # applies the plain-Postgres stub, then every migration in order
```
against a **local** database (`LF_TEST_DATABASE_URL`). The script refuses to install the test stub
into a Supabase host, so this cannot damage a real database. Fix the migration here, push, and let CI
run the same steps plus `npm run test:rules`.

## 3. In production

1. **Stop.** Do not re-run the deployment "to see if it helps" — a partially applied migration is
   worse than a failed one, and the app may now be running against half a schema.
2. Write down: the file name, the exact `ERROR` line, and the time.
3. Ask the owner (only the owner changes production) to confirm **which files already applied**. Every
   migration is written to be checkable by eye: tables, `lf_rules` rows and policies are all
   `create … if not exists`-shaped in recent files, older ones are not.
4. The safe options, in order:
   - **roll forward** — a new migration that finishes the job (`alter table … add column if not
     exists`, backfill, then the constraint);
   - **restore the pre-deploy backup** and deploy the previous version — this loses everything
     entered since the backup, so it is the owner's call, made in writing.
5. Nothing is "fixed" by dropping a table to get past the error. Call it what it is: data loss.

## 4. After it is fixed

1. `/status` → **Database: Answering.**
2. Run the security rules tests (`npm run test:rules`) — a policy that failed to install is a
   permission hole, and it does not announce itself.
3. Write the cause in the pull request (a short paragraph is enough) so the next person does not
   re-learn it.
