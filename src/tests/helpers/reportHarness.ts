import "./dom";
import { cleanup } from "@testing-library/react";
import { useAuthStore } from "../../stores/useAuthStore";
import { useLedgerStore } from "../../stores/useLedgerStore";
import { setComponentWorkspace } from "./componentFixtures";

/** Finite API replies, stable empty cache arrays, and explicit ownership of test resources. */
export async function withReportHarness(
  reply: (url: URL) => Response | Promise<Response>,
  run: (requests: URL[]) => Promise<void>,
) {
  const auth = useAuthStore.getState(),
    ledger = useLedgerStore.getState();
  const fetch = globalThis.fetch;
  const requests: URL[] = [];
  try {
    setComponentWorkspace("owner");
    useLedgerStore.setState({
      accounts: [],
      transactions: [],
      journalEntries: [],
      isDataTruncated: false,
    });
    globalThis.fetch = async (input) => {
      const url = new URL(String(input), "http://localhost");
      if (!url.pathname.startsWith("/api/v1/reports/"))
        return new Response("{}", { status: 404 });
      requests.push(url);
      return reply(url);
    };
    await run(requests);
  } finally {
    cleanup();
    useAuthStore.setState(auth);
    useLedgerStore.setState(ledger);
    globalThis.fetch = fetch;
  }
}
