# G-9 — IL and US onboarding samples (AI #8)

Adds two explicitly synthetic, country-specific books to the signed-out guest experience. The selector is on the guest dashboard; selecting a sample replaces only the in-memory guest ledger after a confirmation. The component re-checks that the session is guest-only and has no signed-in user before replacing anything. It never calls an API, writes a workspace, or changes a saved company.

## Sample contents and scope

- **Israel:** Galil Design Studio (demo), ILS, mixed English/Hebrew account and party names.
- **United States:** Hudson Design Studio (demo), USD.
- Both contain a synthetic opening bank/equity entry and 12 months of income and software/hosting activity dated January–December 2025. There are two synthetic customers and vendors per sample.
- Entries are deterministic, use whole minor units, and balance line-by-line. The data is illustrative, not sourced from any real business. It does not calculate or claim to validate tax.
- Switching sample explicitly warns that current in-memory demo records will be replaced; related document caches are cleared to prevent cross-sample mixing.

## Verification

`src/tests/country-demo-workspace.test.tsx` checks the two currencies, period boundaries, synthetic names, deterministic entry counts/IDs, balanced entries, and that signed-in workspaces cannot load a sample. The UI test switches IL → US and verifies the ledger store currency and visible selection.

This is guest-only demonstration data. It does **not** provision an isolated durable demo workspace, prove jurisdiction-specific bookkeeping, or satisfy real-book readiness gates. No change to posting, tax calculations, server routes, schemas, or database data.

## Files

- `src/lib/countryDemoWorkspace.ts` — deterministic synthetic fixtures.
- `src/components/onboarding/GuestCountrySamplePicker.tsx` — guarded guest-only chooser.
- `src/components/Dashboard.tsx` — visible entry point in guest mode only.
- `src/tests/country-demo-workspace.test.tsx` — fixture and UI contract tests.
- `docs/RELEASE_GATE.md` — W1 notes this limited sample experience.
