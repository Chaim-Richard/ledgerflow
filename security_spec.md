# Security Specification: LedgerFlow Zero-Trust Protocol

## 1. Data Invariants
- **Identity Integrity**: No user can create or modify a document where `uid` does not match their `request.auth.uid`.
- **Relational Sync**: Transactions must belong to a `workspaceId` that the user actually owns.
- **Terminal State Lock**: Once a transaction is marked as `voided` or `certified`, only an admin can perform a destructive update.
- **PII Isolation**: User email data is strictly limited to the document owner.

## 2. The Dirty Dozen (Threat Payloads)
1. **Identity Spoofing**: Attempting to set `uid` to a different user's ID during creation.
2. **Ghost Workspace**: Creating a transaction in a `workspaceId` that doesn't exist or isn't owned by the user.
3. **Privilege Escalation**: A user attempting to update their own `role` to 'admin'.
4. **Denial of Wallet**: Sending a 1MB string in the `description` field to exhaust storage costs.
5. **ID Poisoning**: Using a 2KB junk string as a document ID.
6. **Immutable Tampering**: Attempting to change `createdAt` or `workspaceId` on an existing transaction.
7. **Cross-Tenant Leak**: Attempting to 'list' transactions without a `where('uid', '==', auth.uid)` filter.
8. **State Shortcutting**: Updating a 'pending' transaction directly to 'reconciled' without certification.
9. **Temporal Spoofing**: Providing a client-side `timestamp` that is in the future.
10. **Array Shadowing**: Adding hidden metadata fields to the `lines` array that bypass validation.
11. **Email Overwrite**: Modifying the PII `email` field without verification.
12. **Orphaned Write**: Creating a transaction line that references a non-existent account ID.

## 3. Red Team Certification
The `firestore.rules` must incorporate `isValidId()` guards and action-based `affectedKeys()` gates for every single collection.
