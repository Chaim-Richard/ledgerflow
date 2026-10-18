# AI #4 — D-33 withholding golden evidence

Sixteen new cases in `src/tests/withholding-golden.test.tsx` use literal agorot;
expected values never come from production calculation helpers. Existing tests,
financial code, rates, dependencies and gates are unchanged.

| Case                    |  Paid | Allocated VAT |   Net | Rate | Withheld |
| ----------------------- | ----: | ------------: | ----: | ---: | -------: |
| Full bill               | 11800 |          1800 | 10000 |   5% |      500 |
| Half bill               |  5900 |           900 |  5000 |   5% |      250 |
| Quarter bill            |  2950 |           450 |  2500 |   5% |      125 |
| Fractional rate         | 11800 |          1800 | 10000 | 7.5% |      750 |
| Half-agorot withholding |    12 |             2 |    10 |   5% |        1 |
| Below-half withholding  |    11 |             2 |     9 |   5% |        0 |
| No VAT                  |   333 |             0 |   333 | 7.5% |       25 |
| Certificate exemption   | 11800 |          1800 | 10000 |   0% |        0 |
| No payment              |     0 |             0 |     0 |   5% |        0 |
| Full-rate withholding   | 11800 |          1800 | 10000 | 100% |    10000 |

The actual payment-field tests independently check:

- Mixed partial payments: half of a 11800/1800 bill, quarter of a saved historic
  11700/1700 bill, and half of a zero-VAT 4000 bill. Paid 10825 less VAT 1325
  leaves net 9500; 5% is 475; vendor cash is 10350. The historic saved VAT is
  preserved. Unknown and unpaid bills contribute nothing. The valid certificate
  number is sent with the payment.
- Withholding rounds once after combining allocations: two half-bill payments of
  6 each (whole bill 12, VAT 2) give net 5 each, net 10 total, withheld 1 at 5%.
  Rounding withholding separately on each allocation would incorrectly give zero.
- VAT rounds per bill: two half-bill payments of 2 each (whole bill 4, VAT 1)
  each allocate VAT 0.5 rounded to 1. Total net is 2, withheld 2 at 100%.
  Rounding the aggregate VAT instead would incorrectly give net 3.
- A fresh payment after certificate expiry starts with no rate and emits null.
  Explicitly entering 30% on a half payment produces 1500 without sending the
  expired certificate number; clearing the rate emits null again. The 30% is a
  deliberate test input, not a claim about a legal fallback rate.

Pure certificate cases prove the final expiry day is inclusive, the following
day is expired, a zero-rate certificate is valid, and absent/invalid rates do not
supply a certificate.

## Known finding — not certified

[Issue #156](https://github.com/shmuelbiller1/ledgerflow/issues/156) records a
pre-existing live-date transition bug reproduced on main `507d3cc4`: mount with a
5% certificate good through 2026-12-31, then change the same open payment date to
2027-01-01 without replacing the vendor object. The input remains 5 and emits
`{withheldCents:250,ratePercent:5}` for a 5900 payment with 900 VAT while showing
the expiry warning. A fresh mount correctly asks for an explicit rate. The
reserved financial/UI source was not changed; this behavior is not blessed by a
golden expectation. Lead fix and transition regression remain required.

W3 stays partially verified; these component/pure tests do not certify posting,
payment runs, vendor statements, legal certificate verification or browser use.

## Verification

- Local: 16/16 cases pass in Pacific/Auckland and America/Los_Angeles; full
  typecheck and targeted ESLint pass with zero warnings/errors. Reused installed
  dependencies match this worktree's lockfile; no fresh local install is claimed.
- Owner-authorized GitHub fresh install, accounting coverage, RLS, both full
  timezone suites, build, browser and security gates remain pending at publication.

```sh
NODE_ENV=test SYSTEM_SALT=test-ledgerflow-salt-32b-deterministic TZ=Pacific/Auckland \
  node_modules/.bin/tsx --test src/tests/withholding-golden.test.tsx
# Repeat with TZ=America/Los_Angeles.
```
