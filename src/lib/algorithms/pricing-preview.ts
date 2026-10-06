import type { AlgorithmDefinition } from "./types";
import { formatCurrency } from "../utils";
import { guardedPreview, integer, numberInput, safeMinor } from "./previewMath";
export const PRICING_PREVIEW: AlgorithmDefinition = {
  id: "tiered-pricing-preview",
  name: "Tiered and Volume Pricing",
  domain: "operations",
  requires: [],
  tags: ["Pricing", "Sales"],
  description:
    "Compare graduated tier charges with a volume price applied to every unit. Three typed tiers use whole units and integer minor-unit prices; taxes and discounts are excluded.",
  help: {
    scope:
      "Typed quantity, two cumulative tier limits and three prices; no item or invoice is changed.",
    method:
      "Graduated pricing charges each band separately. Volume pricing selects the band containing the total quantity and applies its price to every unit. Limits are inclusive.",
    example:
      "At quantity 15, first 10 units at 100 and later units at 80: graduated total is 1,400 minor units, while volume total is 1,200.",
    limits:
      "Whole quantities, three bands and pre-tax prices only. Changing the selected method changes this preview, not a customer contract or saved invoice.",
  },
  inputs: [
    numberInput("quantity", "Quantity (whole units)", 15, 1e9),
    numberInput("limit1", "First tier ends at quantity", 10, 1e9, 1),
    numberInput("limit2", "Second tier ends at quantity", 100, 1e9, 2),
    numberInput("price1", "First tier unit price (minor units)", 100),
    numberInput("price2", "Second tier unit price (minor units)", 80),
    numberInput("price3", "Third tier unit price (minor units)", 60),
    {
      kind: "select",
      key: "method",
      label: "Pricing method",
      defaultValue: "graduated",
      options: [
        { value: "graduated", label: "Graduated tiers" },
        { value: "volume", label: "Volume price" },
      ],
    },
  ],
  compute: (ctx, inputs) =>
    guardedPreview(() => {
      const quantity = integer(inputs, "quantity", 15, 0, 1e9),
        limit1 = integer(inputs, "limit1", 10, 1, 1e9),
        limit2 = integer(inputs, "limit2", 100, 2, 1e9),
        prices = [
          integer(inputs, "price1", 100),
          integer(inputs, "price2", 80),
          integer(inputs, "price3", 60),
        ];
      if (limit2 <= limit1)
        throw new Error("The second tier limit must exceed the first.");
      const quantities = [
        Math.min(quantity, limit1),
        Math.min(Math.max(0, quantity - limit1), limit2 - limit1),
        Math.max(0, quantity - limit2),
      ];
      const graduated = safeMinor(
          quantities.reduce(
            (sum, units, index) => sum + BigInt(units) * BigInt(prices[index]),
            0n,
          ),
        ),
        selected = quantity <= limit1 ? 0 : quantity <= limit2 ? 1 : 2,
        volume = safeMinor(BigInt(quantity) * BigInt(prices[selected]));
      const method = inputs.method ?? "graduated";
      if (method !== "graduated" && method !== "volume")
        throw new Error("Choose graduated or volume pricing.");
      const rows = quantities.map((units, index) => ({
        tier: index + 1,
        units,
        unitPriceCents: prices[index],
        graduatedChargeCents: safeMinor(BigInt(units) * BigInt(prices[index])),
      }));
      return {
        metrics: [
          {
            label: "Selected method total",
            value: formatCurrency(
              method === "volume" ? volume : graduated,
              ctx.reportingCurrency,
            ),
          },
          {
            label: "Graduated total",
            value: formatCurrency(graduated, ctx.reportingCurrency),
          },
          {
            label: "Volume total",
            value: formatCurrency(volume, ctx.reportingCurrency),
          },
        ],
        charts: [],
        rows,
        insights: [
          `Volume pricing uses tier ${selected + 1} for all ${quantity} units. Table rows show graduated bands. No invoice, price list or tax is changed.`,
        ],
      };
    }),
};
