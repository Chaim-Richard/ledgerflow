# Project Architecture and Modification Guide

> **Codex and other AI assistants:** first read [`docs/COORDINATION.md`](docs/COORDINATION.md).
> It says which task to do next, which files not to touch, and the checks every change must pass.
> What to build first, and what stays out of the core: [`docs/ROADMAP.md`](docs/ROADMAP.md) (owner, 7 Oct).

## 1. System Overview
This project is an advanced Enterprise Resource Planning (ERP) and Financial Ledger system built with React, Vite, and Tailwind CSS. It uses client-side state management (Zustand) and features a dynamic registry architecture for views, algorithms, and analytical lenses.

## 2. The Tool Ecosystem & Data Flow
To ensure complexity does not grow over time, all "tools" are separated into three strict layers. You can view a live visualization of this by clicking **Architecture Map** in the app sidebar.

### Layer 1: Durable data and browser context
- Durable records live in workspace-scoped Supabase/Postgres collections; financial writes use the existing server/posting services.
- `useLedgerStore` (`src/stores/useLedgerStore.ts`) holds the loaded browser cache and computed context. Its `transactions` and `accounts` arrays can be incomplete; they are not a replacement for authoritative history or server write validation.

- **Loading data:** only the ledger, chart of accounts, projects, journal entries, tax rates and rules load when a workspace opens. Any other collection (invoices, bills, customers, payments, bank lines, …) loads the first time a screen asks for it: a component that reads one from `useLedgerStore` must call `useLedgerCollections('invoices', ...)` (`src/hooks/useLedgerCollections.ts`; the list is `src/lib/ledgerCollections.ts`). `ledger-collections-guard.test.ts` fails otherwise. Code that edits a document must not assume its list is loaded (see `savedRecord` in `useEntityOperations.ts`).

### Layer 2: Pure Math Algorithms (`src/lib/algorithms/`)
- Algorithms are 100% pure math functions. They **never** fetch their own data or access state directly.
- They are defined in `src/lib/algorithms/` and must adhere to the `AlgorithmDefinition` interface.
- They receive `(transactions, accounts, inputs)` and return `{ metrics, charts, insights }`.
- **How to Add:** Add a new file in `src/lib/algorithms/`, write your math, and register it in `FINANCIAL_ALGORITHMS` (`src/lib/algorithms/index.ts`).

### Layer 3: UI Lenses & Views (`src/components/`)
- Views are standard React components that render data.
- **How to Add:** Place the view in the appropriate folder (e.g., `src/components/finance/`), then register it in `src/config/registry.tsx`.

## 3. How to Make Changes Fast
- **Want to add a calculation/formula?** Do NOT build a UI. Add an algorithm to `FINANCIAL_ALGORITHMS`. The `ToolSandbox` will automatically generate a UI for it.
- **Want to add a new full-screen dashboard or module?** Add a React component to `src/components/`, then add it to `VIEW_COMPONENTS` and `APP_TABS` inside `src/config/registry.tsx`.
- **Want to add a minor widget to the Intelligence Center?** Add a React component to `src/components/finance/`, then register it in `ANALYTICAL_LENSES_REGISTRY` in `src/config/registry.tsx`.

### Owner's screen rules (5 Oct, apply to every screen, old and new)
- **Edit in place.** A field a user can see on a list or detail page can be changed right there by typing, with the shared `InlineEdit` component (`src/components/ui/InlineEdit.tsx`): Enter or leaving the field saves, Esc cancels, viewers see plain text. No "open another page to change the address". Money and posted amounts still change only through their documents.
- **Related records.** Use the side drawer and typed `RelatedRecordEditButton` beside selectors. Keep the current form mounted and retain its draft; save shared metadata for future use with confirmed, allowlisted writes. Existing native labeled selectors can use Ctrl/Command+Alt+E. Financial fields still use their financial editor/service. See [`docs/DEVELOPER_WORKFLOWS.md`](docs/DEVELOPER_WORKFLOWS.md).
- **Help while typing.** Text fields offer suggestions from the workspace's own data (`suggestions` on `InlineEdit`, or a `datalist`).
- **Pinned pages.** Every page can be pinned; pinned pages show as buttons on every page with keyboard shortcuts (global Header pin control and `PinnedPagesBar`, Alt+P and Alt+1–9). Reuse those controls and registered navigation.

## 4. Modifying Types & Schemas
- Import public domain types from `src/types.ts`; it re-exports the definitions in `src/model/` (ledger, documents, workspace and operations). Extend the owning model module rather than duplicating interfaces in a screen.

## 5. Collection Architecture & Conventions (Supabase Postgres)
- Data lives in Supabase Postgres: one table per collection (`id`, `data` jsonb, `workspace_id`), defined in `supabase/migrations/`. Code keeps a Firestore-style API: `src/lib/db/` (browser, row level security applies) and `src/server/db/pgFirestore.ts` (server, via `getDb()`).
- All core ledger collections (`transactions`, `recurring`, `chartAccounts`, `projects`, `bankLines`, `auditLogs`) are **top-level collections** scoped by a `workspaceId` field.
- Do NOT write transactions or recurring rules to nested subcollections like `workspaces/{id}/transactions` — nested paths are not supported and security rules expect top-level paths.
- A new collection needs a table, an `lf_rules` row and policies in a new migration (`generateEntitySql()` in `src/lib/entityFramework.ts` writes them), plus tests in `supabase/tests/rls.test.sql`.
- Base ledger currency defaults to the workspace currency (or USD if unspecified). Always preserve multi-currency properties (`currency`, `exchangeRate`) when generating entries.

## 6. Core Data Model Invariants & Rules
- **Top-Level Collections Only**: All Firestore collections (`transactions`, `invoices`, `bills`, `chartAccounts`, `projects`, etc.) are TOP-LEVEL collections scoped by a `workspaceId` field. There are NO nested subcollections (e.g. do not use `workspaces/{id}/invoices/{id}`).
- **Absolute Transaction Totals**: `totalAmountCents` is ALWAYS absolute. Transaction direction comes strictly from line items (`lines[]`), never from the sign of `totalAmountCents`.
- **Plural Fixed Categories**: Account categories use a fixed plural vocabulary: `Cash`, `Receivables`, `Payables`, `Fixed Assets`, `COGS`, `Revenue`... Singular variants (e.g. `'Receivable'` or `'Fixed Asset'`) match nothing.
- **Dynamic Role Resolution**: Never hardcode literal account IDs. Resolve roles via `resolveAccountRole(account)` or refuse to post.
- **Postable Filtering**: Every financial report or computation MUST filter transactions with `isPostable()` from `src/lib/txFilters.ts`.

By following this exact pattern, we avoid piling complex logic into React components, and maintain a highly modular, plug-and-play toolkit.

## 7. Detailed instructions and implementation evidence

Read [Developer workflows](docs/DEVELOPER_WORKFLOWS.md) for persistence, inline editing, related-record drawers, page pins, algorithms, mixed Hebrew data and verification recipes. [Tool review](docs/TOOL_REVIEW.md) traces 70 implemented capabilities and concrete limitations to code/tests. Scoped `src/**/AGENTS.md` files provide the applicable implementation contracts. Read the current coordination reservations before changing shared or financial files.
