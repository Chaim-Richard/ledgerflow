import type { AlgorithmDefinition, AlgoResultRow } from "./types";
import { validCustomReportPeriod } from "../reportCustomPeriod";
import { isOpeningBalanceDocument } from "../partyOpeningBalance";
import { guardedPreview, integer, numberInput } from "./previewMath";
const MONTH_INDEX = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
export const CUSTOMER_COHORTS: AlgorithmDefinition = {
  id: "customer-cohorts-preview",
  name: "Customer Invoice Cohorts",
  domain: "operations",
  requires: ["invoices"],
  tags: ["Customers", "Retention", "Cohorts"],
  description:
    "Group customers by the month of their first observed issued invoice, then measure monthly repeat-invoice activity. Identity comes from customer IDs, preserving Hebrew and mixed-script labels.",
  help: {
    scope:
      "Supplied invoice history through the context as-of date. Draft, void, cancelled, rejected, deleted and opening-balance documents are excluded. No payment or revenue amounts are calculated.",
    method:
      "Each customer belongs to the earliest observed invoice month. For each later age month, count distinct cohort members invoiced in that month and divide by the original cohort size. Repeat invoices in one month count once.",
    example:
      "Two customers first invoiced in January; one is invoiced again in February: January cohort activity is 100% at month 0 and 50% at month 1.",
    limits:
      "First observed is not necessarily first ever if history is incomplete. Current-month observations may be partial, and future months are blank rather than zero. Invoice activity is not payment retention or subscription churn.",
  },
  inputs: [
    numberInput("months", "Months after first invoice to show", 12, 24, 1),
  ],
  compute: (ctx, inputs) =>
    guardedPreview(() => {
      const months = integer(inputs, "months", 12, 1, 24);
      if (
        !validCustomReportPeriod({
          startDate: ctx.asOfDate,
          endDate: ctx.asOfDate,
        })
      )
        throw new Error("Choose a valid as-of date.");
      const activity = new Map<
        string,
        { first: string; months: Set<number> }
      >();
      let ignored = 0;
      for (const invoice of ctx.entities?.invoices || []) {
        if (
          invoice.deletedAt ||
          ["draft", "void", "cancelled", "rejected"].includes(invoice.status) ||
          isOpeningBalanceDocument(invoice)
        )
          continue;
        const date = invoice.date?.slice(0, 10) || "";
        if (
          !invoice.customerId ||
          !validCustomReportPeriod({ startDate: date, endDate: date })
        ) {
          ignored++;
          continue;
        }
        if (date > ctx.asOfDate) continue;
        const month = date.slice(0, 7),
          customer = activity.get(invoice.customerId) || {
            first: month,
            months: new Set<number>(),
          };
        if (month < customer.first) customer.first = month;
        customer.months.add(MONTH_INDEX(date));
        activity.set(invoice.customerId, customer);
      }
      const cohorts = new Map<string, string[]>();
      for (const [id, customer] of activity)
        cohorts.set(customer.first, [
          ...(cohorts.get(customer.first) || []),
          id,
        ]);
      const rows: AlgoResultRow[] = [...cohorts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, ids]) => {
          const row: AlgoResultRow = { cohort: month, customers: ids.length };
          for (let age = 0; age <= months; age++) {
            const index = MONTH_INDEX(month) + age,
              observed = index <= MONTH_INDEX(ctx.asOfDate),
              count = ids.filter((id) =>
                activity.get(id)?.months.has(index),
              ).length;
            row[`Month ${age} active`] = observed ? count : null;
            row[`Month ${age} (%)`] = observed
              ? Math.round((count * 10000) / ids.length) / 100
              : null;
          }
          return row;
        });
      return {
        metrics: [
          { label: "Observed customers", value: activity.size },
          { label: "First-invoice cohorts", value: cohorts.size },
        ],
        charts: [],
        rows,
        insights: [
          `${ignored} issued invoices lack a usable date or customer ID and were excluded. First observed may differ from first ever when history is incomplete.`,
          "Blank cells are future months; the current month can be partial. This measures distinct-customer invoice activity, not collections or revenue.",
        ],
      };
    }),
};
