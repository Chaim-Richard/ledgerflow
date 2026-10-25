# LedgerFlow Security Specification — Supabase/Postgres and Privileged Server

**Engineering status: 14 October 2026.** This document describes mechanisms visible in this repository, their trust boundaries, and checks to run. It is not a certification, penetration test, live-environment attestation, or evidence that every migration or deployment control has been applied. Source references are relative repository paths.

## 1. Two different trust boundaries

**Browser / public database API.** Supabase Auth signs in the browser user. The Firestore-compatible module `src/lib/db/firestore.ts` uses Supabase/PostgREST reads and the database functions `lf_set`, `lf_update`, `lf_delete`, and `lf_batch` for writes. This module's "Firestore" types and method names are compatibility wrappers, **not** Firebase storage or Firestore security rules. Workspace documents are represented by Postgres tables with `id`, JSONB `data`, and a generated `workspace_id` derived from `data.workspaceId`; row-level security (RLS) and database triggers enforce access for authenticated client queries. Source: `supabase/migrations/20260924190000_init.sql` and subsequent migrations; `src/lib/db/firestore.ts`.

**Server / privileged database connection.** Express routes use the Postgres adapter `src/server/db/pgFirestore.ts`. Its database login bypasses row-level security; **browser RLS cannot secure a privileged route**. Every such route needs independently verified identity, the target workspace and role, input validation, and a transaction-safe domain operation. Relevant code: `src/server/auth/apiAuthenticate.ts`, `src/server/routes/workspaceRoutes.ts`, `src/server/middleware/requireLedgerWriter.ts`, `src/server/http/serverKit.ts`, `src/server/routes/*`, `src/services/LedgerPostService.ts`. A route merely having an authenticated token is not proof of authorization.

A third boundary is provider integration and file storage. Provider credentials or binary attachments may be held outside the JSONB document rows. Their exact encryption, access, and backup coverage require a per-integration review; general workspace RLS statements do not cover them automatically.

## 2. Identity and session validation

- Browser sessions use **Supabase Auth**, not Firebase Auth security-rule evaluation. `src/server/auth/supabaseAuth.ts` validates a Supabase access token's cryptographic signature, issuer, audience, expiry and authenticated-user subject. Supported algorithms depend on the project's key configuration. This is not an invitation to accept unsigned or anonymous service credentials.
- Server middleware `apiAuthenticate` checks Bearer tokens and supported API keys. Signed-in sessions have email-verification checks where applicable. Higher-assurance sessions are required when a verified authenticator or a workspace two-step policy requires them; there are narrow setup/recovery exceptions. See `src/server/auth/supabaseAuth.ts`, `src/server/auth/apiAuthenticate.ts`, `supabase/migrations/*_two_step_login.sql`.
- Platform administration is derived from server-maintained app metadata. Workspace roles are separately read from workspace membership/owner data. A token's `uid` alone is never sufficient for workspace access.
- Developer API keys use a stored SHA-256 secret hash compared without ordinary string equality, a workspace binding, expiry, scope checks, and per-key request limiting. API keys are not interchangeable with a person receiving unrestricted access. See `src/server/auth/apiAuthenticate.ts` and `src/server/middleware/rateLimiters.ts`.

**Required evidence:** tests of bad signatures, wrong issuer/audience, expired tokens, missing second factor, outsider workspaces, mismatched API-key workspace/scopes, and revoked keys. Token validation must still be exercised on deployed environments; source alone proves no operational configuration.

## 3. Browser database authorization (Postgres RLS)

The initial migration `supabase/migrations/20260924190000_init.sql` establishes:

| Mechanism | Intended current behavior | Primary evidence |
| --- | --- | --- |
| `lf_uid()` / JWT claims | Read the authenticated subject from the PostgREST JWT context | `lf_claims()`, `lf_uid()` |
| `lf_ws_role(ws)` / `lf_is_member(ws)` | Resolve owner, membership and eligible platform-admin access for workspace rows | SQL helper functions |
| `lf_can_write(ws)` | Allow owner, accountant, bookkeeper, or permitted platform administrator, for tables whose policy permits ordinary writes | Per-table RLS policies |
| `lf_can_admin(ws)` | Stricter owner/accountant administrative decisions | Chart-of-accounts policies and other privileged tables |
| `lf_rules` and `lf_guard()` | Table-specific allowlists, immutable fields (notably `workspaceId`), date locks and draft-only deletion on browser operations | Rules table, guard trigger and subsequent migrations |
| Table-specific RLS | Members can read selected workspace rows; other tables have stronger or special owner, self-only, admin or server-only policies | `CREATE POLICY` statements |

