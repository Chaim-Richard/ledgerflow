# LedgerFlow Enterprise ERP & Continuous Ledger

LedgerFlow is an enterprise-grade multi-entity continuous financial ledger and ERP system built on modern TypeScript, React 19, and Vite. It provides double-entry accounting with absolute directional balancing, multi-dimension allocation, closed-period integrity controls ("Reverse & Correct"), automated bank reconciliation, billing/invoicing with PDF document generation, and real-time financial reporting.

---

## 🛠 Tech Stack & Environment

- **Frontend:** React `^19.0.0`, Vite `^6.2.0`, TypeScript `~5.8.2`, Tailwind CSS `^4.1.14`
- **State Management:** Zustand `^5.0.14`
- **Database & Auth:** Supabase — Postgres with row level security, Supabase Auth (email + password, Google, authenticator-app two-step login), Realtime. The app keeps a Firestore-style data API on top (`src/lib/db/` in the browser, `src/server/db/pgFirestore.ts` on the server).
- **Backend Server:** Express `^4.21.2`, Node.js (TypeScript via `tsx` and bundled with `esbuild`)
- **Payments & Billing:** Stripe `^22.2.1`
- **Banking Integrations:** Plaid `^42.2.0`, `react-plaid-link` `^4.1.1`
- **Document Generation:** PDFKit `^0.20.2` (custom native PDF stream engine with `/api/v1/workspaces/:workspaceId/documents/:type/:id/pdf`)
- **Visualization:** Recharts `^2.15.1`, D3 `^7.9.0`
- **Animations:** Motion `^12.23.24` (`motion/react`)

---

## 🏛 Three-Layer System Architecture

LedgerFlow strictly separates data, computation, and rendering into three decoupled layers:

### Layer 1: Data Source of Truth (Zustand & Supabase Postgres)
- All client-side runtime ledger state is managed via `useLedgerStore` (`src/stores/useLedgerStore.ts`).
- Canonical data lives in **top-level collections** (`transactions`, `chartAccounts`, `invoices`, `bills`, `projects`, `recurring`, `bankLines`, `auditLogs`), one Postgres table each (`supabase/migrations/`), scoped strictly by `workspaceId`.
- No nested subcollections are used.

### Layer 2: Pure Math Financial Algorithms (`src/lib/algorithms/`)
- Financial formulas are 100% pure math functions that never fetch external data or mutate state.
- Each algorithm implements the `AlgorithmDefinition` interface, taking `AlgorithmContext` (`transactions`, `accounts`, `period`, `asOfDate`, `reportingCurrency`) and inputs to produce `{ metrics, charts, insights }`.
- Central registry: `FINANCIAL_ALGORITHMS` (`src/lib/algorithms/index.ts`).

### Layer 3: Dynamic Views, Registries & Plugins (`src/config/registry.tsx`)
- Views are modular React components registered lazily in `VIEW_COMPONENTS` and categorized under `NAV_GROUPS`.
- Zero-configuration plugin discovery via `src/plugins/` using `import.meta.glob`.
- Interactive operational documentation available via the Help Guide (`help` tab / top-bar `?` icon).

---

## 🚀 Core Features & Modules

1. **Continuous Double-Entry Ledger:**
   - Strict debit/credit equilibrium on every transaction.
   - Dynamic account role resolution (`resolveAccountRole`) — no hardcoded accounts.
   - Absolute transaction totals (`totalAmountCents`) with directionality defined strictly by line items.
   - Filtered via `isPostable()` to exclude non-posting drafts or rejected lines.

2. **Closed-Period Governance ("Reverse & Correct"):**
   - Locked fiscal periods strictly reject direct edits or deletions.
   - Corrective actions post an equal-and-opposite reversal in the open period linked to a replacement entry with full audit trail history.

3. **Sales & Customer Invoicing:**
   - Invoicing with tax-inclusive or tax-exclusive calculations, discounts, and retainage.
   - Real-time PDF document preview and generation with native streaming endpoints.
   - Bad debt write-off modal for overdue balances.

4. **Purchases & Accounts Payable:**
   - Vendor bill tracking, multi-category split allocation, and receipt attachments.
   - Settlement payment processing with automated oldest-first allocation across open bills/invoices.

5. **Banking & Zero-Variance Reconciliation:**
   - Direct bank feed integration via Plaid.
   - Bank statement imports (CSV, OFX, QBO).
   - Zero-variance statement balancing before finalizing reconciliation statements.

6. **Financial Statements & Analytics:**
   - Balance Sheet, Profit & Loss (P&L), Cash Flow Statement, A/R & A/P Aging, and Tax Liability reports.
   - Monte Carlo cash flow forecasting and runway simulator.

---

## ⚡ Quick Start & CLI Scripts

```bash
# 1. Install dependencies
npm install

# 2. Start local development server (binds on port 3000)
npm run dev

# 3. Execute full TypeScript typecheck & ESLint validation
npm run lint

# 4. Run automated test suite
npm test

# 4b. Database tests (needs a local Postgres; CI starts one automatically)
export LF_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lf_test
npm run db:test-setup   # apply supabase/migrations to the test database
npm run test:rules      # row level security tests
npm test                # now also runs the database layer and sign-in tests

# 5. Build for production (bundles Vite client + standalone server.cjs)
npm run build

# 6. Start production server
npm start

# 7. Grant platform admin privileges to a user (DATABASE_URL = Supabase connection string)
npm run grant-admin -- <uid-or-email>

# 8. Scaffold new tools
npm run scaffold:plugin <name>
npm run scaffold:algo <name>
```

---

## 🔒 Security & Verification Standards

- **Server-Side API Keys:** All third-party secrets (`GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Plaid credentials) reside exclusively server-side.
- **Data Encryption:** Sensitive fields are encrypted using AES-256-GCM.
- **PII Scrubbing:** Automated sanitization of SSNs, credit card numbers, and secret tokens in logs.
- **Role-Based Access Control:** Postgres row level security (`supabase/migrations/`, tested by `supabase/tests/rls.test.sql`) enforces workspace boundaries, roles, allowed fields, closed-period write lockdown and two-step login.
