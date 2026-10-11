import { stubFetch } from "./helpers/dom";
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { StatementColumns } from "../components/ledger/StatementColumns";
import { useAuthStore } from "../stores/useAuthStore";
import { useLedgerStore } from "../stores/useLedgerStore";
import {
  computeProfitAndLoss,
  computeBalanceSheet,
} from "../server/reports/computeReports";
import { makeChartAccount, makeTransaction } from "./fixtures";
import type { ReportColumnMode, StatementKind } from "../lib/reportColumns";

const accounts = [
  makeChartAccount({ code: "", id: "cash", name: "Cash" }),
  makeChartAccount({
    code: "",
    id: "income",
    name: "מכירות Sales",
    type: "income",
    category: "Revenue",
  }),
  makeChartAccount({
    code: "",
    id: "rent",
    name: "Rent",
    type: "expense",
    category: "Expenses",
  }),
];
const transactions = [
  makeTransaction({
    date: "2024-02-29",
    lines: [
      { accountId: "cash", amountCents: 1500 },
      { accountId: "rent", amountCents: 500 },
      { accountId: "income", amountCents: -2000 },
    ],
  }),
];
function Harness({
  kind = "pl",
  startDate = "2024-02-01",
  endDate = "2024-03-31",
  compare = true,
  drill = () => {},
}: {
  kind?: StatementKind;
  startDate?: string;
  endDate?: string;
  compare?: boolean;
  drill?: (name: string, entries: typeof transactions) => void;
}) {
  const [mode, setMode] = useState<ReportColumnMode>("total");
  const [percent, setPercent] = useState(false);
  const total =
    kind === "pl"
      ? computeProfitAndLoss(accounts, transactions, startDate, endDate)
      : computeBalanceSheet(accounts, transactions, endDate);
  const previous =
    kind === "pl"
      ? computeProfitAndLoss(accounts, [], "2023-02-01", "2023-03-31")
      : computeBalanceSheet(accounts, [], "2023-03-31");
  return (
    <StatementColumns
      kind={kind}
      title="Statement"
      accounts={accounts}
      transactions={transactions}
      startDate={startDate}
      endDate={endDate}
      compareStartDate="2023-02-01"
      compareEndDate="2023-03-31"
      compare={compare}
      mode={mode}
      onModeChange={setMode}
      showPercent={percent}
      onPercentChange={setPercent}
      totalData={total}
      previousTotalData={previous}
      totalAuthoritative={false}
      formatMoney={(value) => (value / 100).toFixed(2)}
      onSort={() => {}}
      onDrillDown={drill}
    />
  );
}
beforeEach(() => {
  stubFetch(404);
  useAuthStore.setState({
    user: null,
    currentWorkspaceId: null,
    workspaces: [],
  });
  useLedgerStore.setState({ isDataTruncated: false });
});
afterEach(cleanup);

test("controls display monthly amounts, income percentages, zero-base variance and period drill-down", () => {
  const opened: (typeof transactions)[] = [];
  const view = render(
    <Harness drill={(_name, entries) => opened.push(entries)} />,
  );
  fireEvent.change(view.getByLabelText("Columns:"), {
    target: { value: "months" },
  });
  fireEvent.click(view.getByLabelText("% of total"));
  assert.ok(view.getByRole("columnheader", { name: /Feb 2024/ }));
  assert.ok(view.getByRole("columnheader", { name: /Mar 2024/ }));
  const row = view
    .getAllByRole("row")
    .find((item) => item.textContent?.includes("Rent"))!;
  assert.deepEqual(
    within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
    [
      "",
      "5.00",
      "25.0%",
      "0.00",
      "5.00",
      "—",
      "0.00",
      "—",
      "0.00",
      "0.00",
      "—",
    ],
  );
  fireEvent.click(
    within(row).getAllByRole("button", { name: /Rent, .*open ledger/ })[0],
  );
  fireEvent.click(
    within(row).getAllByRole("button", { name: /Rent, .*open ledger/ })[1],
  );
  assert.deepEqual(opened, [transactions, []]);
});

test("balance sheet months are closing snapshots; percentages use total assets", () => {
  const view = render(<Harness kind="bs" compare={false} />);
  fireEvent.change(view.getByLabelText("Columns:"), {
    target: { value: "months" },
  });
  fireEvent.click(view.getByLabelText("% of total"));
  const row = view
    .getAllByRole("row")
    .find((item) => item.textContent?.startsWith("Cash"))!;
  assert.deepEqual(
    within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
    ["", "15.00", "100.0%", "15.00", "100.0%"],
  );
  assert.ok(view.getByText(/Closing balances at each period end/));
});

