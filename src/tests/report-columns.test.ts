import test from "node:test";
import assert from "node:assert/strict";
import {
  splitReportPeriods,
  computeReportColumns,
  statementFigures,
  statementRows,
  percentageOfTotal,
  reportVariance,
  statementColumnCsv,
} from "../lib/reportColumns";
import { makeChartAccount, makeTransaction } from "./fixtures";

const accounts = [
  makeChartAccount({ id: "cash", name: "Cash", openingBalanceCents: 10000 }),
  makeChartAccount({
    id: "equity",
    name: "Capital",
    type: "equity",
    category: "Equity",
    openingBalanceCents: 10000,
  }),
  makeChartAccount({
    id: "income",
    name: "מכירות Sales",
    type: "income",
    category: "Revenue",
    code: "4000",
  }),
  makeChartAccount({
    id: "expense",
    name: "Rent",
    type: "expense",
    category: "Expenses",
    code: "6000",
  }),
  makeChartAccount({
    id: "cogs",
    name: "Stock cost",
    type: "cost_of_goods",
    category: "COGS",
    code: "5000",
  }),
];
const sale = (date: string, cents: number) =>
  makeTransaction({
    id: `sale-${date}`,
    date,
    totalAmountCents: cents,
    lines: [
      { accountId: "cash", amountCents: cents },
      { accountId: "income", amountCents: -cents },
    ],
  });
const cost = (date: string, cents: number, accountId = "expense") =>
  makeTransaction({
    id: `cost-${date}`,
    date,
    totalAmountCents: cents,
    lines: [
      { accountId, amountCents: cents },
      { accountId: "cash", amountCents: -cents },
    ],
  });

test("April fiscal year splits into four inclusive quarters and twelve calendar months", () => {
  const quarters = splitReportPeriods(
    "2024-04-01",
    "2025-03-31",
    "quarters",
    4,
  );
  assert.deepEqual(
    quarters.map(({ startDate, endDate }) => [startDate, endDate]),
    [
      ["2024-04-01", "2024-06-30"],
      ["2024-07-01", "2024-09-30"],
      ["2024-10-01", "2024-12-31"],
      ["2025-01-01", "2025-03-31"],
    ],
  );
  assert.deepEqual(
    quarters.map((period) => period.label),
    ["FY2025 Q1", "FY2025 Q2", "FY2025 Q3", "FY2025 Q4"],
  );
  const months = splitReportPeriods("2023-04-01", "2024-03-31", "months", 4);
  assert.equal(months.length, 12);
  assert.deepEqual(months[10], {
    id: "2024-02-01:2024-02-29",
    label: "Feb 2024",
    startDate: "2024-02-01",
    endDate: "2024-02-29",
  });
  assert.equal(months[11].endDate, "2024-03-31");
});

test("partial months/quarters are clipped; invalid and reversed dates have no columns", () => {
  assert.deepEqual(
    splitReportPeriods("2024-02-15", "2024-03-10", "months").map((p) => [
      p.startDate,
      p.endDate,
    ]),
    [
      ["2024-02-15", "2024-02-29"],
      ["2024-03-01", "2024-03-10"],
    ],
  );
  assert.deepEqual(
    splitReportPeriods("2024-03-15", "2024-04-10", "quarters", 4).map((p) => [
      p.startDate,
      p.endDate,
    ]),
    [
      ["2024-03-15", "2024-03-31"],
      ["2024-04-01", "2024-04-10"],
    ],
  );
  assert.deepEqual(
    splitReportPeriods("2024-02-30", "2024-03-10", "months"),
    [],
  );
  assert.deepEqual(splitReportPeriods("2024-03-10", "2024-02-10", "total"), []);
  assert.deepEqual(splitReportPeriods("", "2024-02-10", "quarters"), []);
  assert.deepEqual(
    splitReportPeriods("2024-02-01", "2024-02-29", "total").map((p) => [
      p.label,
      p.startDate,
      p.endDate,
    ]),
    [["Total", "2024-02-01", "2024-02-29"]],
  );
});

