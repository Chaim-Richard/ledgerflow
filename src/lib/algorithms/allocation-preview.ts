import type { AlgorithmDefinition } from "./types";
import { formatCurrency } from "../utils";
import {
  allocateMinor,
  guardedPreview,
  integer,
  numberInput,
} from "./previewMath";
export const ALLOCATION_PREVIEW: AlgorithmDefinition = {
  id: "cost-allocation-preview",
  name: "Cost Allocation by Percentage or Driver",
  domain: "operations",
  requires: [],
  tags: ["Allocation", "Cost centres"],
  description:
    "Allocate one cost across three scenario recipients using percentages or driver counts. Percentages must total 100; the last positive-weight recipient receives the rounding remainder.",
  help: {
    scope:
      "Typed total and weights, with optional account labels from the supplied account context. No cost centre, account balance or allocation rule is saved.",
    method:
      "Each share is total × weight / sum of weights, floored to whole minor units. The last recipient with a positive weight receives the remaining units; zero-weight recipients receive zero.",
    example:
      "A 101-minor-unit cost at 50%, 30%, 20% gives 50, 30, 21. Driver weights 5, 3, 2 give the same allocation.",
    limits:
      "Three recipients, nonnegative costs and two-decimal percentages only. Account selections provide labels; they do not define posting accounts or persist an allocation rule.",
  },
  inputs: [
    numberInput("totalCents", "Total cost (minor units)", 101),
    {
      kind: "select",
      key: "method",
      label: "Allocation method",
      defaultValue: "percentage",
      options: [
        { value: "percentage", label: "Percentages" },
        { value: "driver", label: "Driver counts" },
      ],
    },
    ...["A", "B", "C"].flatMap((label, index) => [
      {
        kind: "number" as const,
        key: `weight${index + 1}`,
        label: `${label}: percentage or driver count`,
        min: 0,
        max: 1e9,
        step: 0.01,
        defaultValue: [50, 30, 20][index],
      },
      {
        kind: "account" as const,
        key: `recipient${index + 1}`,
        label: `${label}: optional account label`,
      },
    ]),
  ],
  compute: (ctx, inputs) =>
    guardedPreview(() => {
      const total = integer(inputs, "totalCents", 101),
        method = inputs.method ?? "percentage";
      if (method !== "percentage" && method !== "driver")
        throw new Error("Choose percentages or driver counts.");
      const weights = [50, 30, 20].map((fallback, index) => {
        const value = inputs[`weight${index + 1}`] ?? fallback;
        if (method === "driver")
          return integer(inputs, `weight${index + 1}`, fallback, 0, 1e9);
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 100 ||
          Math.abs(value * 100 - Math.round(value * 100)) > 1e-7
        )
          throw new Error(
            "Each percentage must be between 0 and 100 with at most two decimals.",
          );
        return Math.round(value * 100);
      });
      if (
        method === "percentage" &&
        weights.reduce((sum, weight) => sum + weight, 0) !== 10000
      )
        throw new Error("Allocation percentages must total exactly 100.");
      const amounts = allocateMinor(total, weights),
        rows = amounts.map((amount, index) => {
          const accountId = inputs[`recipient${index + 1}`];
          if (accountId !== undefined && typeof accountId !== "string")
            throw new Error("Choose a valid optional account label.");
          const account = accountId
            ? ctx.accounts.find((item) => item.id === accountId)
            : undefined;
          if (accountId && !account)
            throw new Error(
              "A selected account label is not in the supplied context.",
            );
          return {
            recipient: account?.name || `Recipient ${["A", "B", "C"][index]}`,
            accountId: account?.id || "",
            weight:
              method === "percentage" ? weights[index] / 100 : weights[index],
            allocationCents: amount,
          };
        });
      return {
        metrics: [
          {
            label: "Allocated total",
            value: formatCurrency(total, ctx.reportingCurrency),
          },
        ],
        charts: [],
        rows,
        insights: [
          "The allocation adds up exactly to the entered total. Recipient labels, balances and saved rules are unchanged.",
        ],
      };
    }),
};
