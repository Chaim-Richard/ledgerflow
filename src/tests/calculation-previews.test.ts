import test from "node:test";
import assert from "node:assert/strict";
import type { ChartAccount, Transaction } from "../types";
import type {
  AlgorithmContext,
  AlgorithmInvoice,
  AlgorithmDefinition,
} from "../lib/algorithms/types";
import { buildAlgorithmContext } from "../lib/algorithms/types";
import { FINANCIAL_ALGORITHMS } from "../lib/algorithms/index";
import { PRODUCTION_DEPRECIATION } from "../lib/algorithms/production-depreciation";
import { DEPRECIATION_CONVENTIONS } from "../lib/algorithms/depreciation-conventions";
import { PRICING_PREVIEW } from "../lib/algorithms/pricing-preview";
import { ALLOCATION_PREVIEW } from "../lib/algorithms/allocation-preview";
import { STANDARD_COST_VARIANCE } from "../lib/algorithms/standard-cost-variance";
import { SEASONAL_BUDGET } from "../lib/algorithms/seasonal-budget";
import { CUSTOMER_COHORTS } from "../lib/algorithms/customer-cohorts";
const account = (
  id: string,
  type: ChartAccount["type"],
  name: string,
): ChartAccount => ({
  id,
  uid: "u",
  workspaceId: "w",
  code: id,
  name,
  type,
  balanceCents: 0,
});
const accounts = [
  account("expense", "expense", "חשמל A"),
  account("other", "expense", "חשמל A"),
  account("cash", "asset", "Bank"),
];
const tx = (
  id: string,
  date: string,
  amount: number,
  extras: Partial<Transaction> = {},
): Transaction => ({
  id,
  uid: "u",
  workspaceId: "w",
  date,
  description: "הוצאה Shop",
  currency: "USD",
  status: "completed",
  type: "actual",
  totalAmountCents: Math.abs(amount),
  lines: [
    { accountId: "expense", amountCents: amount },
    { accountId: "cash", amountCents: -amount },
  ],
  ...extras,
});
const context = (
  transactions: Transaction[] = [],
  invoices: AlgorithmInvoice[] = [],
  asOfDate = "2026-03-31",
): AlgorithmContext =>
  buildAlgorithmContext(
    transactions,
    accounts,
    asOfDate,
    { start: "1900-01-01", end: asOfDate },
    "USD",
    { invoices },
  );
