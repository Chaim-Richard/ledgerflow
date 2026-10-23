/**
 * AUD-10: every statement screen that can fall back says where its figures come from, in words
 * (ReportProvenanceNote): Complete (server, or every loaded entry here), Cached at HH:MM (the
 * server's 60-second cache), Capped at 20,000 entries (the browser's ledger cap reached, newest
 * first), Partial (a collection failed to load). The figures themselves do not change.
 */
import "./helpers/dom";
import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfitAndLossView from "../components/ledger/ProfitAndLossView";
import BalanceSheetView from "../components/ledger/BalanceSheetView";
import TrialBalanceView from "../components/ledger/TrialBalanceView";
import CashFlowView from "../components/ledger/CashFlowView";
import { StatementColumns } from "../components/ledger/StatementColumns";
import { useLedgerStore } from "../stores/useLedgerStore";
import { useDataNeedsStore } from "../stores/useDataNeedsStore";
import { formatCurrency } from "../lib/utils";
import { clockTime } from "../lib/reportProvenance";
import { computeBalanceSheet, computeCashFlow, computeProfitAndLoss, computeTrialBalance } from "../server/reports/computeReports";
import { makeChartAccount, makeTransaction } from "./fixtures";
import { withReportHarness } from "./helpers/reportHarness";

const chart = [
  makeChartAccount({ id: "cash", code: "1000", name: "Cash", type: "asset", category: "Cash" }),
  makeChartAccount({ id: "sales", code: "4000", name: "Sales", type: "income", category: "Revenue" }),
];
// one sale of $1,000.00 on 5 May 2026
const ledger = [makeTransaction({ id: "t1", date: "2026-05-05", status: "completed", lines: [{ accountId: "cash", amountCents: 100000 }, { accountId: "sales", amountCents: -100000 }] } as never)];
const CACHED_AT = "2026-05-20T11:02:00.000Z";

type Kind = "pl" | "bs" | "tb" | "cf";
const SCREENS: Record<Kind, { title: string; path: string; body: () => object; render: () => React.ReactElement }> = {
  pl: { title: "Profit and loss", path: "profit-and-loss", body: () => computeProfitAndLoss(chart, ledger, "2026-05-01", "2026-05-31"),
    render: () => <ProfitAndLossView startDate="2026-05-01" endDate="2026-05-31" /> },
  bs: { title: "Balance sheet", path: "balance-sheet", body: () => computeBalanceSheet(chart, ledger, "2026-05-31"),
    render: () => <BalanceSheetView accounts={chart} formatCurrency={formatCurrency} asOfDate="2026-05-31" /> },
  tb: { title: "Trial balance", path: "trial-balance", body: () => computeTrialBalance(chart, ledger),
    render: () => <TrialBalanceView accounts={chart} formatCurrency={formatCurrency} onDrillDown={() => {}} /> },
  cf: { title: "Cash flow", path: "cash-flow", body: () => computeCashFlow(chart, ledger, "2026-05-01", "2026-05-31"),
    render: () => <CashFlowView startDate="2026-05-01" endDate="2026-05-31" /> },
};

const note = () => screen.getByRole("note", { name: "Where these figures come from" });
const noteText = () => (note().textContent || "").replace(/\s+/g, " ").trim();

async function show(kind: Kind, reply: (url: URL) => Response, setup: () => void = () => {}) {
  let seen = "";
  await withReportHarness(reply, async (requests) => {
    useLedgerStore.setState({ accounts: chart, transactions: ledger, truncatedCollections: {} });
    setup();
    render(SCREENS[kind].render());
    await waitFor(() => assert.ok(requests.some(u => u.pathname.endsWith(SCREENS[kind].path))));
    await waitFor(() => assert.ok(screen.queryByRole("note", { name: "Where these figures come from" })));
    // let the server answer settle into the note
    await waitFor(() => { seen = noteText(); assert.ok(seen.length > 0); });
    await new Promise(r => setTimeout(r, 20));
    seen = noteText();
  });
  return seen;
}

const fresh = (kind: Kind) => () => Response.json(SCREENS[kind].body());
const cached = (kind: Kind) => () => Response.json({ ...SCREENS[kind].body(), provenance: { source: "server", completeness: "complete", cachedAt: CACHED_AT } });
const down = () => new Response("{}", { status: 503 });

