# AI #4 — D-78 readable scrolling report navigation

Based on main 0ace84f1. Report buttons occupy one horizontal strip, keep whole labels without shrinking/wrapping, and have 44px targets plus keyboard focus indicators. The current page has aria-current. A ResizeObserver and selection effect reveal the active button by adjusting the strip's horizontal scroll only; cleanup disconnects the observer. Report IDs, labels, registry, URL handlers, and financial logic are unchanged.

Chromium: two phone light/dark cases verify horizontal overflow belongs to the strip, all buttons occupy one nonoverlapping row, all targets are at least 44px, keyboard focus/Enter activates the last item and reveals it, the report URL changes, the document has no horizontal overflow, and resizing to desktop preserves selection. Types and focused ESLint pass.

Before/after at 390/1280 in both themes: [images/d78](images/d78). UI guide: phone navigation and accessibility rules. Existing visual-regression checks explicitly hide report-tabs (the growing report list is excluded from references), so no reference image is changed for this task. W5 remains incomplete: navigation alone is not a verified label-report journey. Full GitHub PR checks pending.
