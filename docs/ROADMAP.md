# LedgerFlow roadmap filter (owner, 7 Oct)

Every task in `docs/TRACKER.md` and every queue in `docs/COORDINATION.md` is judged by this page.
It does not replace the tracker. It says what we build first, what waits, and what never goes into
the core.

## The goal

**The bookkeeping system with the least friction: from a one-person business to a group of companies,
properties and projects.**

That does not mean every ERP feature goes into the core. The rule is:

**Start simple. Complexity appears only when the business needs it.**

- A one-person business uses LedgerFlow without knowing what a dimension, a consolidation or an
  intercompany entry is.
- A complex business grows into those things without leaving LedgerFlow, without a second system,
  and without rebuilding its books.
- The same core grows step by step:
  1. simple books;
  2. projects and locations;
  3. departments and properties;
  4. several companies;
  5. currencies and dealings between them;
  6. consolidation;
  7. add-ons for one industry.

There is one app that grows. There is never a "simple" app next to an "advanced" app.

## Four layers, kept apart

### 1. Books (a workspace)

A workspace holds books that must be controlled separately. It owns:
- the accounts, the ledger and the fiscal year;
- the home currency and the tax setup;
- the bank accounts;
- the period locks and the roles (who sees and changes what);
- the documents and the audit trail.

Two sets of books that the law treats as separate are never merged into one workspace with a tag.

### 2. Labels (dimensions)

Labels describe activity inside one set of books, the way the business wants to see it. Today there
are four built-in labels, plus labels you define yourself (`src/lib/dimensionUtils.ts`,
`src/model/ledger.ts`):
- World / Entity;
- Class;
- Location;
- Project.

The same mechanism covers property, facility, department, program, fund, cost center, branch and
sales channel. None of these needs its own set of books.

### 3. Group of books (above workspaces), tracker DA-01

A group answers "which books belong together?" Examples:
- a holding company and its companies;
- an accountant's clients;
- several properties, each in its own legal company.

A group gives one place to move between those books, and later one place to report across them. A
group is not a ledger. It copies no entries. It never gets around a workspace's own roles or its
database rules: a user sees only the books they could already open one by one.

### 4. Real events stay separate

Each of these is a different real-world event. LedgerFlow links them but never pretends they are the
same thing:
- an order is not a payment;
- a payment is not an invoice;
- an invoice is not a delivery;
- a delivery is not the cost of the goods;
- a bank line is not the business event behind it;
- a quote is not a sale;
- a purchase order is not a bill;
- goods received are not the vendor's bill.

## "Can a company just be a label?" (the owner's question, 7 Oct)

**Yes, for a while.** The World / Entity label already does it. Use one set of books with an Entity
label when all of these are true:
- the same people run all the companies and may see everything;
- they use one currency and one fiscal year;
- you close the month once for all of them;
- you only want reports split by company.

Plenty of small owners with two or three companies work this way.

**Separate books are needed** as soon as any of these is true:
- a company files its own tax return, or needs its own audited statements;
- it has its own bank accounts that the law treats as its own;
- someone may see one company but not another (a partner, an outside accountant, an auditor);
- it uses another currency or another fiscal year;
- it closes its months on its own.

A label cannot lock one company's month while another stays open. It cannot hide one company from
one person. It cannot give a company its own tax setup.

The path between the two is the "start simple" rule. Start with a label. When a company outgrows it,
LedgerFlow should move that label's activity into its own books, without retyping (DA-10). The group
(DA-01) then keeps the new books next to the old ones.

## Release buckets

Every open item is in exactly one bucket (the full list is at the end of this page).

- **V1, correct before broad use:** the main path below, and anything that can make saved money,
  stock or reports wrong.
- **Later, general improvements:** most of the list. Done in order of priority:
  - P0: the core and strategic items;
  - P1: big friction savers;
  - P2: platform growth.
