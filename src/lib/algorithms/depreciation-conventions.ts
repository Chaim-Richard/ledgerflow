import type { AlgorithmDefinition } from "./types";
import { formatCurrency } from "../utils";
import {
  allocateMinor,
  guardedPreview,
  integer,
  numberInput,
} from "./previewMath";
export const DEPRECIATION_CONVENTIONS: AlgorithmDefinition = {
  id: "depreciation-conventions-preview",
  name: "Depreciation Conventions",
  domain: "finance",
  requires: [],
  tags: ["Depreciation", "Planning"],
  description:
    "Compare straight-line calendar-year schedules using full-month, half-month, half-year or mid-quarter timing. This is a planning preview, not statutory MACRS or a posting action.",
  help: {
    scope:
      "Typed cost, salvage, service year/month and useful life; no asset or tax records are read.",
    method:
      "Spread cost less salvage over useful-life months. Full month includes the service month; half month includes half of it; half year uses six first-year months; mid-quarter uses the midpoint of the service quarter. The final year takes the rounding remainder.",
    example:
      "A 1,200-minor-unit basis over one year placed in April produces 900 then 300 under full month, 850 then 350 under half month, and 750 then 450 under mid-quarter.",
    limits:
      "Calendar years and straight-line depreciation only. Disposal timing, statutory eligibility, MACRS percentages and jurisdiction-specific tax rules are not included.",
  },
  inputs: [
    numberInput("costCents", "Asset cost (minor units)", 120000),
    numberInput("salvageCents", "Salvage value (minor units)", 0),
    numberInput("lifeYears", "Useful life (years)", 5, 100, 1),
    numberInput("serviceYear", "Service year", 2026, 2899, 1900),
    numberInput("serviceMonth", "Service month (1–12)", 4, 12, 1),
    {
      kind: "select",
      key: "convention",
      label: "Convention",
      defaultValue: "full-month",
      options: [
        { value: "full-month", label: "Full month" },
        { value: "half-month", label: "Half month" },
        { value: "half-year", label: "Half year" },
        { value: "mid-quarter", label: "Mid-quarter" },
      ],
    },
  ],
  compute: (ctx, inputs) =>
    guardedPreview(() => {
      const cost = integer(inputs, "costCents", 120000),
        salvage = integer(inputs, "salvageCents", 0),
        life = integer(inputs, "lifeYears", 5, 1, 100),
        year = integer(inputs, "serviceYear", 2026, 1900, 2899),
        month = integer(inputs, "serviceMonth", 4, 1, 12);
      if (salvage > cost) throw new Error("Salvage cannot exceed asset cost.");
      const convention = inputs.convention ?? "full-month";
      const first =
        convention === "full-month"
          ? (13 - month) * 2
          : convention === "half-month"
            ? (13 - month) * 2 - 1
            : convention === "half-year"
              ? 12
              : convention === "mid-quarter"
                ? 21 - Math.floor((month - 1) / 3) * 6
                : 0;
      if (!first)
        throw new Error("Choose a supported depreciation convention.");
      let remaining = life * 24;
      const weights: number[] = [];
      while (remaining > 0) {
        const weight = Math.min(remaining, weights.length ? 24 : first);
        weights.push(weight);
        remaining -= weight;
      }
      let book = cost;
      const amounts = allocateMinor(cost - salvage, weights),
        rows = amounts.map((amount, index) => {
          book -= amount;
          return {
            year: year + index,
            months: weights[index] / 2,
            depreciationCents: amount,
            closingBookValueCents: book,
          };
        });
      return {
        metrics: [
          {
            label: "Total depreciation",
            value: formatCurrency(cost - salvage, ctx.reportingCurrency),
          },
          {
            label: "Final book value",
            value: formatCurrency(book, ctx.reportingCurrency),
          },
        ],
        rows,
        charts: [
          {
            data: rows,
            config: {
              xKey: "year",
              yKeys: [
                {
                  key: "depreciationCents",
                  color: "#2563eb",
                  name: "Depreciation (minor units)",
                  type: "bar",
                },
              ],
            },
          },
        ],
        insights: [
          "Full useful-life basis is allocated exactly; the final calendar year receives rounding residue. Calendar-year straight-line preview only; nothing is posted.",
        ],
      };
    }),
};
