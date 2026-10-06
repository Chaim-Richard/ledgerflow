import type { AlgorithmDefinition } from "./types";
import { formatCurrency } from "../utils";
import { guardedPreview, integer, numberInput, safeMinor } from "./previewMath";
export const STANDARD_COST_VARIANCE: AlgorithmDefinition = {
  id: "standard-cost-variance-preview",
  name: "Standard Cost Variance",
  domain: "operations",
  requires: [],
  tags: ["Costs", "Variance"],
  description:
    "Split actual versus allowed standard material cost into price and quantity variance. Positive amounts are unfavorable; negative amounts are favorable. No inventory value or journal is changed.",
  help: {
    scope:
      "Typed actual quantity, allowed standard quantity and actual/standard unit prices in minor units.",
    method:
      "Price variance = actual quantity × (actual price − standard price). Quantity variance = standard price × (actual quantity − allowed standard quantity). Their sum equals actual cost less allowed standard cost.",
    example:
      "Actual 12 units at 110 and allowed 10 at 100: price variance is +120, quantity variance +200 and total +320 minor units.",
    limits:
      "Whole material quantities only. Standard quantity must already reflect actual output; yield, labor, overhead and purchase-versus-consumption timing are outside this preview.",
  },
  inputs: [
    numberInput("actualUnits", "Actual quantity (whole units)", 12, 1e9),
    numberInput(
      "standardUnits",
      "Allowed standard quantity (whole units)",
      10,
      1e9,
    ),
    numberInput("actualPriceCents", "Actual unit price (minor units)", 110),
    numberInput("standardPriceCents", "Standard unit price (minor units)", 100),
  ],
  compute: (ctx, inputs) =>
    guardedPreview(() => {
      const aq = BigInt(integer(inputs, "actualUnits", 12, 0, 1e9)),
        sq = BigInt(integer(inputs, "standardUnits", 10, 0, 1e9)),
        ap = BigInt(integer(inputs, "actualPriceCents", 110)),
        sp = BigInt(integer(inputs, "standardPriceCents", 100));
      const actual = safeMinor(aq * ap),
        standard = safeMinor(sq * sp),
        price = safeMinor(aq * (ap - sp)),
        quantity = safeMinor(sp * (aq - sq)),
        total = safeMinor(aq * ap - sq * sp);
      const rows = [
        { component: "Price", varianceCents: price },
        { component: "Quantity", varianceCents: quantity },
        { component: "Total", varianceCents: total },
      ].map((row) => ({
        ...row,
        interpretation:
          row.varianceCents > 0
            ? "Unfavorable"
            : row.varianceCents < 0
              ? "Favorable"
              : "On standard",
      }));
      return {
        metrics: [
          {
            label: "Actual cost",
            value: formatCurrency(actual, ctx.reportingCurrency),
          },
          {
            label: "Allowed standard cost",
            value: formatCurrency(standard, ctx.reportingCurrency),
          },
          {
            label: "Total variance",
            value: formatCurrency(total, ctx.reportingCurrency),
          },
        ],
        charts: [],
        rows,
        insights: [
          "Price plus quantity variance equals total variance exactly. Standards and actual costs are scenario inputs, not saved stock valuations.",
        ],
      };
    }),
};