- **Add-on (extension):** one industry or one country. It is built as a module that is off by
  default, or not built until a customer needs it.
- **Research / owner decision:** not built until the owner decides.

**No AI moves an item into V1 on its own.** Only the owner does that (in `docs/FOR_YOU.md`). An empty
backlog is not the goal. The goal is a small set of workflows that are shown to work.

## The main path (V1 acceptance)

1. Create or open the books.
2. Set up or import the accounts.
3. Add customers, vendors and items as needed.
4. Connect or import the bank.
5. Enter money in and money out.
6. Classify the activity and add labels.
7. Record payments.
8. Reconcile.
9. Read the reports.
10. Close the period.
11. Back up, and restore.
12. Show where each important number comes from.

This path is tested three ways:
- in a simple single-business setup (DA-07);
- with labels in use (DA-08);
- later, across a group of books (DA-09).

## The lifecycles (each step keeps a link to the step before and after it)

- **Money in:** quote → sales order → deposit (if any) → delivery (if any) → invoice → payment →
  bank match → reconciliation → reports → close.
- **Money out:** request (if any) → purchase order → goods or service received → bill → approval →
  payment → bank match → reconciliation → reports → close.
- **General books:** source document → classification → balanced entry → labels → reconciliation →
  adjustments → close → report → drill back to the evidence.
- **Assets and stock:** acquire → place or label → use or deliver → cost or depreciation → adjust →
  transfer → return or dispose → reconcile and report.
- **Several companies:** separate books → related companies → dealings between them → matching →
  translation → elimination → consolidated report → drill back into each company's own books.

## Friction budget (ask it for every new thing)

**Does this remove more work than it adds?**

Avoid:
- another settings page for something LedgerFlow could work out;
- another confirmation for a harmless change that can be undone;
- another module when an existing workflow can hold it;
- another new word when the user already has a word for the thing;
- a second implementation of a report that already exists;
- a browser copy of data that pretends to be complete.

Prefer:
- editing in place;
- suggestions from the workspace's own data;
- remembered safe defaults;
- one click through to the source;
- typed links between related records;
- showing more only when it is needed;
- bulk actions;
- undo for safe changes;
- the server checking anything that involves money;
- error messages that say what to do.

## AI in the books

AI is used a lot to remove work: understanding what was typed, suggestions, classification
proposals, search, turning a question into a query, reading documents, guiding a workflow.

The numbers themselves stay exact and come from the same code as the reports. AI may say "I think
this belongs to Property 5, because the approved entries from this payee were Property 5". It never
quietly creates an accounting fact.

For anything that changes money:
- show the result first;
- post it through the existing checked server route;
- keep it in the audit trail;
- refuse rather than invent a missing account, rate or person.

## Core or add-on

**The core holds what every business needs:**
- the ledger and accounts;
- customers and vendors;
- sales, purchases and payments;
- banking and reconciliation;
- the tax framework and currencies;
- labels and period close;
- reports and audit;
- security;
- imports, exports and the API.

**Add-ons hold what only some businesses need**, for example:
- deep property management;
- construction billing;
- nonprofit statements;
- manufacturing;
- one industry's settlements;
- one country's filings.

An add-on is not in the default menus. An add-on that changes money goes through the same checked
routes as the core (DA-04). It never writes to the database directly.

## Say only what is true (DA-05)

Every capability has one of six labels:
- **Available**;
- **Available with limits**;
- **Partial**;
- **Internal, test or demo only**;
- **Planned**;
- **Needs an owner decision**.

The README, Help, onboarding and pricing take their claims from that one table. A type, a route, an
empty screen or a test of the arithmetic alone does not make something "Available".

For each important workflow, Help says (DA-06):
- before you start;
- what you do;
- what LedgerFlow changes;
- what you see afterwards;
- what it affects further on;
- what can fail;
- whether it can be undone;
- what belongs to this workspace only;
- what happens by itself;
- what still needs a person to check.

