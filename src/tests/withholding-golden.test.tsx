/** D-33: independently worked agorot; no production helper builds expected values. */
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { withheldCents, withholdingOn } from "../lib/tax/withholding";
import WithholdingField, {
  type Withholding,
} from "../components/purchases/WithholdingField";

const vendor = {
  metadata: {
    withholding: { ratePercent: 5, number: "GOLD-5", expires: "2026-12-31" },
  },
};

for (const row of [
  {
    name: "full VAT bill: 10000 net at 5%",
    paid: 11800,
    vat: 1800,
    rate: 5,
    expected: 500,
  },
  {
    name: "half payment: 5000 net at 5%",
    paid: 5900,
    vat: 900,
    rate: 5,
    expected: 250,
  },
  {
    name: "quarter payment: 2500 net at 5%",
    paid: 2950,
    vat: 450,
    rate: 5,
    expected: 125,
  },
  {
    name: "fractional rate: 10000 net at 7.5%",
    paid: 11800,
    vat: 1800,
    rate: 7.5,
    expected: 750,
  },
  {
    name: "half agorot rounds up: 10 net at 5%",
    paid: 12,
    vat: 2,
    rate: 5,
    expected: 1,
  },
  {
    name: "below half agorot rounds down: 9 net at 5%",
    paid: 11,
    vat: 2,
    rate: 5,
    expected: 0,
  },
  {
    name: "no VAT: 333 net at 7.5%",
    paid: 333,
    vat: 0,
    rate: 7.5,
    expected: 25,
  },
  {
    name: "exemption certificate rate is zero",
    paid: 11800,
    vat: 1800,
    rate: 0,
    expected: 0,
  },
  { name: "zero payment", paid: 0, vat: 0, rate: 5, expected: 0 },
  {
    name: "full withholding rate applies to net only",
    paid: 11800,
    vat: 1800,
    rate: 100,
    expected: 10000,
  },
]) {
  test(`withholding golden: ${row.name}`, () => {
    assert.equal(withheldCents(row.paid, row.vat, row.rate), row.expected);
  });
}

test("certificate is good through its final day and expired the following day", () => {
  assert.deepEqual(withholdingOn(vendor, "2026-12-31"), {
    state: "good",
    certificate: { ratePercent: 5, number: "GOLD-5", expires: "2026-12-31" },
  });
  assert.deepEqual(withholdingOn(vendor, "2027-01-01"), {
    state: "expired",
    certificate: { ratePercent: 5, number: "GOLD-5", expires: "2026-12-31" },
  });
});

test("zero-rate certificate is valid; absent and invalid certificates supply no rate", () => {
  assert.deepEqual(
    withholdingOn(
      { metadata: { withholding: { ratePercent: 0 } } },
      "2026-12-31",
    ),
    {
      state: "good",
      certificate: { ratePercent: 0 },
    },
  );
  assert.equal(withholdingOn(null, "2026-12-31"), null);
  for (const ratePercent of [
    -1,
    101,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "5",
  ]) {
    assert.equal(
      withholdingOn(
        { metadata: { withholding: { ratePercent } } },
        "2026-12-31",
      ),
      null,
    );
  }
});

test("payment field uses proportional saved VAT, aggregates bills, and preserves the certificate", async () => {
  await import("./helpers/dom");
  const { cleanup, render, screen } = await import("@testing-library/react");
  const sent: Array<Withholding | null> = [];
  try {
    render(
      <WithholdingField
        vendor={vendor}
        date="2026-12-31"
        currency="ILS"
        bills={[
          {
            id: "standard",
            taxVersion: 2,
            amountCents: 11800,
            taxAmountCents: 1800,
          },
          {
            id: "historic",
            taxVersion: 2,
            amountCents: 11700,
            taxAmountCents: 1700,
          },
          {
            id: "zero-rated",
            taxVersion: 2,
            amountCents: 4000,
            taxAmountCents: 0,
          },
          {
            id: "not-paid",
            taxVersion: 2,
            amountCents: 11800,
            taxAmountCents: 1800,
          },
        ]}
        allocations={{
          standard: 5900,
          historic: 2925,
          "zero-rated": 2000,
          "not-paid": 0,
          missing: 50000,
        }}
        onChange={(value) => sent.push(value)}
      />,
    );
    // Net 5000 + 2500 + 2000 = 9500; VAT 900 + 425 = 1325.
    // Paid 10825; tax 475; vendor cash 10350. Unknown/unpaid bills contribute nothing.
    assert.deepEqual(sent.at(-1), {
      withheldCents: 475,
      ratePercent: 5,
      certificate: "GOLD-5",
    });
    assert.match(
      screen.getByRole("status").textContent || "",
      /Withheld ₪4\.75 on ₪95\.00 before VAT; the vendor gets ₪103\.50/,
    );
  } finally {
    cleanup();
  }
});

