/** D-32: independent report-input periods, integer agorot, explicit synthetic equipment classification.
 * Eilat/export fixtures are qualifying zero-rated supplies, not an automatic place-based exemption.
 * No expected amount below is calculated by another production helper.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  israelVatReturn,
  type IlVatDocument,
  type IlVatReturn,
} from "../lib/tax/ilVatReturn";
import type { TaxProfiles, TaxRegistration } from "../lib/tax/profile";
import type { CreditNote } from "../types";

const registration = "vat:IL:514000001";
const permit: TaxRegistration = {
  kind: "vat",
  number: "514000001",
  place: { country: "IL" },
  validFrom: "2020-01-01",
};
const profiles: TaxProfiles = {
  books: { place: { country: "IL" }, registrations: [permit] },
  labels: {
    "entity:eilat": {
      place: { country: "IL", district: "eilat" },
      registrations: [permit],
    },
    "entity:other": {
      place: { country: "IL" },
      registrations: [{ ...permit, number: "514000002" }],
    },
  },
};
const doc = (
  id: string,
  amountCents: number,
  taxAmountCents: number,
  extra: Partial<IlVatDocument> = {},
): IlVatDocument => ({
  id,
  date: "2026-01-15",
  status: "paid",
  taxVersion: 2,
  amountCents,
  taxAmountCents,
  taxTreatment: "standard",
  ...extra,
});
const credit = (
  id: string,
  amountCents: number,
  taxAmountCents: number,
  extra: Omit<Partial<IlVatDocument>, "status"> & {
    status?: CreditNote["status"];
  } = {},
): IlVatDocument =>
  doc(id, amountCents, taxAmountCents, { status: "open", ...extra });
type Input = Parameters<typeof israelVatReturn>[0];
const period = (changes: Partial<Input> = {}): Input => ({
  registration,
  profiles,
  order: ["entity"],
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  invoices: [],
  bills: [],
  ...changes,
});
const golden = (changes: Partial<IlVatReturn> = {}): IlVatReturn => ({
  registration,
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  taxableSalesCents: 0,
  outputVatCents: 0,
  zeroRatedSalesCents: 0,
  exemptSalesCents: 0,
  fixedAssetInputVatCents: 0,
  otherInputVatCents: 0,
  toPayCents: 0,
  documentCount: 0,
  ...changes,
});

test("D-32: a complete month separates exports, Eilat, exemption, both credit kinds and equipment inputs", () => {
  // Net sales 100000 - 10000; output 18000 - 1800 = 16200.
  // Equipment inputs 36000 - 3600 = 32400; other inputs 9000 - 1800 = 7200.
  // Refund = 16200 - 32400 - 7200 = -23400. Zero sales 30000 + 20000, exempt 5000.
  const input = period({
    invoices: [
      doc("ordinary-sale", 118000, 18000),
      doc("qualifying-export", 30000, 0, { taxTreatment: "zero_rated" }),
      doc("qualifying-eilat", 20000, 0, {
        taxTreatment: "zero_rated",
        dimensions: { entity: "eilat" },
      }),
      doc("exempt-sale", 5000, 0, { taxTreatment: "exempt" }),
    ],
    creditNotes: [credit("sales-credit", 11800, 1800)],
    bills: [
      doc("supplies", 59000, 9000),
      doc("machine", 236000, 36000, { fixedAsset: true }),
    ],
    vendorCredits: [
      credit("machine-return", 23600, 3600, { fixedAsset: true }),
      credit("supplies-return", 11800, 1800),
    ],
  });
  const before = structuredClone(input);
  assert.deepEqual(
    israelVatReturn(input),
    golden({
      taxableSalesCents: 90000,
      outputVatCents: 16200,
      zeroRatedSalesCents: 50000,
      exemptSalesCents: 5000,
      fixedAssetInputVatCents: 32400,
      otherInputVatCents: 7200,
      toPayCents: -23400,
      documentCount: 9,
    }),
  );
  assert.deepEqual(
    input,
    before,
    "reporting must not mutate its document inputs or registration profiles",
  );
});

test("D-32: an equipment credit in a later period reverses input VAT and creates VAT to pay", () => {
  assert.deepEqual(
    israelVatReturn(
      period({
        vendorCredits: [
          credit("returned-machine", 23600, 3600, { fixedAsset: true }),
        ],
      }),
    ),
    golden({
      fixedAssetInputVatCents: -3600,
      toPayCents: 3600,
      documentCount: 1,
    }),
  );
});

test("D-32: export and qualifying Eilat credits reduce zero-rated sales separately from exempt credits", () => {
  // Zero-rated: 40000 + 60000 - 10000 - 15000 = 75000; exempt: 30000 - 5000 = 25000.
  assert.deepEqual(
    israelVatReturn(
      period({
        invoices: [
          doc("export-only", 40000, 0, { taxTreatment: "zero_rated" }),
          doc("eilat-only", 60000, 0, {
            taxTreatment: "zero_rated",
            dimensions: { entity: "eilat" },
          }),
          doc("exempt-only", 30000, 0, { taxTreatment: "exempt" }),
        ],
        creditNotes: [
          credit("export-return", 10000, 0, { taxTreatment: "zero_rated" }),
          credit("eilat-return", 15000, 0, {
            taxTreatment: "zero_rated",
            dimensions: { entity: "eilat" },
          }),
          credit("exempt-return", 5000, 0, { taxTreatment: "exempt" }),
        ],
      }),
    ),
    golden({
      zeroRatedSalesCents: 75000,
      exemptSalesCents: 25000,
      documentCount: 6,
    }),
  );
});

test("D-32: inclusive period edges and issueDate count, while drafts, voids and another registration do not", () => {
  assert.deepEqual(
    israelVatReturn(
      period({
        invoices: [
          doc("first-day", 11800, 1800, {
            date: undefined,
            issueDate: "2026-01-01T23:59:59Z",
          }),
          doc("last-day", 11800, 1800, { date: "2026-01-31T00:00:00Z" }),
          doc("before", 11800, 1800, { date: "2025-12-31" }),
          doc("after", 11800, 1800, { date: "2026-02-01" }),
          doc("draft", 11800, 1800, { status: "draft" }),
          doc("void", 11800, 1800, { status: "void" }),
          doc("other-registration", 11800, 1800, {
            dimensions: { entity: "other" },
          }),
        ],
      }),
    ),
    golden({
      taxableSalesCents: 20000,
      outputVatCents: 3600,
      toPayCents: 3600,
      documentCount: 2,
    }),
  );
});

test("D-32: a registration applies on its first and final day, independently of the wider report period", () => {
  assert.deepEqual(
    israelVatReturn(
      period({
        endDate: "2026-02-01",
        profiles: {
          books: {
            place: { country: "IL" },
            registrations: [
              { ...permit, validFrom: "2026-01-16", validTo: "2026-01-31" },
            ],
          },
        },
        invoices: [
          doc("before-registration", 11800, 1800, { date: "2026-01-15" }),
          doc("registration-first", 11800, 1800, { date: "2026-01-16" }),
          doc("registration-last", 11800, 1800, { date: "2026-01-31" }),
          doc("registration-expired", 11800, 1800, { date: "2026-02-01" }),
        ],
      }),
    ),
    golden({
      endDate: "2026-02-01",
      taxableSalesCents: 20000,
      outputVatCents: 3600,
      toPayCents: 3600,
      documentCount: 2,
    }),
  );
});

test("D-32: saved foreign-currency sales, credits and equipment inputs convert into the registration report", () => {
  // Source net 10000 less 1000, at 3.7 = 33300; output (1800 - 180) x 3.7 = 5994.
  // Equipment input 900 x 3.7 = 3330; to pay 5994 - 3330 = 2664 agorot.
  assert.deepEqual(
    israelVatReturn(
      period({
        invoices: [doc("fx-sale", 11800, 1800, { exchangeRate: 3.7 })],
        creditNotes: [credit("fx-credit", 1180, 180, { exchangeRate: 3.7 })],
        bills: [
          doc("fx-equipment", 5900, 900, {
            exchangeRate: 3.7,
            fixedAsset: true,
          }),
        ],
      }),
    ),
    golden({
      taxableSalesCents: 33300,
      outputVatCents: 5994,
      fixedAssetInputVatCents: 3330,
      toPayCents: 2664,
      documentCount: 3,
    }),
  );
});

test("D-32: a period spanning the 17-to-18 percent transition retains each document’s saved VAT", () => {
  assert.deepEqual(
    israelVatReturn(
      period({
        startDate: "2024-12-01",
        endDate: "2025-01-31",
        invoices: [
          doc("december-17-percent", 11700, 1700, { date: "2024-12-31" }),
          doc("january-18-percent", 11800, 1800, { date: "2025-01-01" }),
        ],
      }),
    ),
    golden({
      startDate: "2024-12-01",
      endDate: "2025-01-31",
      taxableSalesCents: 20000,
      outputVatCents: 3500,
      toPayCents: 3500,
      documentCount: 2,
    }),
  );
});

test("D-32: FX rounds each saved document’s VAT to agorot before aggregation and equipment-credit reversal", () => {
  // Each net 6 x 1.5 = 9; each VAT 1 x 1.5 rounds to 2. Two sales owe 4, not 3.
  // Equipment input and its later credit cancel (2 - 2); other input 2 leaves 2 to pay.
  assert.deepEqual(
    israelVatReturn(
      period({
        invoices: [
          doc("small-sale-1", 7, 1, { exchangeRate: 1.5 }),
          doc("small-sale-2", 7, 1, { exchangeRate: 1.5 }),
        ],
        bills: [
          doc("small-equipment", 7, 1, { exchangeRate: 1.5, fixedAsset: true }),
          doc("small-supply", 7, 1, { exchangeRate: 1.5 }),
        ],
        vendorCredits: [
          credit("small-equipment-return", 7, 1, {
            exchangeRate: 1.5,
            fixedAsset: true,
          }),
        ],
      }),
    ),
    golden({
      taxableSalesCents: 18,
      outputVatCents: 4,
      otherInputVatCents: 2,
      toPayCents: 2,
      documentCount: 5,
    }),
  );
});

test("D-32: unregistered books and empty periods never acquire another registration’s tax", () => {
  assert.deepEqual(israelVatReturn(period()), golden());
  assert.deepEqual(
    israelVatReturn(
      period({ profiles: null, invoices: [doc("unassigned", 11800, 1800)] }),
    ),
    golden(),
  );
  assert.deepEqual(
    israelVatReturn(
      period({
        registration: "vat:IL:missing",
        invoices: [doc("assigned-elsewhere", 11800, 1800)],
      }),
    ),
    golden({ registration: "vat:IL:missing" }),
  );
});

test("D-32: actual credit lifecycle statuses count, while draft and void credits do not", () => {
  for (const status of ["open", "applied", "partially_applied"] as const) {
    assert.deepEqual(
      israelVatReturn(
        period({
          creditNotes: [credit("customer-return", 11800, 1800, { status })],
          vendorCredits: [credit("vendor-return", 5900, 900, { status })],
        }),
      ),
      golden({
        taxableSalesCents: -10000,
        outputVatCents: -1800,
        otherInputVatCents: -900,
        toPayCents: -900,
        documentCount: 2,
      }),
      status,
    );
  }
  assert.deepEqual(
    israelVatReturn(
      period({
        creditNotes: [
          credit("draft-customer", 11800, 1800, { status: "draft" }),
          credit("void-customer", 11800, 1800, { status: "void" }),
        ],
        vendorCredits: [
          credit("draft-vendor", 5900, 900, { status: "draft" }),
          credit("void-vendor", 5900, 900, { status: "void" }),
        ],
      }),
    ),
    golden(),
  );
});
