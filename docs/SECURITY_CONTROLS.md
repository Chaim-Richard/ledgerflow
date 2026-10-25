# LedgerFlow security controls and evidence map (E-8)

**As of 11 October 2026.** Engineering evidence inventory for the major areas of **ISO/IEC 27001:2022 Annex A** and **SOC 2 Trust Services Criteria**. This is *not* a Statement of Applicability, assurance report, audit opinion, penetration test, or claim of ISO certification / SOC 2 examination. A source file demonstrates that a mechanism exists, **not** that it is configured, operating effectively in production, or monitored over an audit period.

**Evidence levels**
- **Code + test**: implementation and automated test can be inspected; live operating effectiveness **not verified** here.
- **Code only / policy draft**: implementation or documentation exists, but no independent operating evidence attached here.
- **Gap**: missing audit-ready evidence or a control owner must demonstrate it.

| Control area | ISO Annex A examples | SOC 2 area | LedgerFlow implementation / evidence to inspect | Gap, verification and owner action | Evidence level |
|---|---|---|---|---|---|
| Governance, security policy and risk assessment | A.5.1, A.5.2, A.5.4, A.5.8 | CC1, CC3 | `security_spec.md`; `docs/ROADMAP.md`; `docs/FOR_YOU.md` lists decisions | Security policy approval, risk register, control owners, annual review, and records of accepted residual risk are not evidenced | Policy draft |
| Inventory and data classification | A.5.9, A.5.12, A.5.13 | CC2, CC3 | `src/lib/ledgerCollections.ts`; `supabase/migrations/`; `docs/privacy/PERSONAL_DATA.md`, `docs/privacy/ROPA.md` | Verify production inventory, identify sensitive data classes, owners and retention per class; validate completeness of integrations | Code + docs |
| Identity, MFA, privileged access | A.5.15–A.5.18, A.8.2, A.8.5 | CC6 | `src/lib/db/auth.ts`; `src/core/auth/SecondFactorScreen.tsx`; `src/components/platform/settings/SecuritySettings.tsx`; `src/tests/mfa-management.test.tsx`; `src/tests/auth-gates.test.ts` | Demonstrate mandatory MFA policy for privileged identities, periodic access review, joiner/mover/leaver tickets and emergency access logs | Code + test |
| Tenant isolation and row-level security | A.5.15, A.8.3 | CC6 | `supabase/tests/rls.test.sql`; `src/tests/server-write-roles.test.ts`; `src/server/db/pgFirestore.ts`; `src/server/auth/requestUser.ts` | Run against migrations in a clean database and retain results; independent multi-tenant isolation assessment not attached | Code + test |
| Secure posting, validation and period locks | A.8.3, A.8.15, A.8.24 | CC6, CC8, PI1 | `src/kernel/validation/DoubleEntryValidator.ts`; `src/tests/security-audit.test.ts`; `src/tests/backup-restore.test.ts`; `src/services/LedgerPostService.ts` | Test authorization and period locks end-to-end against a deployed test environment, including exception and reversal paths | Code + test |
| Encryption and key protection | A.8.24, A.8.25 | CC6 | `src/services/securityService.ts`; `src/tests/security-audit.test.ts` exercises authenticated encryption round-trip, tamper rejection and scrubbing | Verify actual secrets management and rotation, production configuration and access logs; `docs/FOR_YOU.md` still calls for deployment secrets and DB CA | Code + test |
| HTTP security and abuse prevention | A.8.20–A.8.23 | CC6, CC7 | `src/server/http/securityMiddleware.ts` (CORS, headers); `src/server/http/contentSecurityPolicy.ts` and the report-only rollout below (S-23); `src/server/middleware/rateLimiters.ts`; `src/server/middleware/csrf.ts`; `src/tests/api-key-rate-limit.test.ts`, `src/tests/csp-report-only.test.ts` | Review production CSP exceptions, reverse-proxy trust, actual limiter storage across multiple server instances, and external security testing. The enforced policy still allows `'unsafe-inline'` scripts: it is tightened only in report-only mode until the summary below is empty | Code + test |
| Security logging and auditability | A.8.15, A.8.16, A.8.17 | CC4, CC7 | `src/server/services/auditLogService.ts`; `src/server/services/authAuditService.ts`; `src/tests/audit-format.test.ts`; `e2e/forensics-and-audit.spec.ts` | Verify durable event delivery, restricted log access, retention, immutability, anomaly triage, clock sync, alert ownership and incident response evidence | Code + test |
| Vulnerability and dependency management | A.8.8, A.8.28 | CC7, CC8 | `.github/workflows/ci.yml` executes `npm audit --audit-level=high` plus lint, types, unit coverage, RLS tests | Track accepted exceptions, remediation SLAs, alerts, supply-chain inventory/SBOM and dependency review; an audit job is not a historical remediation record | Code + CI |
| Secure SDLC, testing, change management | A.8.25–A.8.32 | CC8 | `.github/workflows/ci.yml`; `docs/COORDINATION.md`; `src/tests/`; `e2e/`; `docs/adr/` | Prove required reviews and protected branches in GitHub settings, release approvals, deploy rollback, test evidence and change tickets. Source code alone does not establish enforcement | Code + CI |
| Backups, integrity and restoration | A.8.13, A.8.14 | A1, CC7 | `src/server/services/workspaceRestoreService.ts` (atomic workspace-scoped restore); `src/tests/workspace-restore.test.ts`; `src/tests/backup-restore.test.ts`; `src/components/platform/settings/BackupExportSettings.tsx` | Owner-provided exports are not an independently verified encrypted offsite schedule. Set RPO/RTO, verify automatic backup coverage and run/record scheduled restore drills | Code + test |
| Availability and capacity | A.8.6, A.8.14 | A1, CC7 | `src/server/routes/metricsAuditRoutes.ts`; `.github/workflows/ci.yml` | Attach availability monitoring, production uptime reports, on-call ownership, load-test results, disaster-recovery tabletop, incident exercise and third-party SLAs | Code only / gap |
| Incident response and business continuity | A.5.24–A.5.30 | CC7 | `docs/FOR_YOU.md` tracks operational prerequisites; D-14 runbooks separately queued in `docs/COORDINATION.md` | Written incident-response policy, escalation, severity, contact roster, communication templates, exercises, review records and restore metrics are missing here | Gap |
| Supplier and cloud assurance | A.5.19–A.5.23 | CC9 | `docs/privacy/SUBPROCESSORS.md`; `docs/privacy/DPA_TEMPLATE.md` | Verify signed supplier terms, vendor risk assessments, current SOC reports/certificates, data-region claims, cross-border transfer assessment and annual review | Docs / gap |
| Privacy, retention and deletion | A.5.31–A.5.34, A.8.10 | P1–P8 (if applicable) | `docs/privacy/RETENTION.md`; `docs/privacy/PERSONAL_DATA.md`; `src/lib/retention.ts`; `src/tests/retention.test.ts` | Determine legal retention obligations by jurisdiction, validate real deletion runs, lawful processing notices, request handling evidence and audit log retention; unresolved choices in `docs/FOR_YOU.md` | Code + test / gap |
| People and awareness | A.6.1–A.6.8 | CC1, CC2 | No hiring/training/awareness evidence in this repository | Assign responsibilities; retain acknowledgements, training, screening as appropriate, termination checklist and device policies | Gap |
| Physical and environmental controls | A.7.1–A.7.14 | CC6, A1 | Infrastructure described in `docs/privacy/SUBPROCESSORS.md` | Obtain provider evidence and decide physical-scope responsibilities; repository code cannot certify data center controls | Gap |

