# E-31 — CAMT.053 XML statement import for review

**Path:** Banking → Import statement → upload an ISO 20022 CAMT.053 `.xml` or `.camt053` file.

The new parser `src/lib/camt053Import.ts` is deliberately separate from the historical exploratory `parseCamt053Statement` helper, whose old tests permit missing-date rows to be skipped. The new user-facing path instead refuses the entire unsupported or incomplete file and does **not** silently drop entries or turn a missing amount into zero.

## Supported subset and units

- A complete single-account `Document/BkToCstmrStmt/Stmt`, including optional namespace prefixes; one statement per file
- One documented `Ntry` per bank-statement movement, with no more than one `TxDtls`
- One account identifier (IBAN or proprietary ID), booked entry status and valid `BookgDt/Dt`
- `Amt Ccy="..."`, `CdtDbtInd` CRDT or DBIT, exact integer cents (two-decimal currencies only)
- Textual `Ustrd`, `AddtlNtryInf` or `AddtlTxInf`; optional bank references and mixed-script descriptions
- At most 50,000 entries per file and 5 MB input

The selected workspace's currency must match the account and every entry; the parser does not guess an exchange rate, recompute bank balances or allocate multiple transactions hidden in one `Ntry`. Unsupported statuses, missing/invalid dates, per-entry currency conversions, reversal flags, XML custom entities/DTDs, and unmatched closing tags are rejected with visible errors. The output remains a bank-statement **preview**, using the existing duplicate review and manual import confirmation. The new helper does not access a database, mutate the ledger or post a journal entry.

### Limitations

This is a conservative *subset* of CAMT.053, not full ISO 20022 XSD validation. Banks may emit `DtTm`, aggregate `TxDtls`, proprietary entry extensions or different status structures, which require separate fixtures and review before support. The original exploratory helper is untouched to preserve its existing callers and compatibility tests. Synthetic sample data is not proof of compatibility with a real bank export; E-56's real-shaped file corpus must cover supported institution variants.

**Tests:** `src/tests/camt053-import.test.ts` (hand-checked amounts/dates and fail-closed cases) and CAMT component upload/refusal cases in `src/tests/bank-statement-import-ui.test.tsx`. An authenticated live import and real PostgreSQL audit have not been demonstrated by these tests.

**Release row:** W4, bank import/reconciliation, is *not* upgraded. Durable reconciliation and stale bank feed behavior remain separate. This PR depends on E-30 ([PR #198](https://github.com/shmuelbiller1/ledgerflow/pull/198)), which adds OFX/QFX handling to the same import screen.
