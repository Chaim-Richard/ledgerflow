# Security Specification: LedgerFlow Zero-Trust Protocol

## 1. Core Data Invariants & Zero-Trust Architecture
- **Identity Integrity**: No user can create or modify a document where `uid` does not match their `request.auth.uid`.
- **Relational Sync**: Transactions, invoices, bills, payments, and accounts must belong to a `workspaceId` that the user has explicit membership or ownership in.
- **Top-Level Multi-Tenancy**: All collections (`transactions`, `invoices`, `bills`, `chartAccounts`, `projects`, `payments`, `estimates`, `creditNotes`, `recurring`, `auditLogs`) are top-level collections partitioned by `workspaceId`.
- **Terminal State Lock & Period Immutability**: Once an accounting period is locked (`lockDate`), transactions dated on or prior to the lock date cannot be modified or deleted directly. Only the sanctioned `Reverse & Correct` workflow is permitted.
- **PII Isolation & Encryption**: Sensitive credentials, bank details, and tokens are encrypted with AES-256-GCM via `SecurityService` before persistence. SSNs, credit cards, and API keys are scrubbed from telemetry logs.
- **Strict Role-Based Access Control (RBAC)**:
  - **Owner**: Full administrative controls, billing, deletion, and token generation.
  - **Accountant**: Period locking, journal entry posting, tax reconciliation, and bad debt write-offs.
  - **Bookkeeper**: Document creation (invoices, bills, estimates, payments) and draft preparation.
  - **Viewer**: Read-only access to statements, registers, and reports.

---

## 2. Threat Mitigation Matrix (The Dirty Dozen + Extended Guards)
1. **Identity Spoofing**: Attempting to set `uid` to a different user's ID during document creation -> Rejected by `request.auth.uid == request.resource.data.uid`.
2. **Ghost Workspace / Cross-Tenant Leak**: Accessing or creating resources in a `workspaceId` where the user is not a member -> Rejected by `isWorkspaceMember(workspaceId)`.
3. **Privilege Escalation**: Non-owner attempting to elevate their own role to 'owner' or 'admin' -> Rejected by custom claims gate and Firestore rule restrictions.
4. **Denial of Wallet / Payload Exhaustion**: Sending oversized strings (>10KB) in text fields -> Rejected by `isValidText()` schema string length bounds.
5. **ID Poisoning**: Submitting abnormal or injection-crafted document IDs -> Enforced by `isValidId()` alphanumeric regex.
6. **Immutable Tampering**: Attempting to change `createdAt`, `workspaceId`, or forensic hash on existing documents -> Blocked via `affectedKeys()` rule gates.
7. **Direct Client Ledger Modification**: Attempting client-side writes to `/transactions` -> Fully disabled in `firestore.rules` (transactions are only written via authenticated server-side atomic transactions).
8. **Double-Entry Disequilibrium**: Attempting to post unbalanced debits and credits -> Rejected by `DoubleEntryValidator` (`SUM(lines.amountCents) == 0`).
9. **Temporal / Retroactive Backdating**: Attempting to backdate entries into a closed fiscal period -> Blocked by `PeriodLockGuard` against workspace `lockDate`.
10. **Double Reversal Exploitation**: Attempting to reverse an already reversed journal -> Blocked by `reversalEventId` check.
11. **Payment Injection**: Non-standard payment token structures -> Enforced by strict token format regex.
12. **Orphaned Account Reference**: Referencing a non-existent or inactive Chart of Accounts node -> Validated against active Chart of Accounts before commit.

---

## 3. Red Team Verification & Compliance
All Firestore rules incorporate `isValidId()` guards, strict allowlists (`affectedKeys().hasOnly(...)`), and server-side cryptographic signatures. Continuous automated test suites in `src/tests/` verify forensic immutability, role permissions, and double-entry consistency on every build.