## Tightening the Content-Security-Policy, report-only first (S-23)

The enforced policy still contains `script-src … 'unsafe-inline'`, which is what makes an injected
`<script>` run at all. Removing it in one step is the usual way a CSP takes a working page down, so
the tightened policy is measured before it is obeyed. Three stages, chosen by `CSP_TIGHTEN`:

| `CSP_TIGHTEN` | `Content-Security-Policy` | `Content-Security-Policy-Report-Only` | What it is for |
|---|---|---|---|
| `off` | today's policy | — | roll back instantly, no deploy needed |
| unset / `report-only` (default in production) | today's policy, unchanged | the tightened policy + `report-uri /api/csp-report` | collect evidence; nothing can break, because nothing is enforced |
| `enforce` | the tightened policy (keeps `report-uri`) | — | the goal, once the summary is empty |

**The tightened policy** (`tightenedCspDirectives` in `src/server/http/contentSecurityPolicy.ts`)
drops `'unsafe-inline'` from `script-src` and names index.html's one inline script by SHA-256 hash
instead (`APP_INLINE_SCRIPT_HASHES`; `csp-report-only.test.ts` recomputes it from `index.html`, so
editing that script without updating the constant fails the suite). It also adds `form-action
'self'` and `manifest-src 'self'`. `style-src` keeps `'unsafe-inline'` on purpose: React writes
`style={{…}}` attributes while rendering, and no hash or nonce can cover a style *attribute*.