## Every open item by bucket (7 Oct; 292 open, counting the partly done ones and section DA)

These are the tracker IDs; `docs/TRACKER.md` has the detail.

### V1: correct before broad use

- **Product and correctness:**
  - BF-08, step 1 (orders keep their items, so stock and cost move) — done 7 Oct;
  - W-06 (negative-stock policy) — done 7 Oct;
  - N-12 (explain this number: statements, trial balance, aging, budget vs actual) — done 8 Oct (Claude);
  - N-13 (one sign for opening balances, found by N-12) — done 8 Oct;
  - Z-12 (the missing-label check, with a simple rule per account) — done 7 Oct (the check, the rules, the warnings, and refusing on the server when the rule says so);
  - K-34 and BD-02 (one fast switcher between books) — done 8 Oct.
- **Proof:** DA-05 and DA-06 (done 8 Oct, Claude), DA-07 and DA-08 (both done 7 Oct, against the real database).
  - N-14 (Hebrew learned patterns overwrite each other, found by DA-05) — done 8 Oct.
- **The owner's settings:** L-67 and L-83.

### Later, P0 (core and strategic)

- **Groups and companies:** BD-01, DA-01, Z-16, Z-17, Z-18, Z-19, Z-20 and CB-26 (one multi-entity
  design, see Z-16). On 8 Oct: own groups, the group summary with translation, dealings between the
  companies, eliminations of balances and of sales between them, and the parent with its shares are done;
  the parent's investment, shared groups and kept rates are done too; open are account-level lines,
  the equity method and goodwill, and the Practice view (BD-01).
- **Sales, stock and returns:** BF-08 step 2 (delivery apart from invoice, done 7 Oct; the printable note and returns after delivery, done 8 Oct), W-01, W-02 and BF-06 (all three done 7 Oct).
- **Simple until needed:** BB-07 and P-08.

### Later, P1 (big friction savers)

- **One queue, and questions:** DA-02 (needs attention, done 8 Oct) and DA-03 (ask the books, verified, done 8 Oct).
- **Rules:** Q-05, K-39 and CA-13 (one rule family).
- **The close cycle:** BD-04 and BD-06 (with R-11, which is done).
- **Bank connections:** Z-28, Z-29 and Z-30 (Z-30 done 8 Oct).
- **Reports:** N-07, N-08, N-10, CB-25 and DA-09 (done 8 Oct).

### Later, P2 (platform growth)

- **Add-ons:** DA-04 (the extension contract).

### Later, the general list (in tracker order)

- **Performance and code:** C-15, C-17, C-19, AA-06, L-38, L-94 and L-123.
- **Editing in place:** I-22 and I-23.
- **Features:** K-33, K-35 and K-40.
- **Operations:** L-06, L-15 and L-84.
- **Records:** M-10, M-11, M-12 and M-21.
- **Reports that wait for item lines on bills:** J-08, J-10 and BA-03.
- **Charts:** O-03, O-04, O-05, O-06 and O-08.
- **Platform:** P-05, P-11, P-12, P-13 and P-14.
- **Notices:** S-13 and S-20.
- **Tax:** T-05 and T-08.
- **Payroll:** U-11.
- **Projects and time:** V-01, V-02, V-03, V-04, V-05, V-06 and V-07.
- **Stock:** W-08 and W-09.
- **Fixed assets:** X-06 and X-07.
- **Banking, documents and settings:** Y-11, Y-19, Y-20, Y-26, Y-29 and Y-35.
- **Actions, settings and dashboard:** BA-18, BB-01, BB-02, BB-05, BC-02 and BC-04.
- **Accountant:** BD-08.
- **Items:** BF-01, BF-02, BF-03, BF-04, BF-07 and BF-09.
- **Working together:** BG-01, BG-02, BG-03, BG-04, BG-05, BG-06 and BG-07.
- **Compliance:** BJ-01, BJ-02, BJ-03, BJ-07 and BJ-10.
- **Imports and archives:** BK-02, BK-03, BK-04 and BK-10.
- **Email:** BL-02, BL-04, BL-06 and BL-07.
- **Money display:** BM-01, BM-02, BM-03, BM-04, BM-05 and BM-06.
- **Monitoring:** BN-01, BN-02, BN-03, BN-04, BN-05, BN-06 and BN-07.
- **Help:** BO-04 and BO-05.
- **Developer tooling:** BP-01, BP-02, BP-03, BP-04, BP-05, BP-06, BP-07 and BP-08.
- **From ERPNext-style tools:** CA-05, CA-16, CA-17, CA-18, CA-20, CA-28, CA-29, CA-30, CA-31,
  CA-35 and CA-36.
