# Runbook: a bank feed stops, or asks to reconnect

**What people see:** new bank lines stop appearing; a notice says *"<bank> needs to be reconnected —
the bank login expired, so new bank lines can't be downloaded. Open Banking and choose Reconnect."*;
or Banking says there are no bank connections at all.

## 1. Which of the three cases is it?

Open **`/status`** → **Bank feeds**:

- **"Bank feeds is not set up on this installation."** — no bank-feed credentials exist, so no bank
  can be connected, now or later. This is an owner/installation matter (`PLAID_CLIENT_ID`,
  `PLAID_SECRET`, `PLAID_ENV`). Nothing a user does will help. Import a statement file instead
  (Banking → Import statement) so the books stay current.
- **"Set up."** — go to step 2.

Then look at the connection's own state on the bank connection (its **status**):

| Status | Meaning | What to do |
|---|---|---|
| `active` | connected, last sync answered | the bank simply had nothing new, or the sync has not run yet |
| `login_required` | the bank's login expired | **Reconnect** (step 2) |
| `error` | the last sync failed for another reason | read the connection's **sync log** (step 3) |

## 2. Reconnect (the normal case)

A person with the owner, accountant or bookkeeper role, in the same workspace:

1. Open **Banking**, find the account, choose **Reconnect**.
2. Sign in at the bank and approve access. Reconnecting **keeps the existing connection** — do not
   create a second connection to the same account, or every transfer will be imported twice.
3. The next sync downloads the lines missed while the login was expired. The connection's
   `lastSyncedAt` only moves forward when a sync answers, so a still-old date means the reconnect did
   not take.

## 3. `error`, or a sync that keeps failing

1. Read the connection's **sync log** — each attempt is recorded with its result and the provider's
   error code (`src/server/routes/plaidRoutes.ts`, `appendSyncLog`). The code is the whole answer:
   `INSTITUTION_DOWN`, `INVALID_CREDENTIALS`, `ITEM_NOT_FOUND`, rate limits and so on.
2. A provider-wide outage (`INSTITUTION_DOWN`) fixes itself; tell the user when it started and that
   nothing is lost — the next successful sync brings the missing lines.
3. `ITEM_NOT_FOUND` (the connection was revoked at the bank) needs a new connection: remove the old
   one first, then connect again.
4. Credentials changed at the bank → reconnect (step 2), which is exactly the same flow.
5. Do not paste API keys, access tokens or the sync log's full JSON into a customer-facing message.

## 4. Books already matched must not move

Reconnecting and re-syncing **updates bank lines, not ledger entries**. If a screen looks as though
entries appeared twice after a reconnect, stop and report it to the lead with the workspace name, the
bank account and the two entry ids. Do not delete bank lines to tidy it up: a deleted bank line takes
its match with it.