test("VAT rounds per bill before withholding rounds once on the payment", async () => {
  await import("./helpers/dom");
  const { cleanup, render, screen } = await import("@testing-library/react");
  const sent: Array<Withholding | null> = [];
  try {
    render(
      <WithholdingField
        vendor={vendor}
        date="2026-10-01"
        currency="ILS"
        bills={[
          { id: "a", taxVersion: 2, amountCents: 12, taxAmountCents: 2 },
          { id: "b", taxVersion: 2, amountCents: 12, taxAmountCents: 2 },
        ]}
        allocations={{ a: 6, b: 6 }}
        onChange={(value) => sent.push(value)}
      />,
    );
    // Each half bill: 6 paid, 1 VAT, 5 net. Payment net 10 × 5% = 0.5 -> 1.
    // Rounding withholding on each allocation would incorrectly withhold zero.
    assert.deepEqual(sent.at(-1), {
      withheldCents: 1,
      ratePercent: 5,
      certificate: "GOLD-5",
    });
    assert.match(
      screen.getByRole("status").textContent || "",
      /Withheld ₪0\.01 on ₪0\.10 before VAT; the vendor gets ₪0\.11/,
    );
  } finally {
    cleanup();
  }
});

test("fresh payment with expired certificate requires a rate and never sends the expired number", async () => {
  await import("./helpers/dom");
  const { cleanup, fireEvent, render, screen } =
    await import("@testing-library/react");
  const sent: Array<Withholding | null> = [];
  try {
    render(
      <WithholdingField
        vendor={vendor}
        date="2027-01-01"
        currency="ILS"
        bills={[
          {
            id: "bill",
            taxVersion: 2,
            amountCents: 11800,
            taxAmountCents: 1800,
          },
        ]}
        allocations={{ bill: 5900 }}
        onChange={(value) => sent.push(value)}
      />,
    );
    assert.equal(
      (screen.getByLabelText("Tax withheld at source, %") as HTMLInputElement)
        .value,
      "",
    );
    assert.equal(sent.at(-1), null);
    assert.match(
      screen.getByRole("status").textContent || "",
      /ran out on 2026-12-31/,
    );
    fireEvent.change(screen.getByLabelText("Tax withheld at source, %"), {
      target: { value: "30" },
    });
    assert.deepEqual(sent.at(-1), { withheldCents: 1500, ratePercent: 30 });
    fireEvent.change(screen.getByLabelText("Tax withheld at source, %"), {
      target: { value: "" },
    });
    assert.equal(sent.at(-1), null);
  } finally {
    cleanup();
  }
});

test("half-agorot VAT is rounded for each bill before finding the payment net", async () => {
  await import("./helpers/dom");
  const { cleanup, render } = await import("@testing-library/react");
  const sent: Array<Withholding | null> = [];
  try {
    render(
      <WithholdingField
        vendor={{ metadata: { withholding: { ratePercent: 100 } } }}
        date="2026-10-01"
        currency="ILS"
        bills={[
          { id: "a", taxVersion: 2, amountCents: 4, taxAmountCents: 1 },
          { id: "b", taxVersion: 2, amountCents: 4, taxAmountCents: 1 },
        ]}
        allocations={{ a: 2, b: 2 }}
        onChange={(value) => sent.push(value)}
      />,
    );
    // Each VAT share is 0.5 -> 1; total paid 4 less VAT 2 leaves net 2.
    assert.deepEqual(sent.at(-1), { withheldCents: 2, ratePercent: 100 });
  } finally {
    cleanup();
  }
});
