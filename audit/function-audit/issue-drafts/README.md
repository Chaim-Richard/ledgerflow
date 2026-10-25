# Ready-to-paste GitHub items (token cannot write to the upstream repo)

The Arena session token for `Chaim-Richard/ledgerflow` is a fine-grained GitHub App token (empty
OAuth scopes) with read access to `shmuelbiller1/ledgerflow` but no Pull-requests:write — PR, issue
and comment creation there returns `403 Resource not accessible by integration`, and the fork has
issues disabled. The audit work is pushed to the fork branch and now also has a reviewable PR:

- **Fork PR (open):** https://github.com/Chaim-Richard/ledgerflow/pull/9
  (`arena/0a3dd00f-ledgerflow` → fork `main`, 4 commits, 16 files; fork `main` equals the upstream
  base commit `8df972d`, so the diff is exactly the audit work).
- **Send it upstream (one click, in a browser signed in as the repo owner — the app token cannot do
  this):**
  https://github.com/shmuelbiller1/ledgerflow/compare/main...Chaim-Richard:arena/0a3dd00f-ledgerflow?expand=1
  Base `shmuelbiller1/ledgerflow:main`, head `Chaim-Richard:arena/0a3dd00f-ledgerflow`; tick
  "Allow edits and access to secrets by maintainers". Title:
  `AI #8: independent function-level audit Pass A slices 1–3 — AF-001/AF-002/AF-010 evidence`.
- `issue-151-comment.md` — fresh-SHA verification comment for upstream issue #151.
- `issue-af010-money-primitives.md` — one new issue covering the AF-010 family (shared root cause:
  duplicated money primitives with different contracts).
- `issue-af002-f1-template-tax-drop.md` — the latent unbalanced-entry gap in the posting templates.
