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