test("failed full-history requests keep truncated exports disabled and show the limitation", async () => {
  const urls = stubFetch(200, {});
  useAuthStore.setState({ currentWorkspaceId: "workspace-one" });
  useLedgerStore.setState({ isDataTruncated: true });
  const view = render(<Harness />);
  fireEvent.change(view.getByLabelText("Columns:"), {
    target: { value: "months" },
  });
  await waitFor(() =>
    assert.ok(view.getByText(/Some server reports|may be incomplete/)),
  );
  await waitFor(() => assert.equal(urls.length, 4));
  assert.equal(
    (
      view.getByRole("button", {
        name: "Export columns CSV",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  assert.deepEqual(
    urls
      .map((url) =>
        new URL(url, "http://localhost").searchParams.get("endDate"),
      )
      .sort(),
    ["2023-02-28", "2023-03-31", "2024-02-29", "2024-03-31"],
  );
});

test("full server figures enable truncated exports and stale workspace responses cannot replace them", async () => {
  const pending: { url: string; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = (input) =>
    new Promise<Response>((resolve) =>
      pending.push({ url: String(input), resolve }),
    );
  useAuthStore.setState({ currentWorkspaceId: "old-workspace" });
  useLedgerStore.setState({ isDataTruncated: true });
  const view = render(<Harness compare={false} />);
  fireEvent.change(view.getByLabelText("Columns:"), {
    target: { value: "months" },
  });
  await waitFor(() => assert.equal(pending.length, 2));
  act(() => useAuthStore.setState({ currentWorkspaceId: "new-workspace" }));
  await waitFor(() => assert.equal(pending.length, 4));
  const answer = (amount: number) =>
    new Response(
      JSON.stringify({
        data: computeProfitAndLoss(
          accounts,
          [
            makeTransaction({
              date: "2024-02-29",
              lines: [
                { accountId: "cash", amountCents: amount },
                { accountId: "income", amountCents: -amount },
              ],
            }),
          ],
          "2024-02-01",
          "2024-02-29",
        ),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  await act(async () => {
    pending.slice(2).forEach((request) => request.resolve(answer(9000)));
  });
  await waitFor(() =>
    assert.equal(
      (
        view.getByRole("button", {
          name: "Export columns CSV",
        }) as HTMLButtonElement
      ).disabled,
      false,
    ),
  );
  const amounts = () =>
    within(
      view
        .getAllByRole("row")
        .find((row) => row.textContent?.startsWith("מכירות Sales"))!,
    )
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
  assert.deepEqual(amounts(), ["", "90.00", "90.00"]);
  await act(async () => {
    pending.slice(0, 2).forEach((request) => request.resolve(answer(1000)));
  });
  assert.deepEqual(amounts(), ["", "90.00", "90.00"]);
  assert.ok(
    pending
      .slice(2)
      .every((request) => request.url.includes("workspaceId=new-workspace")),
  );
});

test("balance sheet full-history requests contain only closing dates and comparisons", async () => {
  const urls = stubFetch(
    200,
    computeBalanceSheet(accounts, transactions, "2024-03-31"),
  );
  useAuthStore.setState({ currentWorkspaceId: "workspace-one" });
  const view = render(<Harness kind="bs" />);
  fireEvent.change(view.getByLabelText("Columns:"), {
    target: { value: "months" },
  });
  await waitFor(() =>
    assert.equal(
      (
        view.getByRole("button", {
          name: "Export columns CSV",
        }) as HTMLButtonElement
      ).disabled,
      false,
    ),
  );
  assert.equal(urls.length, 4);
  assert.ok(
    urls.every(
      (url) => url.includes("/balance-sheet?") && !url.includes("startDate"),
    ),
  );
});

test("period choices move headings and totals together, persist, and refuse hiding the final period", () => {
  localStorage.clear();
  for (const kind of ['pl', 'bs'] as const) {
    let view = render(<Harness kind={kind} compare={false} />);
    fireEvent.change(view.getByLabelText('Columns:'), { target: { value: 'months' } });
    fireEvent.click(view.getByRole('button', { name: 'Move Mar 2024 earlier' }));
    const headings = () => Array.from(view.container.querySelectorAll('th[scope="colgroup"]')).map(cell => cell.textContent);
    assert.ok(headings()[0]?.startsWith('Mar 2024'));
    fireEvent.click(view.getByRole('checkbox', { name: 'Feb 2024' }));
    assert.equal(headings().length, 1);
    assert.equal((view.getByRole('checkbox', { name: 'Mar 2024' }) as HTMLInputElement).disabled, true);
    view.unmount();
    view = render(<Harness kind={kind} compare={false} />);
    fireEvent.change(view.getByLabelText('Columns:'), { target: { value: 'months' } });
    assert.equal(headings().length, 1);
    assert.ok(headings()[0]?.startsWith('Mar 2024'));
    fireEvent.click(view.getByRole('button', { name: 'Reset period columns' }));
    assert.ok(headings()[0]?.startsWith('Feb 2024'));
    view.unmount();
  }
  localStorage.clear();
});
