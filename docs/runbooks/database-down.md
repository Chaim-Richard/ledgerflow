# Runbook: the database is down (or slow)

**What people see:** the app opens but lists are empty or never stop loading, saves fail with
"could not save"/500, reports show old numbers, or the trial balance disagrees with the ledger.

## 1. Confirm from outside the app

Open **`/status`**:

| Database says | Meaning | Do |
|---|---|---|
| **Answering.** | The database is fine — the problem is one screen or one connection | go to step 3 |
| **Slow (n ms).** | Answering, over 2 seconds | note the time and the figure, tell the owner; expect timeouts and missing figures on heavy reports |
| **Not answering.** | The server cannot reach the database | step 2 |

A quick second opinion: **`GET /api/health`** answers `{"status":"ok"…}` when the *server* is up. If
the server is up and the database is not, the two answers differ — that is exactly the case below.

## 2. Database not answering

1. **Do not tell people their data is lost.** Nothing in the app deletes data because the database is
   unreachable; screens show what they already had. Say "save later, keep working offline" and give
   no promise about when the data will be visible.
2. **Do not restore a backup to "get it working".** A restore writes into a database that may already
   hold the newer rows, and it is done by the owner.
3. Hand over to the owner with: the exact time it started, the `/status` line, and whether it affects
   everyone or one workspace. The owner (or the hosting provider's status page) checks:
   - the database provider's own dashboard/status page;
   - whether the connection string (`DATABASE_URL`) was rotated or a certificate changed
     (`DATABASE_CA_CERT` — the server verifies the database's certificate, so an expired certificate
     looks exactly like "down");
   - free space and connection limits on the database plan.

## 3. Single screen or single workspace

1. Ask for the **workspace name**, the **screen**, and the **exact message**.
2. Reload the page once. The app keeps a cached copy of the ledger; a reload asks the server again.
3. If a figure looks wrong but saves work, that is **not** an outage: record the two figures, the
   document and the date, and send it to the lead (AI #1). Money and report differences are never
   fixed by a developer in production.

## 4. After it comes back

1. Check `/status` reads **Answering.** and **Scheduled jobs** shows the last daily run normally.
2. Ask the people who were saving during the outage to check their **last document** — a save
   interrupted at the wrong moment may not have completed. Re-entering the same invoice twice is the
   usual outage damage.
3. Reconcile nothing by hand. If a document looks posted twice, report it: a reversal and repost is
   the fix, and it is a lead decision.
