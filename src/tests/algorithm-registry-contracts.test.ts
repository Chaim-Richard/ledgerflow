import test from "node:test";
import assert from "node:assert/strict";
import type { ChartAccount, Transaction, Budget } from "../types";
import { FINANCIAL_ALGORITHMS } from "../lib/algorithms/index";
import {
  buildAlgorithmContext,
  type AlgorithmContext,
  type AlgoResult,
} from "../lib/algorithms/types";
const a = (
  id: string,
  type: ChartAccount["type"],
  extra: Partial<ChartAccount> = {},
): ChartAccount => ({
  id,
  uid: "u",
  workspaceId: "w",
  code: id,
  name: id,
  type,
  balanceCents: 0,
  ...extra,
});
const base = [
  a("cash", "asset", { category: "Cash", role: "cash" }),
  a("revenue", "income"),
  a("expense", "expense"),
  a("cogs", "cost_of_goods"),
  a("ar", "asset", { category: "Receivables", role: "ar" }),
  a("ap", "liability", { category: "Payables", role: "ap" }),
  a("inventory", "asset", { category: "Inventory" }),
  a("equity", "equity"),
];
const t = (
  id: string,
  date: string,
  lines: Transaction["lines"],
  extras: Partial<Transaction> = {},
): Transaction => ({
  id,
  uid: "u",
  workspaceId: "w",
  date,
  description: id,
  type: "actual",
  status: "completed",
  currency: "USD",
  totalAmountCents: Math.max(
    ...lines.map((line) => Math.abs(line.amountCents)),
  ),
  lines,
  ...extras,
});
const pair = (
  id: string,
  date: string,
  account: string,
  amount: number,
  extras: Partial<Transaction> = {},
) =>
  t(
    id,
    date,
    [
      { accountId: account, amountCents: amount },
      { accountId: "cash", amountCents: -amount },
    ],
    extras,
  );
const ctx = (
  txs: Transaction[] = [],
  accounts = base,
  entities: AlgorithmContext["entities"] = {},
) =>
  buildAlgorithmContext(
    txs,
    accounts,
    "2026-03-31",
    { start: "1900-01-01", end: "2026-03-31" },
    "USD",
    entities,
  );
const metric = (result: AlgoResult, label: string) =>
  result.metrics.find((item) => item.label === label)?.value;
const money = (cents: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);

