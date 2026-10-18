import test from "node:test";
import assert from "node:assert/strict";
import React from "react";

test("notices follow the book, guest session, dismissal and real backup-completion event", async () => {
  await import("./helpers/dom");
  const { render, screen, fireEvent, cleanup, act } =
    await import("@testing-library/react");
  const { default: LedgerBackupReminder } =
    await import("../components/platform/LedgerBackupReminder");
  const { useAuthStore } = await import("../stores/useAuthStore");
  const { setComponentWorkspace } = await import("./helpers/componentFixtures");
  const { recordBackupCompleted } = await import("../lib/ledgerBackupHealth");
  const previous = useAuthStore.getState();
  const previousCustomEvent = globalThis.CustomEvent;
  // Node's native CustomEvent belongs to another realm; use the browser constructor for its real event helper.
  globalThis.CustomEvent = window.CustomEvent;
  const keys = ["component-workspace", "notice-second", "notice-third"];
  try {
    for (const key of keys)
      localStorage.removeItem(`ledgerflow:last_backup:${key}`);
    setComponentWorkspace("owner");
    const signedInUser = useAuthStore.getState().user;
    const { container } = render(<LedgerBackupReminder />);
    assert.equal(
      screen.getByTestId("compact-ledger-notices").textContent,
      "Backup due",
    );
    await act(async () => useAuthStore.setState({ user: null, isGuest: true }));
    assert.equal(
      screen.getByTestId("compact-ledger-notices").textContent,
      "Demo data · Backup due",
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notices" }));
    assert.equal(container.textContent, "");
    await act(async () =>
      useAuthStore.setState({ currentWorkspaceId: "notice-second" }),
    );
    assert.equal(
      screen.getByTestId("compact-ledger-notices").textContent,
      "Demo data · Backup due",
    );
    await act(async () => recordBackupCompleted("notice-second"));
    assert.equal(
      screen.getByTestId("compact-ledger-notices").textContent,
      "Demo data",
    );
    assert.equal(screen.queryByRole("button", { name: "Export backup" }), null);
    await act(async () =>
      useAuthStore.setState({ user: signedInUser, isGuest: false }),
    );
    assert.equal(
      container.textContent,
      "",
      "fresh signed-in books need no notice",
    );
    await act(async () =>
      useAuthStore.setState({ currentWorkspaceId: "notice-third" }),
    );
    assert.equal(
      screen.getByTestId("compact-ledger-notices").textContent,
      "Backup due",
    );
  } finally {
    cleanup();
    useAuthStore.setState(previous);
    globalThis.CustomEvent = previousCustomEvent;
    for (const key of keys)
      localStorage.removeItem(`ledgerflow:last_backup:${key}`);
  }
});
