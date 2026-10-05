# Working in application code

Read the repository AGENTS.md and current docs/COORDINATION.md first. Preserve the other agent's changes through normal merges; check ownership before each new task. The detailed implementation guide is docs/DEVELOPER_WORKFLOWS.md, and the evidence-based tool review is docs/TOOL_REVIEW.md.

Trace a feature from its registered entry point, through its inputs and calculation, to its action, persistence and verification. A menu item or mock API response does not establish a working integration. Zustand is a browser cache and UI state layer; durable data and write authority live in the workspace-scoped database/server paths.

Financial mutations use the existing posting/document/action services. Do not replace a posting call with a convenient direct document write. Preserve money units, currency/exchange rate, account-role resolution, postable filtering, allocations, reversals and period locks. Fetch authoritative history for complete reports; show incomplete-cache status for local analysis.

The owner wants English menus/options with Hebrew and mixed-language data. Preserve exact stored labels and identities. Normalize for comparison only; never derive identity from ASCII-only replacement. Follow the developer guide for Unicode parsing, exports and persistence tests.

Keep related-record edits in a side drawer while retaining the current form's draft. Use typed, allowlisted metadata fields; amounts, stock quantities and status changes retain their financial service. Make the shared record update available on future screens, and retain edits on a refused save. New pages should work with persistent page pins and documented keyboard access.

Run the checks required by coordination without increasing quality baselines. Distinguish a pushed branch, an opened PR, a merge and a deployment in status notes.
