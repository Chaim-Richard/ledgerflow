import "./helpers/dom";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfitAndLossView from "../components/ledger/ProfitAndLossView";
import TrialBalanceView from "../components/ledger/TrialBalanceView";
import { formatCurrency } from "../lib/utils";
import { withReportHarness } from "./helpers/reportHarness";

test(
  "BUG-02: P&L success then next-period failure removes old figures and server badge",
  { timeout: 5000 },
  async () => {
    await withReportHarness(
      (url) =>
        url.searchParams.get("startDate") === "2026-05-01"
          ? Response.json({
              income: {
                total: 98765,
                accounts: {
                  sales: {
                    name: "May server sales",
                    code: "4000",
                    balance: 98765,
                  },
                },
              },
              cogs: { total: 0, accounts: {} },
              expense: { total: 0, accounts: {} },
              grossProfit: 98765,
              netIncome: 98765,
            })
          : new Response("{}", { status: 503 }),
      async (requests) => {
        const view = render(
          <ProfitAndLossView startDate="2026-05-01" endDate="2026-05-31" />,
        );
        await waitFor(() =>
          assert.ok(screen.queryAllByText("$987.65").length > 0),
        );
        // AUD-10: the server badge is now the provenance note
        assert.ok(screen.getByText(/Worked out by the server from every entry\./));
        view.rerender(
          <ProfitAndLossView startDate="2026-06-01" endDate="2026-06-30" />,
        );
        await waitFor(() => {
          assert.equal(screen.queryAllByText("$987.65").length, 0);
          assert.equal(
            screen.queryByText(/Worked out by the server/),
            null,
          );
        });
        assert.equal(
          requests.length,
          2,
          "one request per period; no fetch/render loop",
        );
        assert.equal(requests[1].searchParams.get("startDate"), "2026-06-01");
        assert.equal(requests[1].searchParams.get("endDate"), "2026-06-30");
        assert.ok(
          requests.every(
            (url) =>
              url.searchParams.get("workspaceId") === "component-workspace",
          ),
        );
      },
    );
  },
);

test(
  "BUG-02: trial balance success then next-date failure removes old figures and server badge",
  { timeout: 5000 },
  async (context) => {
    context.mock.timers.enable({
      apis: ["Date"],
      now: new Date("2026-05-31T12:00:00Z"),
    });
    await withReportHarness(
      (url) =>
        url.searchParams.get("asOfDate") === "2027-06-30"
          ? new Response("{}", { status: 503 })
          : Response.json({
              accounts: [
                {
                  id: "cash",
                  name: "Server cash",
                  type: "asset",
                  debit: 98765,
                  credit: 0,
                  netSigned: 98765,
                },
                {
                  id: "capital",
                  name: "Server capital",
                  type: "equity",
                  debit: 0,
                  credit: 98765,
                  netSigned: -98765,
                },
              ],
              totalDebit: 98765,
              totalCredit: 98765,
              isBalanced: true,
            }),
      async (requests) => {
        render(
          <TrialBalanceView
            accounts={[]}
            formatCurrency={formatCurrency}
            onDrillDown={() => {}}
          />,
        );
        await waitFor(() =>
          assert.ok(screen.queryAllByText("$987.65").length > 0),
        );
        // AUD-10: the server badge is now the provenance note
        assert.ok(screen.getByText(/Worked out by the server from every entry\./));
        fireEvent.change(screen.getByLabelText("As of date"), {
          target: { value: "2027-06-30" },
        });
        await waitFor(() => {
          assert.equal(screen.queryAllByText("$987.65").length, 0);
          assert.equal(
            screen.queryByText(/Worked out by the server/),
            null,
          );
        });
        assert.equal(
          requests.length,
          2,
          "one request per date; no fetch/render loop",
        );
        assert.equal(requests[1].searchParams.get("asOfDate"), "2027-06-30");
        assert.ok(
          requests.every(
            (url) =>
              url.searchParams.get("workspaceId") === "component-workspace",
          ),
        );
      },
    );
  },
);