Do **not** claim every row has a universal `uid = auth.uid()` invariant. Workspace documents belong to a workspace, and the applicable identity fields depend on the table. Examples: a profile is restricted to its person; accounts require a stronger role; a saved bill may belong to an organization without carrying the current editor's UID. The original Firebase `request.auth.uid` expression, `affectedKeys()`, and `isWorkspaceMember()` are not the governing Postgres policy language.

Many tables have browser writes allowed for eligible workspace writers. Consequently, do **not** claim all client writes to `transactions` are categorically disabled merely because the posting service exists. The actual RLS policies, `lf_guard` rules, and the server posting door must be checked together. Unbalanced, backdated or direct-posting paths require focused verification rather than assurances inferred from a policy label.

**Migration rule:** each new JSONB collection requires a corresponding table, applicable RLS policy, trigger/rules entry, and migration test; see `AGENTS.md` and the existing `supabase/migrations/` patterns. A source migration that exists in Git does not establish its presence in the live database. Check the applied migration history and row security in each environment.

## 4. Server-side route authorization and money boundaries

The privileged server adapter `src/server/db/pgFirestore.ts` intentionally has broader database access than the browser. Its routes must use `apiAuthenticate`, `requireWorkspaceRole(allowedRoles)`, `authorizeWorkspace`, `requireLedgerWriter`, or an equivalently audited resource-specific check **before reading or mutating protected data**. The guard must validate all workspace IDs named by a request, including nested fields and API-key tenancy; a check on only the URL parameter does not protect cross-workspace record IDs.

Examples from `src/server/routes/workspaceApiRoutes.ts`: backup restore is owner-only; adding or deleting members is owner-only. `src/server/routes/workspaceRoutes.ts` applies more specific roles to modules such as payroll, security settings, incoming events and account merges. Route paths with their own routers or public/webhook entry points need a separate review; do not assume the whole server has one global role gate.

Financial operations must also validate integer cents, document/account references, balanced entries, idempotency or retry keys, and period locks on the **authoritative server posting path**. `src/kernel/validation/DoubleEntryValidator.ts`, `src/services/LedgerPostService.ts`, `src/kernel/validation/TransactionValidator.ts`, `src/lib/periodLock.ts` and relevant routes are evidence to inspect. A UI approval state or a client-side disabled button is never a financial control.

A correction of a previously posted entry must follow the server-approved correction/reversal workflow; whether each case is correctly blocked requires direct regression tests. Never update a historical balance or an accountant's closed period based only on browser state.

## 5. What the database policies actually protect

- **Tenant isolation:** RLS allows the user to see only authorized workspace rows; server paths must enforce it explicitly. Both need cross-tenant attempts in tests.
- **Roles:** the viewer is generally read-only. Other roles differ by table and operation; the role table in the UI is guidance, not a substitute for RLS and route checks.
- **Dates and locks:** `lf_guard` considers `lf_rules.dated` and lock metadata. The actual period-close posting contract is additionally enforced server-side and must be tested for soft locks, exceptions and reversals.
- **Document metadata:** allowed keys, immutable keys and draft-only deletion are table-configured. Do not claim there is one global 10 KB text maximum or one global ID regex for all records without finding and testing it for each path.
- **Audit history:** `auditLogs` has member read and restricted insert policies in the initial migration. Browser updates and deletes are not offered there; server audit writes require separate review. This is not proof that an offsite immutable log or retention service is deployed.

Regression evidence: `supabase/tests/rls.test.sql` exercises workspace members and outsiders, viewer refusals, account policy, lock dates and protected workspace settings. `src/tests/server-write-roles.test.ts` checks server role gates. A passing unit test is not a substitute for a clean database with **all current migrations** and real API requests through a privileged server.

## 6. Secrets, encryption, personal-data safeguards

`src/services/securityService.ts` implements AES-256-GCM for fields that **explicitly call** `encryptSensitiveField`, decrypts authenticated ciphertext, hashes an entity's canonical record with HMAC-SHA256 and a configured salt, and has regex-based log scrubbing. The presence of this service does **not** prove every bank credential, file, card number, support message, API key, or log line passes through it. Inspect each actual call site and every logging/export path. Some masked patterns may miss uncommon encodings or false positives.

Encryption keys and server database credentials must remain on the server, with appropriate configuration and rotation; no fallback secret in production. Test that missing required secrets fail closed. The repository does not itself prove TLS termination, database-at-rest encryption, cloud backup policy, key custody, or deployed secret rotation.

