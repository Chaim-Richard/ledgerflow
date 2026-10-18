import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [390, 1280])
  for (const theme of ["light", "dark"]) {
    for (const report of ["pnl", "balance-sheet"]) {
      test(`report filters ${report} ${width} ${theme}: contrast, geometry and controls`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 850 });
        await page.addInitScript((selectedTheme) => {
          localStorage.setItem("isGuest", "true");
          localStorage.setItem("has_seen_onboarding", "true");
          localStorage.setItem("ledgerflow-cookie-consent", "accepted");
          localStorage.setItem("lf_theme", selectedTheme);
        }, theme);
        await page.goto(
          `/?report=${report}&start=2026-09-01&end=2026-09-30&cmp=none#reports`,
        );
        const header = page.getByRole("region", {
          name: "Report filters",
          exact: true,
        });
        await expect(header).toBeVisible();
        const date =
          report === "pnl"
            ? header.getByLabel("Reporting period start date")
            : header.getByLabel("As Of Reporting Date", { exact: true });
        await date.fill("2026-09-02");
        await expect(date).toHaveValue("2026-09-02");
        await header.getByLabel("Basis", { exact: true }).focus();
        await expect(header.getByLabel("Basis", { exact: true })).toBeFocused();
        if (report === "balance-sheet") {
          const sort = header.getByRole("button", {
            name: "name",
            exact: true,
          });
          await sort.click();
          await expect(sort).toHaveAttribute("aria-pressed", "true");
        }
        const clipped = await header.evaluate((element) => {
          const frame = element.getBoundingClientRect();
          return [
            ...element.querySelectorAll(
              'input:not([type="checkbox"]),select,button',
            ),
          ].flatMap((control) => {
            const rect = control.getBoundingClientRect();
            return rect.width &&
              (rect.left < frame.left ||
                rect.right > frame.right + 1 ||
                rect.height < 44)
              ? [
                  {
                    control:
                      control.getAttribute("aria-label") || control.textContent,
                    width: rect.width,
                    height: rect.height,
                  },
                ]
              : [];
          });
        });
        expect(clipped).toEqual([]);
        // Native date/select internals are not always audited by axe: check their actual painted colours too.
        const contrasts = await header.evaluate((element) => {
          const luminance = (colour: string) => {
            const channels = colour
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map((value) => {
                const channel = Number(value) / 255;
                return channel <= 0.04045
                  ? channel / 12.92
                  : ((channel + 0.055) / 1.055) ** 2.4;
              });
            return (
              channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
            );
          };
          return [
            ...element.querySelectorAll('input:not([type="checkbox"]),select'),
          ].map((control) => {
            const style = getComputedStyle(control);
            const text = luminance(style.color),
              background = luminance(style.backgroundColor);
            return (
              (Math.max(text, background) + 0.05) /
              (Math.min(text, background) + 0.05)
            );
          });
        });
        for (const contrast of contrasts)
          expect(contrast).toBeGreaterThanOrEqual(4.5);
        const a11y = await new AxeBuilder({ page })
          .include('[data-testid="report-controls"]')
          .withRules(["color-contrast"])
          .analyze();
        expect(a11y.violations).toEqual([]);
      });
    }
  }
