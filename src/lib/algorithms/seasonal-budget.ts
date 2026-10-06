import type { AlgorithmDefinition } from "./types";
import { formatCurrency } from "../utils";
import { isPostable, lineAmount, transactionDate } from "../txFilters";
import { validCustomReportPeriod } from "../reportCustomPeriod";
import {
  allocateMinor,
  guardedPreview,
  integer,
  numberInput,
  safeMinor,
} from "./previewMath";
export const SEASONAL_BUDGET: AlgorithmDefinition = {
  id: "seasonal-budget-preview",
  name: "Seasonal Budget Distribution",
  domain: "planning",
  requires: ["transactions", "accounts"],
  tags: ["Budget", "Seasonality"],
  description:
    "Spread a typed annual budget using the prior year’s monthly net expense pattern. Uses supplied posted expense/COGS lines and existing FX conversion; no budget is saved.",
  help: {
    scope:
      "Supplied posted transactions and expense/COGS accounts for the chosen prior year, plus a typed annual budget. An optional account narrows the pattern.",
    method:
      "Monthly net debits become allocation weights. Floor each positive share to minor units; the last positive month receives the rounding remainder. Zero months receive zero.",
    example:
      "January costs 100 and February 300, with no other costs: a 101-minor-unit budget allocates 25 then 76.",
    limits:
      "A zero annual pattern or a negative net month cannot produce this distribution. Missing history makes the pattern provisional; use full-history reports before relying on it. Calendar-year, expense-based seasonality only.",
  },
  inputs: [
    numberInput("annualCents", "Annual budget (minor units)", 120000),
    numberInput("priorYear", "Prior pattern year", 2025, 2998, 1900),
    { kind: "account", key: "accountId", label: "Optional expense account" },
  ],
  compute: (ctx, inputs) =>
    guardedPreview(() => {
      const annual = integer(inputs, "annualCents", 120000),
        year = integer(inputs, "priorYear", 2025, 1900, 2998),
        accountId = inputs.accountId;
      if (
        !validCustomReportPeriod({
          startDate: ctx.asOfDate,
          endDate: ctx.asOfDate,
        }) ||
        year >= Number(ctx.asOfDate.slice(0, 4))
      )
        throw new Error(
          "Choose a complete prior calendar year before the as-of year.",
        );
      const eligible = (id: string) =>
        ctx.accounting.isExpense(id) || ctx.accounting.isCOGS(id);
      if (accountId !== undefined && typeof accountId !== "string")
        throw new Error("Choose an expense account.");
      if (
        accountId &&
        (!ctx.accounts.some((account) => account.id === accountId) ||
          !eligible(String(accountId)))
      )
        throw new Error(
          "The selected account must be an expense or COGS account.",
        );
      const weights = Array<bigint>(12).fill(0n),
        source = new Set<string>();
      for (const tx of ctx.transactions) {
        if (!isPostable(tx)) continue;
        const date = transactionDate(tx);
        if (!date.startsWith(`${year}-`)) continue;
        if (!validCustomReportPeriod({ startDate: date, endDate: date }))
          throw new Error(
            "Prior-year history contains an invalid transaction date.",
          );
        for (const line of tx.lines || []) {
          if (
            !eligible(line.accountId) ||
            (accountId && line.accountId !== accountId)
          )
            continue;
          const amount = lineAmount(line, tx);
          if (!Number.isSafeInteger(amount))
            throw new Error(
              "A prior-year cost is not safe integer minor units.",
            );
          weights[Number(date.slice(5, 7)) - 1] += BigInt(amount);
          source.add(tx.id);
        }
      }
      if (weights.some((value) => value < 0n))
        throw new Error(
          "A prior-year month has negative net costs. Review refunds or choose a different account/year.",
        );
      const pattern = weights.map(safeMinor),
        allocations = allocateMinor(annual, pattern),
        rows = allocations.map((amount, index) => ({
          month: `${year + 1}-${String(index + 1).padStart(2, "0")}`,
          priorCostCents: pattern[index],
          budgetCents: amount,
        }));
      return {
        metrics: [
          {
            label: "Annual allocated budget",
            value: formatCurrency(annual, ctx.reportingCurrency),
          },
        ],
        rows,
        sourceTransactionIds: [...source],
        charts: [
          {
            data: rows,
            config: {
              xKey: "month",
              yKeys: [
                {
                  key: "budgetCents",
                  name: "Budget (minor units)",
                  color: "#2563eb",
                  type: "bar",
                },
              ],
            },
          },
        ],
        insights: [
          "Only supplied history is used; unloaded months are not proven to have zero costs. Net expense weights include reversals and shared FX conversion. This preview never saves a budget.",
        ],
      };
    }),
};
