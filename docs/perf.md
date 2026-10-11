# Load test (C-20)

Measured 2026-10-07 on the local test database (PostgreSQL 16, no network), one workspace with 200,000 entries (two lines each) and 25 accounts. Run it again with `LF_TEST_DATABASE_URL=… npx tsx scripts/load-test.ts 200000 --write`.

| What | Result |
| --- | --- |
| Seeding 200,000 entries (one SQL statement) | 11.9 s |
| The app's query for the newest 20,000 entries, 1,000 a request, one after another | 20 requests, 689 ms in the database (first page 9.2 ms, last 54.7 ms) |
| The same, four requests at a time | 417 ms in the database |
| Size of those 20,000 rows | 6.2 MB of JSON before compression |
| Reading them in the browser (JSON parse) | 59 ms |
| Every account's balance from them (as the reports do) | 23.7 ms |
| All Data Health checks on them | 95.2 ms |
| Every account's balance over all 200,000 entries, worked out by the database | 270 ms |

What it means:

- Over the internet each request also waits for the round trip (about 50–150 ms to the hosted database). One after another, 20 requests add 20 round trips; four at a time, about 5. The app now asks four at a time.
- Later pages cost more in the database than the first (each skips the rows before it); at 20,000 rows that stays small.
- The browser holds at most 20,000 entries, newest first, and says so when there are more. Working every balance out in the database from all 200,000 entries took 0.3 s in this run (a first run on a cold database takes several times longer; the lines sit inside each entry's JSON). Reports over a workspace this size should get their balances from the database instead of holding every entry in the browser (L-123).
