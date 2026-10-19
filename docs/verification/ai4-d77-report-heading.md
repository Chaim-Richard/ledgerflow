# AI #4 — D-77 compact reports heading

Based on main 0ace84f1. Replaces the decorative Financial Intelligence Hub hero with Reports, the actual selected period, and visible Export/Print actions. Existing period selectors and Generate/report-pack handlers remain below it. No financial calculation, request, printing or export handler changed.

UI guide rules: plain words; compact header; 44px actions; theme variables; phone wrapping. W5 remains incomplete: heading checks do not prove a full label-report journey.

Before/after images (390 and 1280, light and dark): [images/d77](images/d77). Before includes the old combined hero/controls; after shows the compact heading (period controls moved below). Browser contract checks heading height ≤120px, visible actions ≥44px, actual print callback, quarter change reflected in the heading, and no page overflow. Types and focused ESLint pass. GitHub full checks and reviewed Linux visual references pending.