test("monthly P&L includes leap day exactly once and ignores drafts, voids and March", () => {
  const periods = splitReportPeriods("2024-01-01", "2024-02-29", "months");
  const transactions = [
    sale("2024-01-31", 1000),
    sale("2024-02-01", 2000),
    cost("2024-02-29", 500),
    sale("2024-03-01", 900),
    { ...sale("2024-02-10", 99999), status: "draft" as const },
    { ...sale("2024-02-11", 88888), status: "void" as const },
  ];
  const figures = computeReportColumns(
    "pl",
    accounts,
    transactions,
    periods,
  ).map((column) => statementFigures(column.data));
  assert.deepEqual(
    figures.map((f) => [
      f.values["total:income"],
      f.values["total:expense"],
      f.values["total:grossProfit"],
      f.values["total:netIncome"],
      f.denominator,
    ]),
    [
      [1000, 0, 1000, 1000, 1000],
      [2000, 500, 2000, 1500, 2000],
    ],
  );
  assert.equal(
    percentageOfTotal(
      figures[1].values["account:expense"],
      figures[1].denominator,
    ),
    25,
  );
});

test("fiscal quarterly P&L and closing balance sheets use the same entries and comparison periods", () => {
  const periods = splitReportPeriods("2024-04-01", "2024-09-30", "quarters", 4);
  const previous = splitReportPeriods(
    "2023-04-01",
    "2023-09-30",
    "quarters",
    4,
  );
  const transactions = [
    sale("2023-04-15", 1000),
    sale("2024-04-15", 10000),
    cost("2024-04-20", 2500),
    sale("2024-05-10", 20000),
    cost("2024-06-30", 5000, "cogs"),
    cost("2024-07-01", 3000),
  ];
  const pl = computeReportColumns(
    "pl",
    accounts,
    transactions,
    periods,
    previous,
  );
  assert.deepEqual(
    pl.map((c) => statementFigures(c.data).values["total:netIncome"]),
    [22500, -3000],
  );
  assert.equal(
    statementFigures(pl[0].previousData!).values["total:netIncome"],
    1000,
  );
  assert.deepEqual(reportVariance(22500, 1000), {
    amount: 21500,
    percent: 2150,
  });
  assert.deepEqual(reportVariance(-3000, 0), { amount: -3000, percent: null });
  const bs = computeReportColumns(
    "bs",
    accounts,
    transactions,
    periods,
    previous,
  );
  assert.deepEqual(
    bs.map((c) => {
      const f = statementFigures(c.data);
      return [
        f.values["account:cash"],
        f.values["total:assets"],
        f.values["total:retainedEarnings"],
        f.values["total:equity"],
        f.values["total:claims"],
        f.denominator,
      ];
    }),
    [
      [33500, 33500, 23500, 33500, 33500, 33500],
      [30500, 30500, 20500, 30500, 30500, 30500],
    ],
  );
  assert.equal(
    statementFigures(bs[0].previousData!).values["total:assets"],
    11000,
  );
  assert.equal(
    percentageOfTotal(
      statementFigures(bs[0].data).values["account:cash"],
      33500,
    ),
    100,
  );
});

test("CSV includes the displayed cents, percentages, comparison amounts and zero-base variance", () => {
  const periods = splitReportPeriods("2024-02-01", "2024-02-29", "months");
  const previous = splitReportPeriods("2023-02-01", "2023-02-28", "months");
  const columns = computeReportColumns(
    "pl",
    accounts,
    [
      sale("2024-02-01", 2000),
      cost("2024-02-29", 500),
      sale("2023-02-01", 1000),
    ],
    periods,
    previous,
  );
  const rows = statementRows(accounts, columns[0].data);
  const csv = statementColumnCsv(rows, columns, true, true);
  assert.equal(csv.headers.length, 7);
  assert.deepEqual(
    csv.rows.find((row) => row[0] === "מכירות Sales"),
    ["מכירות Sales", "4000", "20.00", "100.0%", "10.00", "10.00", "100.0%"],
  );
  assert.deepEqual(
    csv.rows.find((row) => row[0] === "Rent"),
    ["Rent", "6000", "5.00", "25.0%", "0.00", "5.00", "—"],
  );
  assert.equal(percentageOfTotal(100, 0), null);
  assert.deepEqual(reportVariance(100, -100), { amount: 200, percent: 200 });
  const missing = statementColumnCsv(
    rows,
    computeReportColumns("pl", accounts, [], periods),
    false,
    true,
  );
  assert.deepEqual(
    missing.rows.find((row) => row[0] === "Net income")?.slice(3),
    ["", "", ""],
  );
});
