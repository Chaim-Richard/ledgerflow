import type { AlgorithmDefinition } from "./types";
import { formatCurrency } from "../utils";
import {
  guardedPreview,
  integer,
  numberInput,
  roundRatio,
} from "./previewMath";
export const PRODUCTION_DEPRECIATION: AlgorithmDefinition = {
  id: "units-production-preview",
  name: "Units-of-production Depreciation",
  domain: "finance",
  requires: [],
  tags: ["Depreciation", "Preview"],
  description:
    "Preview depreciation from asset cost, salvage and actual production units. Enter money in integer minor units; no asset record or journal is changed.",
  help: {
    scope:
      "Only the typed scenario inputs; workspace currency labels the money.",
    method:
      "Depreciable basis is cost minus salvage. Round cumulative depreciation at the start and end of the period; their difference is this period’s charge.",
    example:
      "Cost 1,001 minor units, salvage 1 and capacity 3 units: the three one-unit charges are 333, 334 and 333.",
    limits:
      "Expected lifetime units must be positive. Prior plus current units cannot exceed capacity; revise the estimate outside this preview if production exceeds it.",
  },
  inputs: [
    numberInput("costCents", "Asset cost (minor units)", 100001),
    numberInput("salvageCents", "Salvage value (minor units)", 1),
    numberInput("capacity", "Expected lifetime units", 10000, 1e9, 1),
    numberInput("priorUnits", "Units produced before this period", 0, 1e9),
    numberInput("units", "Units produced this period", 1000, 1e9),
  ],
  compute: (ctx, inputs) =>
    guardedPreview(() => {
      const cost = integer(inputs, "costCents", 100001),
        salvage = integer(inputs, "salvageCents", 1);
      const capacity = integer(inputs, "capacity", 10000, 1, 1e9),
        before = integer(inputs, "priorUnits", 0, 0, 1e9),
        units = integer(inputs, "units", 1000, 0, 1e9);
      if (salvage > cost) throw new Error("Salvage cannot exceed asset cost.");
      if (before + units > capacity)
        throw new Error(
          "Prior and current units exceed expected lifetime capacity.",
        );
      const basis = BigInt(cost - salvage),
        opening = roundRatio(basis * BigInt(before), BigInt(capacity)),
        closing = roundRatio(basis * BigInt(before + units), BigInt(capacity));
      return {
        metrics: [
          {
            label: "Period depreciation",
            value: formatCurrency(closing - opening, ctx.reportingCurrency),
          },
          {
            label: "Closing book value",
            value: formatCurrency(cost - closing, ctx.reportingCurrency),
          },
        ],
        charts: [],
        rows: [
          {
            units,
            openingDepreciationCents: opening,
            periodDepreciationCents: closing - opening,
            closingDepreciationCents: closing,
            closingBookValueCents: cost - closing,
          },
        ],
        insights: [
          "Cumulative rounding keeps a complete production schedule equal to cost less salvage. This preview never posts depreciation.",
        ],
      };
    }),
};
