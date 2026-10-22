import "./helpers/dom";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, cleanup, screen } from "@testing-library/react";
import {
  REPORT_TOTAL_EXPLANATIONS,
  explanationById,
  explanationsForReport,
} from "../lib/reportTotalExplanations";
import ReportTotalExplainer from "../components/reporting/ReportTotalExplainer";
import { REPORT_TABS_REGISTRY } from "../config/registry";
import { useUIStore } from "../stores/useUIStore";

const ui = useUIStore.getState();
afterEach(() => {
  cleanup();
  useUIStore.setState(ui, true);
});

const HEBREW = /[\u05d0-\u05ea]/;

test("A-202: ten totals, each explained in English and Hebrew, each on a registered report", () => {
  assert.equal(REPORT_TOTAL_EXPLANATIONS.length, 10);
  const reportIds = new Set(REPORT_TABS_REGISTRY.map((entry) => entry.id));
  const ids = new Set<string>();
  for (const entry of REPORT_TOTAL_EXPLANATIONS) {
    assert.ok(!ids.has(entry.id), `duplicate explanation id ${entry.id}`);
    ids.add(entry.id);
    assert.ok(
      reportIds.has(entry.reportId),
      `${entry.id} points at ${entry.reportId}, which is not a registered report`,
    );
    for (const field of ["total", "what", "includes", "leavesOut", "notProves"] as const) {
      const value = entry[field];
      const minLength = field === "total" ? 3 : 20;
      assert.ok(value.en.trim().length >= minLength, `${entry.id}.${field}.en is too short`);
      assert.ok(value.he.trim().length >= minLength, `${entry.id}.${field}.he is too short`);
      assert.match(value.he, HEBREW, `${entry.id}.${field}.he is not Hebrew`);
      assert.notEqual(value.en, value.he, `${entry.id}.${field} was not translated`);
    }
  }
  // the ten totals cover the main statements, not ten names for one figure
  const covered = new Set(REPORT_TOTAL_EXPLANATIONS.map((entry) => entry.reportId));
  for (const reportId of ["pnl", "balance-sheet", "cash-flow", "ar-aging", "ap-aging", "inventory-valuation", "tax-liability", "financial-ratios"]) {
    assert.ok(covered.has(reportId), `${reportId} has no explained total`);
  }
});

test("A-202: the panel lists the active report's totals only, and closes on reports without one", () => {
  render(<ReportTotalExplainer reportId="pnl" />);
  assert.ok(screen.getByText("What does this number mean?"));
  assert.ok(screen.getByText("Net profit"));
  assert.ok(screen.getByText("Gross profit"));
  assert.equal(screen.queryByText("Total assets"), null);
  assert.equal(screen.queryByText("Current ratio"), null);
  const details = screen.getByText("What does this number mean?").closest("details");
  assert.ok(details, "the explanation is a disclosure, not always-open text");
  assert.ok(details?.hasAttribute("data-print-hide"));
  cleanup();

  const { container } = render(<ReportTotalExplainer reportId="sample-year-benchmark" />);
  assert.equal(container.textContent, "");
});

test("A-202: the panel follows the workspace language", () => {
  useUIStore.setState({ language: "he" });
  render(<ReportTotalExplainer reportId="balance-sheet" />);
  assert.ok(screen.getByText("מה המשמעות של המספר הזה?"));
  assert.ok(screen.getByText("סך הנכסים"));
  assert.ok(screen.getAllByText(/מה זה לא מוכיח/).length >= 1);
  assert.equal(screen.queryByText("Total assets"), null);
});

test("A-202: each explanation is reachable by id and the lookups agree", () => {
  for (const entry of REPORT_TOTAL_EXPLANATIONS) {
    assert.equal(explanationById(entry.id), entry);
    assert.ok(explanationsForReport(entry.reportId).includes(entry));
  }
  assert.equal(explanationById("no-such-total"), undefined);
  assert.deepEqual(explanationsForReport("no-such-report"), []);
});