Relevant tests: `src/tests/security-audit.test.ts`, `src/tests/api-key-rate-limit.test.ts` and provider-specific tests. Never paste secrets or real personal data into the security test fixtures or CI logs.

## 7. HTTP perimeter and asynchronous work

`src/server/http/securityMiddleware.ts` configures allowed-origin CORS, Helmet headers, production CSP/HSTS, referrer policy and safe URL logging. The production CSP currently has explicit allowances (including some inline scripts/styles), so do not describe it as a strict no-inline policy. `src/server/middleware/csrf.ts` checks mutating API requests' origin or referer and custom-header/Bearer requirements, with documented exceptions for public routes and signed webhooks. These exemptions need route-level validation, especially for any state-changing public endpoint. `src/server/middleware/rateLimiters.ts` implements request limits; whether counters work consistently across multiple running instances requires deployment-specific evidence.

Background jobs, webhooks, imports and file uploads may use additional credentials, service identities or different code paths. Test their origin checks, signatures, retries, tenant binding and file size/type limits independently, including concurrent requests.

## 8. Backup, deletion and recovery scope

The owner-facing export in `src/server/services/workspaceRestoreService.ts` covers its defined restorable collections; this is **not** all tables in `src/constants/collections.ts` and does not include stored attachment bytes. `src/server/routes/workspaceApiRoutes.ts` contains the authenticated export and owner-only restore endpoint. The read-only ZIP addition in AI #5's PR #122 wraps only that existing export scope; it must not be called a complete database backup before the larger contract exists.

`src/server/services/workspacePurgeService.ts` uses a wider workspace-purge collection list, retention/legal-hold checks, and storage deletion routines. Deletion, audit retention and backup retention have different lifetimes. A successful UI message or a code comment about recovery-point objectives is not proof of an active scheduled offsite backup or a practiced restoration.

## 9. Threat checklist and tests for a release

| Test case | Where to verify | Release expectation |
| --- | --- | --- |
| Outsider reads or writes another workspace | `supabase/tests/rls.test.sql`; server request tests | Refused; no data returned or changed |
| Viewer / lower-role edits a restricted record | RLS policies + route-role tests | Refused by authoritative boundary |
| Request changes `workspaceId` or another immutable key | `lf_guard` + database test | Refused for protected tables |
| Malformed, expired, other-project or insufficient session | `supabaseAuth.ts`, `apiAuthenticate.ts` tests | Authentication refused |
| API key wrong workspace, scope, expiry or revoked | API-key route tests | Refused without privileged fallback |
| Closed/soft-closed period or unbalanced posting | posting, database and integration tests | Refused or handled through sanctioned adjustment |
| Replayed payment or concurrent double submission | idempotency and real-database tests | Exactly-once effect for the documented key |
| Missing secrets, bad encrypted field, unsafe logs | `security-audit.test.ts` and deployment tests | Fail closed; safe error/log output |
| Unsigned webhook, foreign Origin, oversized request | HTTP/route tests | Refused by appropriate boundary |
| Restore of malformed or other-workspace backup | `src/tests/workspace-restore.test.ts` and full restore drill | Refused, no partial mutation |

**Verification commands** (against a disposable Postgres test database with all migrations applied):

```sh
npm ci
npx tsc --noEmit -p tsconfig.json
npm run lint:eslint
npm run db:test-setup
LF_TEST_DATABASE_URL=... npm test
npm run test:rules
npm run test:cov
npm run build
```

Environment/setup differs between local and CI: do not connect test commands to production; do not assume passing without running them. See `.github/workflows/ci.yml`, `docs/PLAN.md`, `docs/LEAD_RUNBOOK.md`. A current outcome belongs in dated CI evidence, not an evergreen promise.

## 10. Open security and assurance questions

1. Confirm production migrations, RLS and grants match the checked-in schema, including newer collection tables; include clean-environment test evidence.
2. Inventory every privileged server route for workspace and role checks, including IDs supplied in nested request payloads and API keys.
3. Prove financial idempotency and concurrent execution behavior against a real database, including uncertain responses and retries.
4. Verify actual encryption/key rotation, restricted logs, provider credentials, file storage and exports per integration.
5. Establish real backup coverage, retention, restoration drills and incident-response processes with owners and evidence.
6. Confirm deployed CORS/CSP/CSRF exemptions, multi-instance rate limits, branch protections and CI enforcement.

For control ownership and current documentation gaps, see `docs/SECURITY_CONTROLS.md` and `docs/FOR_YOU.md`. This specification is an architecture review; it does not certify production security.
