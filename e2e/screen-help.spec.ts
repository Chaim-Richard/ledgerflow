import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("contextual report help keeps the current report and restores keyboard focus on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.addInitScript(() => {
    localStorage.setItem("isGuest", "true");
    localStorage.setItem("has_seen_onboarding", "true");
  });
  await page.goto(
    "/?report=financial-ratios&start=2024-02-29&end=2024-03-31#reports",
  );
  const dismiss = page.getByRole("button", { name: "Dismiss cookie banner" });
  if (await dismiss.isVisible()) await dismiss.click();
  const help = page.getByRole("button", {
    name: "Help for Financial Ratios",
    exact: true,
  });
  await expect(help).toBeVisible();
  await help.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Help for Financial Ratios",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Zero denominators");
  await expect(
    page.getByRole("region", { name: "Financial ratios", exact: true }),
  ).toHaveCount(1);
  await dialog.getByRole("button", { name: "Open Help & Guide" }).focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close help" }),
  ).toBeFocused();
  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .disableRules(["color-contrast"])
    .analyze();
  expect(axe.violations.map((value) => value.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(help).toBeFocused();
  expect(page.url()).toContain("report=financial-ratios");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("A-201/A-202: a report's help opens in its own Hebrew, and its totals explain themselves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.addInitScript(() => {
    localStorage.setItem("isGuest", "true");
    localStorage.setItem("has_seen_onboarding", "true");
  });
  await page.goto("/?report=financial-ratios&start=2024-02-29&end=2024-03-31#reports");
  const dismiss = page.getByRole("button", { name: "Dismiss cookie banner" });
  if (await dismiss.isVisible()) await dismiss.click();

  // A-201: the Hebrew view is the report's own description, not the general reports page summary
  await page.getByRole("button", { name: "Help for Financial Ratios", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /יחסים פיננסיים/ });
  await dialog.getByRole("button", { name: "עברית" }).click();
  await expect(dialog).toContainText("חלוקה באפס נשארת כלא מוגדרת");
  await expect(dialog).not.toContainText("Check cash on hand");
  const hebrewAxe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .disableRules(["color-contrast"])
    .analyze();
  expect(hebrewAxe.violations.map((value) => value.id)).toEqual([]);
  await page.keyboard.press("Escape");

  // A-202: the totals panel is closed by default and explains this report's total in words
  const explain = page.getByText("What does this number mean?", { exact: true });
  await expect(explain).toBeVisible();
  await explain.click();
  const panel = page.locator("details").filter({ hasText: "What does this number mean?" });
  await expect(panel.getByText("Current ratio", { exact: true }).first()).toBeVisible();
  await expect(panel.getByText(/What it does not prove/).first()).toBeVisible();
  await expect(panel.getByText("Total assets", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .include("#main-content")
    .disableRules(["color-contrast"])
    .analyze();
  expect(axe.violations.map((value) => value.id)).toEqual([]);
});

test("Help All screens searches Hebrew names and English descriptions without translating options", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.addInitScript(() => {
    localStorage.setItem("isGuest", "true");
    localStorage.setItem("has_seen_onboarding", "true");
  });
  await page.goto("/#help");
  await page.getByRole("button", { name: "All screens", exact: true }).click();
  const all = page.getByRole("region", { name: "All screens", exact: true });
  await expect(all).toBeVisible();
  await all.getByLabel("Search screen help").fill("יחסים פיננסיים");
  await expect(
    all.getByRole("heading", { name: "Report: Financial Ratios" }),
  ).toBeVisible();
  await all.getByLabel("Search screen help").fill("zero denominators");
  await expect(
    all.getByRole("heading", { name: "Report: Financial Ratios" }),
  ).toBeVisible();
  await all.getByLabel("Search screen help").fill("no such screen xyz");
  await expect(all).toContainText("No screen descriptions match");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .include("#main-content")
    .disableRules(["color-contrast"])
    .analyze();
  expect(axe.violations.map((value) => value.id)).toEqual([]);
});
