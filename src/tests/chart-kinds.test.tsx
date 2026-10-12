import "./helpers/dom";
import test, { afterEach, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import ChartFrame, { ChartTooltip } from "../components/charts/ChartFrame";
import DashboardTrendChart from "../components/dashboard/DashboardTrendChart";
import FinancialChartPanels from "../components/charts/FinancialChartPanels";
import ChartExploration from "../components/charts/ChartExploration";
import { useLedgerStore } from "../stores/useLedgerStore";
import { makeChartAccount, makeTransaction } from "./fixtures";
import { chartKindKey } from "../hooks/useChartKind";
import { useAuthStore } from "../stores/useAuthStore";
import {
  setComponentWorkspace,
  markComponentCollectionsLoaded,
} from "./helpers/componentFixtures";
import { getSupabase } from "../lib/db/client";

globalThis.ResizeObserver = window.ResizeObserver;
beforeEach(() => {
  localStorage.clear();
  setComponentWorkspace();
});
afterEach(async () => {
  cleanup();
  await getSupabase().auth.dispose();
});
const rows = [
  { id: "a", label: "2024-01", cents: -12345 },
  { id: "b", label: "2024-02", cents: 0 },
  { id: "c", label: "2024-03", cents: 67890 },
];
function Frame({
  id = "monthly",
  fallback = "bar" as const,
}: {
  id?: string;
  fallback?: "bar" | "line" | "area";
}) {
  return (
    <ChartFrame
      chartId={id}
      defaultKind={fallback}
      title={id}
      rows={rows}
      currency="EUR"
      series={[{ key: "cents", name: "הוצאות Expenses" }]}
    >
      {({ kind, rows: visible, hidden }) => (
        <p data-testid="plot">
          {JSON.stringify({ kind, rows: visible, hidden: [...hidden] })}
        </p>
      )}
    </ChartFrame>
  );
}
test("each chart remembers its kind while signed values and table/legend state stay unchanged", () => {
  const snapshot = JSON.stringify(rows);
  const view = render(
    <>
      <Frame />
      <Frame id="other" fallback="area" />
    </>,
  );
  const first = within(screen.getByRole("region", { name: "monthly" }));
  fireEvent.click(first.getByRole("button", { name: "Line" }));
  assert.match(first.getByTestId("plot").textContent || "", /"kind":"line"/);
  assert.equal(
    localStorage.getItem(
      chartKindKey("test-user", "component-workspace", "monthly"),
    ),
    "line",
  );
  assert.equal(
    within(screen.getByRole("region", { name: "other" }))
      .getByRole("button", { name: "Area" })
      .getAttribute("aria-pressed"),
    "true",
  );
  fireEvent.click(first.getByRole("button", { name: "Table" }));
  const before = first.getByRole("table").textContent;
  fireEvent.click(first.getByRole("button", { name: "Area" }));
  assert.equal(first.getByRole("table").textContent, before);
  assert.match(before || "", /123.45/);
  assert.match(before || "", /678.90/);
  fireEvent.click(first.getByRole("button", { name: "הוצאות Expenses" }));
  assert.match(first.getByRole("status").textContent || "", /No visible data/);
  fireEvent.click(first.getByRole("button", { name: "Bar" }));
  assert.match(first.getByRole("status").textContent || "", /No visible data/);
  assert.equal(JSON.stringify(rows), snapshot);
  view.unmount();
  render(<Frame />);
  assert.equal(
    screen.getByRole("button", { name: "Bar" }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    screen
      .getByRole("button", { name: "הוצאות Expenses" })
      .getAttribute("aria-pressed"),
    "true",
  );
});
test("workspace and user changes immediately select their own preferences and reset transient controls", async () => {
  const view = render(<Frame />);
  fireEvent.click(screen.getByRole("button", { name: "Area" }));
  fireEvent.click(screen.getByRole("button", { name: "הוצאות Expenses" }));
  await act(async () => {
    useAuthStore.setState({ currentWorkspaceId: "another-workspace" });
  });
  assert.equal(
    screen.getByRole("button", { name: "Bar" }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    screen
      .getByRole("button", { name: "הוצאות Expenses" })
      .getAttribute("aria-pressed"),
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Line" }));
  await act(async () => {
    useAuthStore.setState({ currentWorkspaceId: "component-workspace" });
  });
  assert.equal(
    screen.getByRole("button", { name: "Area" }).getAttribute("aria-pressed"),
    "true",
  );
  const user = useAuthStore.getState().user!;
  await act(async () => {
    useAuthStore.setState({ user: { ...user, uid: "second-user" } });
  });
  assert.equal(
    screen.getByRole("button", { name: "Bar" }).getAttribute("aria-pressed"),
    "true",
  );
  view.unmount();
  assert.notEqual(chartKindKey("a:b", "c", "d"), chartKindKey("a", "b:c", "d"));
});
test("corrupt or blocked storage uses the default and a refused save retains this visit’s choice", () => {
  localStorage.setItem(
    chartKindKey("test-user", "component-workspace", "monthly"),
    "{bad-kind",
  );
  render(<Frame fallback="line" />);
  assert.equal(
    screen.getByRole("button", { name: "Line" }).getAttribute("aria-pressed"),
    "true",
  );
  cleanup();
  const storageGet = mock.method(
    Object.getPrototypeOf(localStorage),
    "getItem",
    () => {
      throw new Error("storage denied");
    },
  );
  const storageSet = mock.method(
    Object.getPrototypeOf(localStorage),
    "setItem",
    () => {
      throw new Error("storage denied");
    },
  );
  try {
    render(<Frame fallback="area" />);
    fireEvent.click(screen.getByRole("button", { name: "Line" }));
    assert.equal(
      screen.getByRole("button", { name: "Line" }).getAttribute("aria-pressed"),
      "true",
    );
    assert.match(
      screen.getByRole("status").textContent || "",
      /could not save/,
    );
    cleanup();
    render(<Frame fallback="area" />);
    assert.equal(screen.getByRole("button", { name: "Line" }).getAttribute("aria-pressed"), "true");
    assert.match(screen.getByRole("status").textContent || "", /could not save/);
    cleanup();
    render(<Frame id="separate-blocked-chart" fallback="bar" />);
    assert.equal(screen.getByRole("button", { name: "Bar" }).getAttribute("aria-pressed"), "true");
  } finally {
    cleanup();
    storageGet.mock.restore();
    storageSet.mock.restore();
  }
});
test("financial charts expose supported kinds independently; pie charts keep category legends", () => {
  render(
    <FinancialChartPanels
      currency="EUR"
      data={{
        months: [
          {
            month: "2024-01",
            revenueCents: 1200,
            expenseCents: -500,
            profitCents: 1700,
          },
        ],
        cash: [{ id: "bank", name: "בנק Bank", cents: 2500 }],
        expenses: [{ name: "ספק", cents: 300 }],
        totalCashCents: 2500,
        avgBurnCents: -500,
        runwayMonths: null,
      }}
    />,
  );
  const mix = within(
    screen.getByRole("region", {
      name: "Monthly Profitability & Mix",
    }),
  );
  const burn = within(
    screen.getByRole("region", {
      name: "Operating Expense Burn Rate",
    }),
  );
  assert.equal(
    mix.getByRole("button", { name: "Bar" }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    burn.getByRole("button", { name: "Area" }).getAttribute("aria-pressed"),
    "true",
  );
  fireEvent.click(mix.getByRole("button", { name: "Table" }));
  assert.match(mix.getByRole("table").textContent || "", /12.00/);
  assert.match(mix.getByRole("table").textContent || "", /5.00/);
  const pie = within(
    screen.getByRole("region", {
      name: "Cash Balance Allocation",
    }),
  );
  assert.equal(pie.queryByRole("group", { name: /chart style/ }), null);
  fireEvent.click(pie.getByRole("button", { name: "בנק Bank" }));
  assert.match(pie.getByRole("status").textContent || "", /No visible data/);
});
test("dashboard trends preserve negative/zero values, inspect months in workspace currency and hide by legend", () => {
  render(
    <DashboardTrendChart
      chartId="dashboard-revenue"
      label="Revenue"
      rows={rows}
      currency="EUR"
    />,
  );
  assert.ok(screen.getByRole("img"));
  fireEvent.change(screen.getByLabelText("Revenue chart month"), {
    target: { value: "2024-01" },
  });
  assert.match(document.body.textContent || "", /123.45/);
  assert.match(document.body.textContent || "", /€/);
  fireEvent.click(screen.getByRole("button", { name: "Bar" }));
  assert.equal(document.querySelectorAll("svg rect").length, 3);
  assert.ok(
    [...document.querySelectorAll("svg rect")].every(
      (rect) => Number(rect.getAttribute("height")) >= 0,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Area" }));
  assert.equal(document.querySelectorAll("svg polygon").length, 1);
  fireEvent.change(screen.getByLabelText("Revenue chart month"), {
    target: { value: "2024-02" },
  });
  assert.match(document.body.textContent || "", /€0.00/);
  fireEvent.click(screen.getByRole("button", { name: "Revenue trend" }));
  assert.equal(screen.queryByRole("img"), null);
  assert.equal(screen.queryByLabelText("Revenue chart month"), null);
  assert.match(screen.getByRole("status").textContent || "", /Trend hidden/);
  fireEvent.click(screen.getByRole("button", { name: "Revenue trend" }));
  assert.ok(screen.getByRole("img"));
  assert.equal(
    screen.getByLabelText("Revenue chart month").getAttribute("value"),
    null,
  );
});
test("shared tooltip keeps full mixed-script labels, minor/major money, percentages and native units", () => {
  render(
    <ChartTooltip
      active
      currency="EUR"
      label="2024-01"
      series={[
        { key: "cents", name: "הוצאות Expenses", unit: "money" },
        { key: "major", name: "Profit", unit: "majorMoney" },
        { key: "margin", name: "Margin", unit: "percent" },
        { key: "days", name: "Days", unit: "days" },
      ]}
      payload={[
        { dataKey: "cents", value: -12345 },
        { dataKey: "major", value: 123.45 },
        { dataKey: "margin", value: 25 },
        { dataKey: "days", value: 2 },
      ]}
    />,
  );
  assert.match(document.body.textContent || "", /2024-01/);
  assert.match(document.body.textContent || "", /הוצאות Expenses/);
  assert.match(document.body.textContent || "", /Profit: €123.45/);
  assert.match(document.body.textContent || "", /Margin: 25%/);
  assert.match(document.body.textContent || "", /Days: 2 days/);
});
test("allocation percentage uses the original plotted total, while missing or zero totals omit a percentage", () => {
  const view = render(
    <ChartTooltip
      active
      currency="EUR"
      shareTotal={4000}
      payload={[{ dataKey: "cents", name: "בנק Bank", value: 1000 }]}
    />,
  );
  assert.match(document.body.textContent || "", /€10.00 \(25.0%\)/);
  view.rerender(
    <ChartTooltip
      active
      currency="EUR"
      shareTotal={0}
      payload={[{ dataKey: "cents", name: "Bank", value: 1000 }]}
    />,
  );
  assert.doesNotMatch(document.body.textContent || "", /%/);
  view.rerender(
    <ChartTooltip active payload={[{ dataKey: "cents", name: "Missing" }]} />,
  );
  assert.match(document.body.textContent || "", /Missing: —/);
});

test("hierarchy legends inspect full category labels with the shared currency tooltip by keyboard focus", () => {
  markComponentCollectionsLoaded("invoices");
  useLedgerStore.setState({
    accounts: [
      makeChartAccount({
        id: "expense",
        name: "ספק Expenses",
        type: "expense",
        category: "Costs",
      }),
    ],
    transactions: [
      makeTransaction({
        date: "2024-01-15",
        lines: [{ accountId: "expense", amountCents: 1200 }],
      }),
    ],
    invoices: [],
  });
  render(<ChartExploration months={["2024-01"]} currency="EUR" />);
  for (const name of [
    "Expenses by category treemap",
    "Expenses by category sunburst",
  ]) {
    const chart = within(screen.getByRole("region", { name }));
    const legend = chart.getByRole("button", { name: "ספק Expenses" });
    fireEvent.focus(legend);
    assert.match(chart.getByRole("tooltip").textContent || "", /€12.00/);
    fireEvent.blur(legend);
    assert.equal(chart.queryByRole("tooltip"), null);
  }
});
