import "./helpers/dom";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  render,
  cleanup,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import {
  APP_TABS,
  VIEW_COMPONENTS,
  SCREEN_TABS_REGISTRY,
  REPORT_TABS_REGISTRY,
  SETTINGS_TABS_REGISTRY,
  INTELLIGENCE_TABS_REGISTRY,
  ANALYTICAL_LENSES_REGISTRY,
} from "../config/registry";
import {
  screenHelpIndex,
  searchScreenHelp,
  currentScreenHelp,
} from "../lib/screenHelpIndex";
import ScreenHelpHeader from "../components/support/ScreenHelpHeader";
import AllScreensHelp from "../components/support/AllScreensHelp";
import { useUIStore } from "../stores/useUIStore";
const ui = useUIStore.getState();
afterEach(() => {
  cleanup();
  useUIStore.setState(ui, true);
});
test("every registered main screen, report, setting and lens has two to four help sentences", () => {
  const groups = [
    SCREEN_TABS_REGISTRY,
    REPORT_TABS_REGISTRY,
    SETTINGS_TABS_REGISTRY,
    INTELLIGENCE_TABS_REGISTRY,
    ANALYTICAL_LENSES_REGISTRY,
  ];
  for (const group of groups) {
    const ids = new Set<string>();
    for (const entry of group) {
      assert.ok(!ids.has(entry.id), `duplicate help ID ${entry.id}`);
      ids.add(entry.id);
      assert.equal(typeof entry.help, "string");
      const sentences = entry.help
        .split(/[.!?](?:\s|$)/)
        .filter((part) => part.trim());
      assert.ok(
        sentences.length >= 2 && sentences.length <= 4,
        `${entry.id} needs 2–4 help sentences`,
      );
    }
  }
  for (const id of Object.keys(VIEW_COMPONENTS))
    assert.ok(
      SCREEN_TABS_REGISTRY.some(
        (entry) => entry.id === id && entry.help.trim(),
      ),
      `${id} is a view without help`,
    );
  assert.ok(APP_TABS.every((entry) => entry.help.trim()));
});
test("A-201: every report on the Reports tab has its own Hebrew help, and it is Hebrew", () => {
  const hebrew = /[\u05d0-\u05ea]/;
  const sentences = (text: string) =>
    text.split(/[.!?](?:\s|$)/).filter((part) => part.trim()).length;
  for (const entry of REPORT_TABS_REGISTRY) {
    assert.equal(typeof entry.helpHe, "string", `${entry.id} has no helpHe field`);
    assert.ok(
      entry.helpHe.trim().length > 0,
      `${entry.id} has no Hebrew help — add it to src/config/screenHelpHe.ts`,
    );
    assert.match(entry.helpHe, hebrew, `${entry.id}'s Hebrew help is not Hebrew`);
    assert.ok(
      sentences(entry.helpHe) >= 2 && sentences(entry.helpHe) <= 4,
      `${entry.id} needs 2–4 Hebrew help sentences`,
    );
    // it must be the report's own description, not a copy of the English or of a sibling
    assert.notEqual(entry.helpHe, entry.help);
  }
  const all = REPORT_TABS_REGISTRY.map((entry) => entry.helpHe);
  assert.equal(
    new Set(all).size,
    all.length,
    "two reports share the same Hebrew help",
  );
});

test("A-201: the help dialog shows a report's own Hebrew description, not the page summary", () => {
  useUIStore.setState({ activeReportTab: "financial-ratios" });
  render(<ScreenHelpHeader activeTab="reports" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Help for Financial Ratios" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "עברית" }));
  const dialog = screen.getByRole("dialog", { name: /יחסים פיננסיים/ });
  assert.match(dialog.textContent || "", /חלוקה באפס נשארת כלא מוגדרת/);
  assert.doesNotMatch(
    dialog.textContent || "",
    /Check cash on hand, money owed/,
    "the Hebrew view fell back to the general reports page summary",
  );
});

test("help searches normalized Hebrew names, English descriptions and mixed words", () => {
  const entries = screenHelpIndex();
  assert.ok(
    searchScreenHelp(entries, "יִתרוֹת").some(
      (entry) => entry.id === "account-balances-as-of",
    ),
  );
  assert.ok(
    searchScreenHelp(entries, "ratio zero").some(
      (entry) => entry.id === "financial-ratios",
    ),
  );
  assert.ok(
    searchScreenHelp(entries, "יתרות balances").some(
      (entry) => entry.id === "customer-balance-summary",
    ),
  );
  assert.equal(searchScreenHelp(entries, "no such screen xyz").length, 0);
});
test("contextual help resolves reports, settings, lenses and standalone routes", () => {
  assert.equal(
    currentScreenHelp("reports", "financial-ratios", "billing", "radar")?.id,
    "financial-ratios",
  );
  assert.equal(
    currentScreenHelp("settings", "pnl", "export", "radar")?.id,
    "export",
  );
  assert.equal(currentScreenHelp("inventory", "", "", "")?.id, "inventory");
  assert.equal(
    currentScreenHelp("intelligence", "", "", "forensics_1")?.group,
    "Analytical tool",
  );
  assert.equal(currentScreenHelp("reports", "unknown", "", "")?.id, "reports");
  assert.equal(currentScreenHelp("unknown", "", "", ""), undefined);
});
test("help preserves a parent draft and never reopens stale report help", () => {
  useUIStore.setState({ activeReportTab: "financial-ratios" });
  render(
    <>
      <label>
        Parent draft <input defaultValue="original" />
      </label>
      <ScreenHelpHeader activeTab="reports" />
    </>,
  );
  fireEvent.change(screen.getByLabelText("Parent draft"), {
    target: { value: "טיוטה A" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Help for Financial Ratios" }),
  );
  assert.ok(screen.getByRole("dialog", { name: "Help for Financial Ratios" }));
  assert.match(
    screen.getByText(/Zero denominators/).textContent || "",
    /undefined/,
  );
  fireEvent.click(screen.getByRole("button", { name: "Close help" }));
  assert.equal(
    (screen.getByLabelText("Parent draft") as HTMLInputElement).value,
    "טיוטה A",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Help for Financial Ratios" }),
  );
  act(() => useUIStore.setState({ activeReportTab: "ar-aging" }));
  assert.equal(screen.queryByRole("dialog"), null);
  assert.ok(screen.getByRole("button", { name: "Help for A/R Aging" }));
  act(() => useUIStore.setState({ activeReportTab: "financial-ratios" }));
  assert.equal(screen.queryByRole("dialog"), null);
});
test("All screens filters descriptions while keeping English display labels", () => {
  render(<AllScreensHelp />);
  fireEvent.change(screen.getByLabelText("Search screen help"), {
    target: { value: "יחסים פיננסיים" },
  });
  assert.ok(screen.getByRole("heading", { name: "Report: Financial Ratios" }));
  assert.match(screen.getByRole("status").textContent || "", /^1 of /);
  fireEvent.change(screen.getByLabelText("Search screen help"), {
    target: { value: "nothing matches xyz" },
  });
  assert.ok(screen.getByText("No screen descriptions match these words."));
});
