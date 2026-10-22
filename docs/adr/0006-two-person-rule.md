# 6. The two-person rule: nobody approves what they prepared

## Status
Accepted.

## Context
A single person who can both prepare and approve a payment, an invoice discount or a pay run is the
classic small-business fraud path, and it is also how honest mistakes get signed off. Roles alone do
not fix it: the owner is the most privileged person in the workspace, so "only an owner may approve"
still lets the owner approve their own work.

## Decision
The workspace carries `twoPersonRule` (set in Settings → Policies, saved by the server in
`twoStepPolicyService.ts`; the rule itself is `src/lib/twoPersonRule.ts`).

- When it is on, **`mayApprove(on, uid, preparedBy)` is false for the person who prepared the
  record** — an invoice over the approval limit waits for someone else even if an owner or
  accountant issued it, and every pay run waits (an owner's too) for an owner or accountant other
  than whoever prepared it.
- **Only owners turn it on**, and only when there are **at least two people who can approve**
  (`approverCount` — owners plus accountants). Otherwise invoices over the limit and pay runs could
  never be approved, which would stop the business rather than protect it.
- The **server enforces it**: `invoiceApprovalGuard.ts` and `payRunService.ts` refuse an
  approval with `TWO_PERSON_REFUSAL` = *"Under the two-person rule, someone else approves what you
  prepared"*. The screens only follow the flag (`PayRunApprovals.tsx`, `InvoiceApprovalFlag.tsx`,
  `useEntityOperations.ts` stamps `approvalForSave`).
- Turning it on and off is audited (`TWO_PERSON_RULE_SET`, with the state in the entry).

## Consequences
- Approval is a second pair of eyes, not a second click by the same pair.
- A workspace with one accountant and one owner is enough; a workspace with a single owner is told
  what is missing instead of being allowed to lock itself out of approving anything.
- Every approval path must carry `preparedBy`; a new approval flow that does not is refused by
  `mayApprove` only when the ids are known — so new flows must pass it (reviewed in PRs).