- **More reports:** CB-05, CB-08, CB-11, CB-12, CB-13, CB-16, CB-17, CB-18, CB-19, CB-20, CB-21,
  CB-22, CB-23, CB-24 and CB-27.
- **From Invoice Ninja-style tools:** CC-01, CC-02, CC-03, CC-04, CC-05, CC-06, CC-07, CC-08, CC-09,
  CC-10, CC-11, CC-12, CC-13, CC-14 and CC-16.
- **Records and notes:** CD-01, CD-02 and CD-06.
- **Accounts and sign-in:** CE-01, CE-06, CE-08, CE-09 and CE-10.
- **Time and custom fields:** CF-01, CF-02, CF-03, CF-04, CF-05, CF-06, CF-07 and CF-08.
- **Platform modules:** CG-01, CG-02, CG-03, CG-04, CG-05, CG-06, CG-13, CG-14 and CG-15.

### Add-on (one industry or one country)

- **Industries:**
  - BI-01 to BI-16 (nonprofit, construction, legal, property and restaurant packs);
  - V-08 and V-09 (work in progress, milestone billing);
  - W-07 (assembly);
  - Q-03 (serials and lots);
  - BF-05 (consignment);
  - M-13 (commodities);
  - CB-15 (partner commission);
  - CB-28 (point-of-sale register).
- **Countries:**
  - T-09 to T-15 (country filings and e-invoicing);
  - CC-15 (e-invoicing log);
  - CA-14 (bank guarantee);
  - CA-19 (India TDS);
  - U-09 (direct deposit file, per bank format).
- **Providers:** Y-04, Y-05, Y-06 and Y-07 (bank feeds for one region), and Z-23 to Z-27 (shop and CRM
  connectors).
- **Trading and investments:** CE-02 to CE-05.
- **Sales tools:**
  - CA-21 (pricing rules);
  - CA-22 (coupons);
  - CA-23 (loyalty);
  - CA-24 (shipping rules);
  - CG-09 (a promotion engine).

### Research / owner decision

- **Enterprise sign-in and access:**
  - P-01, P-02 and P-03 (SSO, SCIM, IP allowlist);
  - P-04 and CE-07 (support sign-in as a user: a privacy decision);
  - CG-07 and CG-08 (fine-grained roles).
- **Business:** P-06 (usage metering, decided with pricing) and P-10 (referrals).
- **Data storage:** BH-02 (three-decimal currencies) and Y-32 (data region).
- **Companies:** Z-21 and Z-22 (minority interest, equity method: only with a real group customer),
  and DA-10 (move a label into its own books).
- **Not building now:**
  - CD-03, CD-04 and CD-05 (query language, formula engine, end-to-end encryption);
  - M-15 (warehouses, = W-01);
  - CG-10 (regions), CG-11 (sales channel, a label) and CG-12 (stock location, = W-01);
  - BA-14 (SMS).

The owner's earlier "don't build" list (P-01..P-03, T-09..T-15, M-15, BI-*, CD-03..05, CA-21..24,
CG-09..12, CE-02..05, Y-05..07, BA-14, Z-23..27) still stands. Those items are in the add-on and
research buckets above, not in V1 or Later.