describe("AUD-10: statement screens say where their figures come from", () => {
  afterEach(() => {
    cleanup();
    useDataNeedsStore.setState({ failed: {} });
    useLedgerStore.setState({ truncatedCollections: {}, isDataTruncated: false });
  });

  for (const kind of Object.keys(SCREENS) as Kind[]) {
    const { title } = SCREENS[kind];

    test(`${title}: a fresh server answer is "Complete" from every entry`, async () => {
      assert.equal(await show(kind, fresh(kind)), "Complete — Worked out by the server from every entry.Refresh");
    });

    test(`${title}: a cached server answer says when it was worked out`, async () => {
      const at = clockTime(CACHED_AT);
      assert.equal(await show(kind, cached(kind)), `Cached at ${at} — Worked out by the server from every entry at ${at}; changes made since then show after a refresh.Refresh`);
    });

    test(`${title}: the server down, every entry loaded: worked out here, complete, and says the server failed`, async () => {
      assert.equal(await show(kind, down),
        "Complete — Worked out in this browser from every loaded entry. The server report could not be loaded.Load the full server report");
    });

    test(`${title}: the server down and the ledger capped at 20,000 entries: "Capped at 20,000 entries"`, async () => {
      const text = await show(kind, down, () => useLedgerStore.getState().setCollectionTruncated("transactions", true));
      assert.equal(text, "Capped at 20,000 entries — Worked out in this browser from the newest 20,000 entries only; older ones are not loaded, so the figures may be incomplete. The server report could not be loaded.Load the full server report");
    });
  }

  test("Profit and loss: the ledger failed to load and the server is down: \"Partial\"", async () => {
    const text = await show("pl", down, () => useDataNeedsStore.setState({ failed: { transactions: "network" } }));
    assert.match(text, /^Partial — Worked out in this browser, but not everything could be loaded, so the figures may be incomplete\. The server report could not be loaded\./);
  });

  test("Trial balance: capped journal entries (5,000) are named too", async () => {
    const text = await show("tb", down, () => useLedgerStore.getState().setCollectionTruncated("journalEntries", true));
    assert.match(text, /^Capped at 5,000 journal entries — /);
  });

  test("Profit and loss: the capped figures are the loaded entries' own ($1,000.00), not changed by the note", async () => {
    await withReportHarness(down, async () => {
      useLedgerStore.setState({ accounts: chart, transactions: ledger, truncatedCollections: {} });
      useLedgerStore.getState().setCollectionTruncated("transactions", true);
      render(SCREENS.pl.render());
      await waitFor(() => assert.match(noteText(), /^Capped at 20,000 entries/));
      assert.ok(screen.getAllByText("$1,000.00").length > 0);
    });
  });

  test("Profit and loss: the cap note offers the server report, which turns it into \"Complete\"", async () => {
    let up = false;
    await withReportHarness(() => (up ? fresh("pl")() : down()), async () => {
      useLedgerStore.setState({ accounts: chart, transactions: ledger, truncatedCollections: {} });
      useLedgerStore.getState().setCollectionTruncated("transactions", true);
      render(SCREENS.pl.render());
      await waitFor(() => assert.match(noteText(), /could not be loaded/));
      up = true;
      fireEvent.click(screen.getByRole("button", { name: "Load the full server report" }));
      await waitFor(() => assert.equal(noteText(), "Complete — Worked out by the server from every entry.Refresh"));
    });
  });
});

describe("AUD-10: period columns say where their figures come from", () => {
  afterEach(() => {
    cleanup();
    useLedgerStore.setState({ truncatedCollections: {}, isDataTruncated: false });
  });

  function Columns() {
    const [mode, setMode] = React.useState<"total" | "months" | "quarters">("total");
    return <StatementColumns kind="pl" title="Statement" accounts={chart} transactions={ledger} startDate="2026-04-01" endDate="2026-05-31"
      compareStartDate="2025-04-01" compareEndDate="2025-05-31" compare={false} mode={mode} onModeChange={setMode} showPercent={false}
      onPercentChange={() => {}} totalData={computeProfitAndLoss(chart, ledger, "2026-04-01", "2026-05-31")} previousTotalData={computeProfitAndLoss(chart, [], "2025-04-01", "2025-05-31")} totalAuthoritative={false}
      formatMoney={(v) => (v / 100).toFixed(2)} onSort={() => {}} onDrillDown={() => {}} />;
  }

  async function columns(reply: (url: URL) => Response, setup: () => void = () => {}) {
    let text = "";
    await withReportHarness(reply, async (requests) => {
      setup();
      render(<Columns />);
      fireEvent.change(screen.getByLabelText("Columns:"), { target: { value: "months" } });
      await waitFor(() => assert.equal(requests.length, 2));
      await waitFor(() => { text = noteText(); assert.doesNotMatch(text, /^$/); });
      await new Promise(r => setTimeout(r, 20));
      text = noteText();
    });
    return text;
  }

  test("every month from the server, one cached: the oldest cache time is shown", async () => {
    const text = await columns((url) => Response.json({
      ...computeProfitAndLoss(chart, ledger, url.searchParams.get("startDate")!, url.searchParams.get("endDate")!),
      provenance: url.searchParams.get("startDate") === "2026-04-01" ? { source: "server", completeness: "complete", cachedAt: CACHED_AT } : { source: "server", completeness: "complete" },
    }));
    assert.match(text, new RegExp(`^Cached at ${clockTime(CACHED_AT)} — `));
  });

  test("every month fresh from the server: Complete", async () => {
    assert.equal(await columns((url) => Response.json(computeProfitAndLoss(chart, ledger, url.searchParams.get("startDate")!, url.searchParams.get("endDate")!))),
      "Complete — Worked out by the server from every entry.");
  });

  test("the server down and the ledger capped: Capped at 20,000 entries, and the server failure", async () => {
    const text = await columns(down, () => useLedgerStore.getState().setCollectionTruncated("transactions", true));
    assert.match(text, /^Capped at 20,000 entries — .*The server report could not be loaded\.$/);
  });
});