**Both places that send a policy are covered.** Vercel serves the built pages itself, so
`vercel.json` — not helmet — is what the browser reads for a document; `npm run csp:vercel` writes
both headers into it and `npm run build` fails if the committed file disagrees. The helmet headers
in `securityMiddleware.ts` cover the standalone server and `/api` responses.

**Reading the evidence.** Browsers post to `POST /api/csp-report`. It takes no sign-in and no CSRF
token (a user agent has neither), always answers `204`, and only increments counters held in
memory: grouped by directive + blocked origin + document path, capped at 200 groups, nothing
written to the database. A blocked URI is reduced to its parsed origin, so a look-alike host is
never filed as the host it imitates, and a document URI keeps its path only, so an invite token in
a query string cannot reach the summary.

```
GET    /api/csp-report/summary    # platform admin: {rollout, total, dropped, groups[]}
DELETE /api/csp-report/summary    # start the measurement again after a fix
```

**Promotion checklist.** Deploy; leave it at `report-only` for a full billing-cycle's worth of
traffic (every screen, Plaid Link, Stripe, the public invoice pages); read the summary; fix or
allow each group; `DELETE` the summary and wait again; when it stays empty, set
`CSP_TIGHTEN=enforce`, run `npm run csp:vercel`, commit `vercel.json` and deploy. Roll back with
`CSP_TIGHTEN=off`. Counters live in one process's memory, so a summary reflects the instance that
answered — read it more than once on a multi-instance deployment.

## Highest-priority evidence work

1. **Immediate operational checks:** finish the deployment secrets, certificate and provider settings in `docs/FOR_YOU.md`; verify the production configuration rather than trusting the historical note.
2. **Establish owners and policies:** assign responsible individuals for security, incident handling, access reviews, release approvals, backups and supplier review. Record acceptance and dates.
3. **Capture checks:** retain CI run links, migrated-database RLS results, selected authorization tests, actual production security configuration, a restoration drill and access-review decisions.
4. **Test the hard boundaries:** independent tenant-isolation, privileged-access, reconciliation/period-lock, restore isolation, and secrets-handling tests. Review unresolved risks and give each a due date.
5. **Audit readiness:** map the auditor's exact criteria and scope to dated operating evidence; have qualified professionals validate statements before publication. Mark controls as designed/implemented/operating only after evidence exists.

## Scope and maintenance

This map deliberately avoids claiming that every ISO control is applicable or satisfied, or that the code alone qualifies for SOC 2. The ISO and SOC 2 families have many additional detailed requirements; assess applicability formally for the real organization's scope and commitments. Update this table whenever implementation or documented evidence changes. Preserve a dated evidence link, actor/owner, observed result and next-review date for each claimed control.
