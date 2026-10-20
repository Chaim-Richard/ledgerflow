# AI #2 — C-125: VAT identifier format guidance

## Scope and entry point

Based on main `3ca3ec2fd04f93b5239bd3779f39960045af816d`.
Settings → Tax profiles → Edit this profile → VAT registration →
**EU / UK VAT number format**. The native disclosure keeps optional, later-country
format guidance out of the normal US/Israel workflow. Non-VAT rows do not show it.

The existing `checkVatNumber` / `vatFormatWarning` helpers are used without changes.
The registration's own country is authoritative for this check, not the books'
country and not an inferred prefix. Changing country or number updates the warning.
Success displays only a masked identifier. The original editable input is retained.

This does **not** verify a checksum, issuance, ownership, current registration,
VIES/HMRC acceptance, reverse-charge eligibility, tax calculations or filing.
No request is made by the helper, no field is rewritten, and a format warning does
not prevent saving through the existing confirmed profile-save path.
No accounting, posting, server, migration, rate table or quality budget was changed.

## Evidence

- `src/tests/tax-profiles-settings.test.tsx`: added three cases for registration-country
  isolation, masking, mismatched prefix, unsupported country, placeholder/empty input,
  no network side effect, unchanged mixed-language draft, cancel/reopen reset,
  VAT-only visibility, workspace clearing, and warning-compatible existing save.
- Targeted profile-screen + existing VAT-format suite: **27 passed, 0 failed/skipped**.
- Type check passed.
- ESLint passed: **0 errors, 210 warnings**, existing cap unchanged.
- `e2e/vat-number-help.spec.ts`: **4/4 passed locally** (1280/390, light/dark),
  keyboard disclosure, masked result, country/number updates, draft preservation,
  cancel/reopen, 44px target, page overflow and screenshot attachments.
  Standard Playwright browser download was blocked. A temporary ignored config used
  npm-distributed `@sparticuz/chromium` (Chromium 153), its bundled shared libraries,
  and standard multi-process mode. Its single-process default initially prevented
  second-context startup; removing that local-only flag made all four cases pass.
  CI's standard Chromium remains independently pending.
- Production build passed (existing bundle-size warnings).
- `npm audit --audit-level=high` passed: no high/critical advisories; two moderate
  advisories remain through `typed-rest-client` → `qs`. Dependency changes were left
  outside this UI task.
- Initial parallel full-suite/build/type/lint execution exceeded sandbox memory and was
  terminated. Types/lint/build were then rerun successfully. The full suite is being
  rerun with concurrency 1; no all-suite success is claimed until it exits.
- Manual GitHub CI dispatch was refused with HTTP 403 (integration permission),
  and no PR CI run was visible when checked. This is distinct from the intentionally
  paused Vercel deployment and from a test failure.

### Screenshots

New optional disclosure; no existing screenshot baseline changed. All four captures were visually inspected: readable text, complete result,
no clipped number or horizontal overflow. All four captures are retained:

- [Desktop light](assets/c125-vat-number-help/vat-number-help-1280-light.png)
- [Desktop dark](assets/c125-vat-number-help/vat-number-help-1280-dark.png)
- [Phone light](assets/c125-vat-number-help/vat-number-help-390-light.png)
- [Phone dark](assets/c125-vat-number-help/vat-number-help-390-dark.png)

## Release gate and hand-off

W1/W7/W8 remain at their previous statuses. This is input guidance, not proof of any
complete accounting workflow or new supported tax jurisdiction. C-125 has local screen/browser evidence; full-suite completion and independent CI
remain pending before final review.

C-120 was inspected first as requested by the queue. InvoiceModal/BillModal and their
financial editors remain reserved to AI #1. Safe integration needs explicit ownership
coordination for where a history-based suggestion can be accepted; no reserved form or
financial calculation was changed to force a task closure.