const ctx = context();
const invoice = (
  id: string,
  customerId: string,
  date: string,
  extras: Partial<AlgorithmInvoice> = {},
): AlgorithmInvoice => ({
  id,
  customerId,
  customerName: "לקוח Mixed",
  date,
  status: "sent",
  amountCents: 100,
  ...extras,
});
const tools = [
  PRODUCTION_DEPRECIATION,
  DEPRECIATION_CONVENTIONS,
  PRICING_PREVIEW,
  ALLOCATION_PREVIEW,
  STANDARD_COST_VARIANCE,
  SEASONAL_BUDGET,
  CUSTOMER_COHORTS,
];
function rejected(
  tool: AlgorithmDefinition,
  inputs: Record<string, unknown>,
  message: RegExp,
  scope = ctx,
) {
  const result = tool.compute(scope, inputs);
  assert.equal(result.rows?.length, 0);
  assert.equal(result.metrics.length, 0);
  assert.match(result.insights.join(" "), message);
}
test("seven previews are registered with English typed controls and explicit method, example and limits", () => {
  for (const tool of tools) {
    assert.equal(FINANCIAL_ALGORITHMS[tool.id], tool);
    assert.ok(
      tool.help?.scope &&
        tool.help.method &&
        tool.help.example &&
        tool.help.limits,
    );
    assert.ok(
      tool.inputs.every((input) => !/[\u0590-\u05ff]/.test(input.label)),
    );
  }
});
test("production charges use cumulative rounding and finish at salvage, including a zero-production period", () => {
  const charges = [0, 1, 2].map(
    (priorUnits) =>
      PRODUCTION_DEPRECIATION.compute(ctx, {
        costCents: 1001,
        salvageCents: 1,
        capacity: 3,
        units: 1,
        priorUnits,
      }).rows![0],
  );
  assert.deepEqual(
    charges.map((row) => row.periodDepreciationCents),
    [333, 334, 333],
  );
  assert.equal(charges[2].closingBookValueCents, 1);
  assert.equal(
    PRODUCTION_DEPRECIATION.compute(ctx, {
      costCents: 1001,
      salvageCents: 1,
      capacity: 3,
      units: 0,
      priorUnits: 1,
    }).rows![0].periodDepreciationCents,
    0,
  );
  rejected(
    PRODUCTION_DEPRECIATION,
    { costCents: 2, salvageCents: 3 },
    /Salvage/,
  );
  rejected(
    PRODUCTION_DEPRECIATION,
    { capacity: 3, priorUnits: 3, units: 1 },
    /capacity/,
  );
  rejected(PRODUCTION_DEPRECIATION, { capacity: 0 }, /whole number/);
});
test("all four service conventions have independently checked first and final calendar-year charges", () => {
  for (const [convention, expected] of Object.entries({
    "full-month": [900, 300],
    "half-month": [850, 350],
    "half-year": [600, 600],
    "mid-quarter": [750, 450],
  })) {
    const result = DEPRECIATION_CONVENTIONS.compute(ctx, {
      costCents: 1200,
      salvageCents: 0,
      lifeYears: 1,
      serviceMonth: 4,
      serviceYear: 2024,
      convention,
    });
    assert.deepEqual(
      result.rows?.map((row) => row.depreciationCents),
      expected,
    );
    assert.deepEqual(
      result.rows?.map((row) => row.year),
      [2024, 2025],
    );
    assert.equal(result.rows?.at(-1)?.closingBookValueCents, 0);
  }
  const late = DEPRECIATION_CONVENTIONS.compute(ctx, {
    costCents: 1007,
    salvageCents: 7,
    lifeYears: 2,
    serviceMonth: 12,
    convention: "mid-quarter",
  });
  assert.deepEqual(
    late.rows?.map((row) => row.depreciationCents),
    [62, 500, 438],
  );
  assert.equal(late.rows?.at(-1)?.closingBookValueCents, 7);
  rejected(DEPRECIATION_CONVENTIONS, { convention: "invented" }, /supported/);
  rejected(DEPRECIATION_CONVENTIONS, { lifeYears: 0 }, /whole/);
  rejected(DEPRECIATION_CONVENTIONS, { serviceMonth: 13 }, /whole/);
});
test("tiered and volume pricing keep inclusive thresholds, zero quantities and separate band totals", () => {
  const result = PRICING_PREVIEW.compute(ctx, {});
  assert.deepEqual(
    result.rows?.map((row) => row.graduatedChargeCents),
    [1000, 400, 0],
  );
  assert.match(String(result.metrics[1].value), /14\.00/);
  assert.match(String(result.metrics[2].value), /12\.00/);
  for (const [quantity, graduated, volume] of [
    [10, 1000, 1000],
    [11, 1080, 880],
    [100, 8200, 8000],
    [101, 8260, 6060],
    [0, 0, 0],
  ]) {
    const r = PRICING_PREVIEW.compute(ctx, { quantity, method: "volume" });
    assert.equal(
      r.rows?.reduce((sum, row) => sum + Number(row.graduatedChargeCents), 0),
      graduated,
    );
    assert.equal(
      r.metrics[0].value,
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(volume / 100),
    );
  }
  rejected(PRICING_PREVIEW, { limit2: 10 }, /exceed/);
  rejected(PRICING_PREVIEW, { quantity: 1.5 }, /whole/);
  rejected(
    PRICING_PREVIEW,
    { quantity: 1e9, price1: 1e12, price2: 1e12, price3: 1e12 },
    /safe integer/,
  );
});
test("percentage and driver allocation preserve exact totals, zero weights and mixed labels without merging identities", () => {
  const result = ALLOCATION_PREVIEW.compute(ctx, {
    recipient1: "expense",
    recipient2: "other",
  });
  assert.deepEqual(
    result.rows?.map((row) => row.allocationCents),
    [50, 30, 21],
  );
  assert.deepEqual(
    result.rows?.map((row) => row.accountId),
    ["expense", "other", ""],
  );
  assert.equal(result.rows?.[0].recipient, "חשמל A");
  assert.deepEqual(
    ALLOCATION_PREVIEW.compute(ctx, {
      weight1: 33.33,
      weight2: 33.33,
      weight3: 33.34,
    }).rows?.map((row) => row.allocationCents),
    [33, 33, 35],
  );
  assert.deepEqual(
    ALLOCATION_PREVIEW.compute(ctx, {
      method: "driver",
      weight1: 3,
      weight2: 1,
      weight3: 0,
    }).rows?.map((row) => row.allocationCents),
    [75, 26, 0],
  );
  rejected(ALLOCATION_PREVIEW, { weight1: 49 }, /exactly 100/);
  rejected(
    ALLOCATION_PREVIEW,
    { method: "driver", weight1: 0, weight2: 0, weight3: 0 },
    /above zero/,
  );
  rejected(ALLOCATION_PREVIEW, { method: "driver", weight1: 1.5 }, /whole/);
  rejected(ALLOCATION_PREVIEW, { recipient1: "missing" }, /not in/);
});
test("price and quantity variance reconcile exactly for unfavorable, favorable and offsetting costs", () => {
  assert.deepEqual(
    STANDARD_COST_VARIANCE.compute(ctx, {}).rows?.map(
      (row) => row.varianceCents,
    ),
    [120, 200, 320],
  );
  const favorable = STANDARD_COST_VARIANCE.compute(ctx, {
    actualUnits: 8,
    actualPriceCents: 80,
  });
  assert.deepEqual(
    favorable.rows?.map((row) => row.varianceCents),
    [-160, -200, -360],
  );
  assert.equal(favorable.rows?.[2].interpretation, "Favorable");
  assert.deepEqual(
    STANDARD_COST_VARIANCE.compute(ctx, {
      actualUnits: 20,
      actualPriceCents: 50,
    }).rows?.map((row) => row.varianceCents),
    [-1000, 1000, 0],
  );
  rejected(STANDARD_COST_VARIANCE, { actualUnits: -1 }, /whole/);
  rejected(
    STANDARD_COST_VARIANCE,
    { actualUnits: 1e9, actualPriceCents: 1e12 },
    /safe integer/,
  );
});
test("seasonal distribution uses posted net expenses, line FX, calendar dates and the last positive month for residue", () => {
  const scope = context([
    tx("jan", "2025-01-31T23:59:00Z", 50, { exchangeRate: 2 }),
    tx("feb", "2025-02-28", 350),
    tx("refund", "2025-02-20", -50),
    tx("draft", "2025-03-01", 5000, { status: "draft" }),
    tx("void", "2025-03-01", 5000, { status: "void" }),
    tx("old", "2024-01-01", 1000),
  ]);
  const result = SEASONAL_BUDGET.compute(scope, { annualCents: 101 });
  assert.equal(result.rows?.length, 12);
  assert.deepEqual(
    result.rows
      ?.slice(0, 3)
      .map((row) => [row.priorCostCents, row.budgetCents]),
    [
      [100, 25],
      [300, 76],
      [0, 0],
    ],
  );
  assert.equal(
    result.rows?.reduce((sum, row) => sum + Number(row.budgetCents), 0),
    101,
  );
  assert.deepEqual(result.sourceTransactionIds, ["jan", "feb", "refund"]);
  assert.equal(result.rows?.[0].month, "2026-01");
  rejected(SEASONAL_BUDGET, { priorYear: 2026 }, /prior calendar/);
  rejected(SEASONAL_BUDGET, { accountId: "cash" }, /expense or COGS/);
  rejected(SEASONAL_BUDGET, {}, /weight/, context());
  rejected(
    SEASONAL_BUDGET,
    {},
    /negative net/,
    context([tx("negative", "2025-02-01", -1)]),
  );
});
test("cohorts use first observed issued invoice per stable ID, distinct repeat activity and blank future months", () => {
  const scope = context(
    [],
    [
      invoice("a-feb", "א A", "2025-02-01"),
      invoice("a-jan", "א A", "2025-01-01"),
      invoice("a-repeat", "א A", "2025-02-10"),
      invoice("b-jan", "ב A", "2025-01-31"),
      invoice("c-feb", "c", "2025-02-28"),
      invoice("paid", "c", "2025-03-01", { status: "paid" }),
      invoice("draft", "d", "2024-01-01", { status: "draft" }),
      invoice("void", "d", "2024-01-01", { status: "void" }),
      invoice("deleted", "d", "2024-01-01", { deletedAt: "now" }),
      invoice("opening", "א A", "2024-01-01", {
        metadata: { type: "opening-balance" },
      }),
      invoice("future", "future", "2025-04-01"),
      invoice("bad", "bad", "2025-02-30"),
      invoice("missing", "", "2025-01-01"),
    ],
    "2025-03-15",
  );
  const result = CUSTOMER_COHORTS.compute(scope, { months: 3 });
  assert.equal(result.metrics[0].value, 3);
  assert.equal(result.rows?.length, 2);
  const jan = result.rows![0],
    feb = result.rows![1];
  assert.equal(jan.cohort, "2025-01");
  assert.equal(jan.customers, 2);
  assert.equal(jan["Month 0 (%)"], 100);
  assert.equal(jan["Month 1 active"], 1);
  assert.equal(jan["Month 1 (%)"], 50);
  assert.equal(jan["Month 2 (%)"], 0);
  assert.equal(jan["Month 3 (%)"], null);
  assert.equal(feb["Month 1 (%)"], 100);
  assert.equal(feb["Month 2 (%)"], null);
  assert.match(result.insights[0], /^2 issued/);
  const empty = CUSTOMER_COHORTS.compute(ctx, {});
  assert.equal(empty.rows?.length, 0);
  rejected(CUSTOMER_COHORTS, { months: 0 }, /whole/);
});
test("preview calculations do not mutate their supplied context or typed inputs", () => {
  const inputs = Object.freeze({});
  const frozen = Object.freeze({
    ...ctx,
    accounts: Object.freeze([...ctx.accounts]),
    transactions: Object.freeze([...ctx.transactions]),
  });
  const before = JSON.stringify(frozen);
  for (const tool of tools) tool.compute(frozen, inputs);
  assert.equal(JSON.stringify(frozen), before);
});
