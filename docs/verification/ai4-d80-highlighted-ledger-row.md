# AI #4 — D-80 readable retained earnings

The retained-earnings row used light emerald backgrounds and dark emerald text in both themes. In dark mode the result was dark green text on grey. The row now uses theme text/panel/surface and brass highlight/border variables, with readable label, subtitle, badge, current/prior figures and comparative percentage. Negative figures retain their numeric sign; calculation and formatting are unchanged. The row has a 44px minimum target and visible keyboard focus.

Four Chromium contracts pass (390/1280 × light/dark), checking WCAG AA text contrast in normal, hover and keyboard-focus states and Enter opening the existing drill-down. Types and focused ESLint pass. [Before/after images](images/d80). This display fix does not establish independently verified report figures or a complete W5 label journey; release status stays incomplete. Linux reference capture/full PR gates pending.
