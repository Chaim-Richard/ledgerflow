# Israel: withholding on payments abroad — §170, Form 2513/1, Form 2513/2 (A-165)

Research note for whoever builds payment-abroad support (facts for AI #1's tax work; this note
decides nothing and changes no rate). Read 2026-10-22 from the sources at the bottom.
**Status: research only.** `src/lib/tax/ilWithholdingDefaults.ts` already carries the internal-law
default rows; nothing in the app yet asks the 2513 questions below.

## The default rule

Section 170(a) of the Income Tax Ordinance: whoever pays a foreign resident (or for them) a sum
that is **taxable income** must withhold at source — **25% for an individual**, or **the corporate
tax rate of that tax year for a company** (23% — stated for 2021 in the CPA summary read, and for
2026 on Discount Bank's foreign-residents page) — unless one of these displaces it:

- a written certificate from the assessing officer (פקיד השומה) setting a lower rate or an
  exemption, or a certificate from a CPA authorised for this by the Commissioner — the Income Tax
  Regulations (deduction from payments to foreign residents), 1992, allow the payer to withhold at
  the reduced rate, or not at all, on the strength of that original certificate;
- a tax treaty rate (treaty overrides internal law; the payee's certificate of residence decides
  which treaty);
- the payment is not income produced in Israel at all (e.g. a service rendered and performed
  entirely abroad, §4A source rules) — then §170 does not apply in the first place;
- one of the two administrative channels below.

## The three channels compared

| | Form 2513/1 (a.k.a. Form 114) — reduction or exemption | Execution Instruction 34/93 — listed exempt payments | Form 2513/2 — the "green track" at the bank |
|---|---|---|---|
| What it is | Payer's declaration + **request to reduce withholding**, decided by the assessing officer | Tax Authority instruction listing payment types that may be transferred **with no withholding** | Payer's **self-declaration that the payment is exempt**, signed at the bank branch or in online banking — no Tax Authority visit, no certificate |
| Decides | The assessing officer; the payer waits for the certificate (gov.il: "יש להמתין לקבלת האישור") | Nobody per payment — the list decides; the bank transfers against the documents | The payer declares; the bank keeps the form and may pass it to the Tax Authority; if the declaration and the actual transfer disagree, the assessing officer may assess the tax that should have been withheld (§164/§170) |
| Filed with | The assessing officer (online, post or fax; representatives may file for the taxpayer); attach a certificate as to the nature of the payment | The bank, with the payment documents | The bank |
| Covers | Any payment to a foreign resident the payer wants below the default rate (the payee-side twin is Form A/114, filed by the foreign resident, with the treaty claim and a residence certificate stamped by their own tax authority) | 35 numbered everyday types — see the shortlist below | Only the 9 investment/loan types below, only to a **resident of a treaty country** into a **bank account in a treaty country** (the form's section 6 lists them) |
| Since | Long-standing (Form 114) | 1998 consolidation; relief repeatedly extended — **the CPA summary read says extended to 31.12.2025; an extension past that date was NOT verified for this note and must be re-read on taxes.gov.il before anyone codes from it** | Launched 26 Sep 2017 (investments/loans abroad); expanded 17 Apr 2018 (partnership rights, options, exercise supplement, company loan-principal repayment); **expanded again by a Tax Authority notice of 15 Dec 2025, including transfers to CRS countries per its list — known to this note only from law-firm summaries; re-read the notice itself before coding** |

### 34/93 exempt list — the items a business meets most (of 35)

Purchase of tangible goods (computer software is usually a right of use = royalty, **not** this
item); transport and port/loading/storage services performed entirely abroad, incl. foreign
customs agents; tourism and insurance services entirely abroad; **services rendered and performed
entirely abroad** — up to **$250,000 per payer per tax year** in the latest notice, and only if
neither the payee nor their people were in Israel to perform them; refund of a customer advance
(no interest); registration fees (patents, standards, companies); obligatory payments to foreign
authorities on demand, incl. foreign taxes; journal subscriptions; international-organisation
membership; conference entry/participation abroad; advertising abroad; exhibition-booth fees;
foreign tender participation; flight tickets bought abroad; tuition/exam fees abroad; private
rent not claimed as an Israeli expense; real-estate consideration (after the land-tax director's
approval); transfers to one individual up to $500/year per payer; non-resident-deposit to
non-resident-deposit transfers. (Family gifts/support, pensions, estates and the rest are in the
full list — re-read 34/93 itself, do not code from this shortlist.)

### 2513/2 green-track payment types (9) and the document the payer must keep

| # | Payment | Source document kept by the payer |
|---|---|---|
| 1 | Investment in shares of a company | Contract + the company's incorporation document |
| 2 | Investment in real estate abroad | Purchase contract |
| 3 | Investment in other assets abroad (tangible only) | Purchase contract + invoice |
| 4 | Granting a loan to a foreign resident | Loan agreement |
| 5 | Granting a shareholder loan to a company | Loan agreement |
| 6 | Repayment of loan principal by a company, with CPA confirmation | Loan agreement + Form 2513/3 |
| 7 | Investment in partnership rights | Partnership agreement |
| 8 | Purchase of options | Purchase contract |
| 9 | Exercise supplement paid on exercising options | Purchase contract |

Retention follows the bookkeeping rules (הוראות ניהול ספרים): 7 years from the end of the tax
year the payment belongs to, or 6 years from filing that year's return, whichever is later;
produce on demand. The form itself (version updated 1.2020, read via Mercantile Bank's copy):
§1 payer details, §2 payment details (tick the type), §3 payee + account details, §4 payer's
declaration (details complete and true; the bank will pass the form to the Tax Authority; keep the
supporting documents; a mismatch lets the assessing officer set the tax under §164/§170), §5 bank
declaration (skipped when filled online), §6 the treaty-country list; a CPA-confirmation appendix
for type 6.

## What a future screen would have to ask (facts, not decisions)

Per payment abroad: payee residence country; is it a treaty country; the country of the payee's
bank account; payee kind (individual/company — §170's default differs); payment type — a 34/93
number, a green-track number, or "other"; was the service performed entirely abroad (and the
running per-payer/per-year total against the $250,000 cap); is there a 2513/1 certificate or a
treaty claim (rate + certificate date); which source document is being kept and where. The screen
may then say which channel the payment *appears* to belong to and what is missing — calculation
status only, like the rest of the tax area: the bank, the assessing officer or the treaty decides
the rate, never the app.

## Open items for AI #1 (do not code past these without re-reading the source)

1. `ilWithholdingDefaults.ts` foreign rows use a flat 25%; §170's company default is the corporate
   rate (23%). Whether to split the foreign rows by `payeeKind` is a tax-maths call for AI #1.
2. 34/93's extension beyond 31.12.2025 and the 15 Dec 2025 green-track expansion (CRS countries,
   exact payment types) — re-read on taxes.gov.il / the Tax Authority notices at build time.
3. The form's current §6 treaty-country list and §2 numbering — the copy read here is the 1.2020
   version hosted by a bank; pull the current form from the Tax Authority before enumerating
   countries in code.

## Sources (read 2026-10-22)

- Israel Tax Authority on gov.il — "הצהרה על תשלום לתושב חוץ ובקשה להקטנת ניכוי ממס במקור (טופס
  2513)": https://www.gov.il/he/service/itc-declaration-payment-foreign-resident (page last
  updated 15.12.2020; the 2513/1 route, who may file, attach proof of the payment's nature).
- Form 2513/2 itself (Tax Authority form, updated 1.2020; bank-hosted copy):
  https://www.mercantile.co.il/media/lrobr33m/0-002-318.pdf (§170 heading; intended only for the
  §2 payment types and §6 treaty countries; §§1–6 structure; loan-principal CPA appendix).
- A. Ben Shushan & Co. CPA — "תשלום לתושב חוץ – היבטי מיסוי וכללי ניכוי מס במקור" (professional
  summary, Dec 2024): §170(a) rates, the 1992 regulations, 34/93's 35 items and its extension to
  31.12.2025, the green track's 9 types with their kept documents, 2017 launch + 2018 expansion,
  the treaty-country list, retention periods.
- Discount Bank / Mercantile Bank foreign-resident withholding pages (no certificate → 25% or the
  corporate rate; 23% in 2026 / since 2018).
- KLF law office update (Dec 2025) on the Tax Authority's 15.12.2025 expansion of the 2513/2
  track — flagged above as to-be-verified against the notice itself.
