# AI #4 — D-94 inline editor label in name

Independent branch from main e5a19464. D-85/D-90 stay in PR #192 and are not duplicated here. The lead explicitly assigns shared InlineEdit in the new D-94 task.

InlineEdit previously showed the stored/displayed text while naming its button only “Edit <field/context>”. Its name now combines a unique hidden action-label reference and the actual rendered value reference. Examples: “Edit Bin: B-08”, “Edit Project: בית Mixed Case”, “Edit Price: $120.00”, “Edit Email: Add email”. This uses rendered React content rather than stringifying an object or reading an underlying ID when a formatted display is present. The value wrapper uses display:contents so it adds no layout box. The prefix is hidden rather than positioned offscreen, avoiding RTL overflow. Viewers remain plain text; the editing input keeps its existing field label. No save, validation, draft, permission, money, posting or server logic changed.

Removed both warehouse axe exclusions: the full serious/critical scan now includes label-content-name-mismatch for every inline editor. No accessibility rule is filtered out there.

Verification:

- 123/123 affected tests, 28 suites in 25 files, no skips/failures (46.1s). Includes Enter/blur/unchanged/Escape, refused drafts, pending duplication, permissions, formatted amounts, nested English/Hebrew content, empty placeholders, unique references, updated names and read-only viewers.
- Mechanical source comparison of 27 existing unit/browser test files after removing the new name-lookup wrappers matches the original source exactly, apart from two added accessibility cases. All existing inputs, expected figures and behavioral assertions are unchanged. Name lookups remain anchored to the exact action/context and colon; the displayed value can change after a save.
- Six warehouse/inventory browser checks pass (14.1s): all four panels at 320/390px, RTL, 44px controls, unexcluded serious/critical axe scan, keyboard tabs, refused drafts, retries, Hebrew CSV, metadata-only writes and two packing-slip prints. Warehouse screenshots were reviewed. Final team/rules follow-up also passes, 3/3 (10.9s): keyboard refusal/retry, priority and group toggles, removal and phone geometry. Nine focused browser checks pass in total.
- Type checking and ESLint across changed files pass, zero errors/warnings. Final full CI includes coverage/database/RLS, both time zones, production build and all browser/visual checks; pending PR.

During development, a positioned screen-reader label caused overflow in the long RTL fixture; using an explicitly referenced hidden label fixed it. A fixture-only “Edit fixture” button is not InlineEdit and retains its existing exact selector. These were fixed before pushing.

Release gate W13 gains accessibility evidence only. Its complete stock journey remains Partly; no workflow status is upgraded by this UI change. No visual baseline or quality budget changed.