test("registered algorithms handle empty history with structured finite results and no invented transaction references", () => {
  const empty = ctx();
  for (const [key, algorithm] of Object.entries(FINANCIAL_ALGORITHMS)) {
    const inputs = Object.fromEntries(
      algorithm.inputs.map((input) => [
        input.key,
        structuredClone(input.defaultValue),
      ]),
    );
    const before = JSON.stringify({ empty, inputs });
    const result = algorithm.compute(empty, inputs);
    assert.ok(
      Array.isArray(result.metrics) &&
        Array.isArray(result.charts) &&
        Array.isArray(result.insights),
      `${key}: invalid result shape`,
    );
    for (const item of result.metrics) {
      assert.ok(item.label, `${key}: missing metric label`);
      if (typeof item.value === "number")
        assert.ok(Number.isFinite(item.value), `${key}: nonfinite metric`);
    }
    for (const chart of result.charts)
      for (const row of chart.data)
        if (typeof row === "object")
          for (const value of Object.values(row))
            if (typeof value === "number")
              assert.ok(
                Number.isFinite(value),
                `${key}: nonfinite chart value`,
              );
    assert.equal(
      result.sourceTransactionIds?.length || 0,
      0,
      `${key}: invented source transaction`,
    );
    assert.equal(
      JSON.stringify({ empty, inputs }),
      before,
      `${key}: modified its inputs`,
    );
  }
});
test("vendor concentration has a hand-checked 60/40 wallet share and excludes draft spending", () => {
  const result = FINANCIAL_ALGORITHMS.intelligence_4.compute(
    ctx([
      pair("a", "2026-01-01", "expense", 6000, { payee: "ספק A" }),
      pair("b", "2026-01-02", "expense", 4000, { payee: "ספק B" }),
      pair("draft", "2026-01-03", "expense", 999999, {
        payee: "Other",
        status: "draft",
      }),
    ]),
    { topN: 3 },
  );
  assert.equal(metric(result, "HHI Score (Out of 10,000)"), "5200");
  assert.equal(metric(result, "Top Vendor Reliance"), "60.0%");
  assert.deepEqual(result.charts[0].data, [
    { Vendor: "ספק A", "Share %": 60, Spend: 60 },
    { Vendor: "ספק B", "Share %": 40, Spend: 40 },
  ]);
});
test("DuPont decomposes supplied closing balances and a 40% profit margin into 40% ROE", () => {
  const accounts = base.map((account) =>
    account.id === "cash"
      ? { ...account, balanceCents: 120000 }
      : account.id === "equity"
        ? { ...account, balanceCents: -100000 }
        : account,
  );
  const result = FINANCIAL_ALGORITHMS.valuation_3.compute(
    ctx(
      [
        pair("sale", "2026-01-01", "revenue", -100000),
        pair("cost", "2026-01-02", "expense", 60000),
      ],
      accounts,
    ),
    {},
  );
  assert.equal(metric(result, "Return on Equity (ROE)"), "40.00%");
  assert.equal(metric(result, "Net Profit Margin"), "40.00%");
  assert.equal(metric(result, "Asset Turnover"), "0.83x");
  assert.equal(metric(result, "Equity Multiplier (Leverage)"), "1.20x");
});
test("cash conversion cycle reconstructs openings and reconciles 45 + 18 - 15 = 48 days", () => {
  const accounts = base.map((account) => ({
    ...account,
    openingBalanceCents:
      account.id === "inventory"
        ? 30000
        : account.id === "ar"
          ? 20000
          : account.id === "ap"
            ? -10000
            : 0,
  }));
  const result = FINANCIAL_ALGORITHMS.ops_1.compute(
    ctx(
      [
        pair("sale", "2026-01-01", "revenue", -100000),
        pair("cost", "2026-01-02", "cogs", 60000),
      ],
      accounts,
    ),
    { annualizationDays: 90 },
  );
  assert.equal(metric(result, "Cash Conversion Cycle"), "48 Days");
  assert.equal(metric(result, "DIO (Inventory)"), "45 Days");
  assert.equal(metric(result, "DSO (Receivables)"), "18 Days");
  assert.equal(metric(result, "DPO (Payables)"), "15 Days");
  assert.deepEqual(result.sourceTransactionIds, ["sale", "cost"]);
});
test("customer inactivity distinguishes churn, threshold risk and current activity without reading the wall clock", () => {
  const result = FINANCIAL_ALGORITHMS.intelligence_6.compute(
    ctx([
      pair("old", "2026-01-01", "revenue", -100, { payee: "ישן A" }),
      pair("risk", "2026-01-16", "revenue", -100, { payee: "סיכון B" }),
      pair("current", "2026-03-31", "revenue", -100, { payee: "Active" }),
    ]),
    { churnThresholdDays: 80 },
  );
  assert.equal(metric(result, "Total Customers"), "3");
  assert.equal(metric(result, "Active"), "1");
  assert.equal(metric(result, "At Risk"), "1");
  assert.equal(metric(result, "Churned"), "1");
  assert.equal(metric(result, "Overall Churn Rate"), "33.3%");
});
test("project margin separates a 50% project from a loss maker and preserves Hebrew IDs", () => {
  const result = FINANCIAL_ALGORITHMS.intelligence_5.compute(
    ctx([
      pair("sale", "2026-01-01", "revenue", -10000, { projectId: "פרויקט A" }),
      pair("cost", "2026-01-02", "expense", 5000, { projectId: "פרויקט A" }),
      pair("loss-sale", "2026-01-03", "revenue", -10000, {
        projectId: "פרויקט B",
      }),
      pair("loss-cost", "2026-01-04", "expense", 12000, {
        projectId: "פרויקט B",
      }),
    ]),
    { minMarginThreshold: 15 },
  );
  assert.equal(metric(result, "Overall Profit Margin"), "15.0%");
  assert.equal(metric(result, "High-Margin Projects"), "1");
  assert.equal(metric(result, "At-Risk Projects"), "1");
  assert.deepEqual(result.charts[0].data, [
    { Project: "פרויקט A", MarginPct: 50, NetProfit: 50 },
    { Project: "פרויקט B", MarginPct: -20, NetProfit: -20 },
  ]);
});
test("account budgets compare selected-period net FX expenses and leave project-only budgets outside the report", () => {
  const budgets: Budget[] = [
    {
      id: "b",
      uid: "u",
      targetId: "expense",
      targetType: "account",
      period: "2026",
      amountCents: 10000,
      createdAt: "2026-01-01",
    },
    {
      id: "p",
      uid: "u",
      targetId: "P",
      targetType: "project",
      period: "2026",
      amountCents: 99999,
      createdAt: "2026-01-01",
    },
  ];
  const result = FINANCIAL_ALGORITHMS["budget-vs-actual"].compute(
    ctx(
      [
        pair("cost", "2026-01-01", "expense", 10000, { exchangeRate: 1.5 }),
        pair("refund", "2026-01-02", "expense", -1000),
        pair("old", "2025-01-01", "expense", 9000),
      ],
      base,
      { budgets },
    ),
    { period: "2026" },
  );
  assert.equal(result.rows?.length, 1);
  assert.equal(metric(result, "Total Actuals"), money(14000));
  assert.equal(result.rows?.[0].variance, money(-4000));
  assert.equal(result.rows?.[0].variancePct, "-40.0%");
  assert.deepEqual(result.sourceTransactionIds, ["cost", "refund"]);
});
test("registered ledger detail includes prior activity in the opening and excludes future and draft lines", () => {
  const scope = ctx([
    pair("open", "2026-01-01", "expense", 10000),
    pair("charge", "2026-02-01", "expense", 2000),
    pair("refund", "2026-02-28", "expense", -500),
    pair("march", "2026-03-01", "expense", 4000),
    pair("draft", "2026-02-15", "expense", 88888, { status: "draft" }),
  ]);
  const result = FINANCIAL_ALGORITHMS["gl-detail"].compute(scope, {
    accountId: "expense",
    period: { start: "2026-02-01", end: "2026-02-28" },
  });
  assert.deepEqual(
    result.rows?.map((row) => row.balance),
    [money(12000), money(11500)],
  );
  assert.equal(metric(result, "Total Debits"), money(2000));
  assert.equal(metric(result, "Total Credits"), money(500));
  assert.deepEqual(result.sourceTransactionIds, ["charge", "refund"]);
});
test("expense velocity compares the current day with the three previous calendar days, including zeros", () => {
  const scope = ctx([
    pair("d1", "2026-01-01", "expense", 1000),
    pair("d2", "2026-01-02", "expense", 1000),
    pair("d4", "2026-01-04", "expense", 3000),
  ]);
  const result = FINANCIAL_ALGORITHMS.ops_5.compute(scope, {
    movingAverageDays: 3,
    spikeThresholdPct: 50,
  });
  assert.equal(metric(result, "Recent Spikes"), 1);
  assert.deepEqual(result.charts[0].data, [
    { Date: "01-04", "Daily Volume": 30, Avg: 6.67 },
  ]);
  assert.deepEqual(result.sourceTransactionIds, ["d4"]);
});
