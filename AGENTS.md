# Project Architecture and Modification Guide

## 1. System Overview
This project is an advanced Enterprise Resource Planning (ERP) and Financial Ledger system built with React, Vite, and Tailwind CSS. It uses client-side state management (Zustand) and features a dynamic registry architecture for views, algorithms, and analytical lenses.

## 2. The Tool Ecosystem & Data Flow
To ensure complexity does not grow over time, all "tools" are separated into three strict layers. You can view a live visualization of this by clicking **Architecture Map** in the app sidebar.

### Layer 1: Data Source of Truth (Zustand)
- All financial data is stored in `useLedgerStore` (`src/stores/useLedgerStore.ts`).
- The canonical sources of truth are the arrays: `transactions: Transaction[]` and `accounts: ChartAccount[]`.

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

## 4. Modifying Types & Schemas
- `src/types.ts` is the single source of truth for interfaces (e.g., `Transaction`, `ChartAccount`).

## 5. Firestore Collection Architecture & Conventions
- All core ledger collections (`transactions`, `recurring`, `chartAccounts`, `projects`, `bankLines`, `auditLogs`) are **top-level collections** scoped by a `workspaceId` field.
- Do NOT write transactions or recurring rules to nested subcollections like `workspaces/{id}/transactions` — top-level queries and security rules expect top-level paths.
- Base ledger currency defaults to the workspace currency (or USD if unspecified). Always preserve multi-currency properties (`currency`, `exchangeRate`) when generating entries.

## 6. Core Data Model Invariants & Rules
- **Top-Level Collections Only**: All Firestore collections (`transactions`, `invoices`, `bills`, `chartAccounts`, `projects`, etc.) are TOP-LEVEL collections scoped by a `workspaceId` field. There are NO nested subcollections (e.g. do not use `workspaces/{id}/invoices/{id}`).
- **Absolute Transaction Totals**: `totalAmountCents` is ALWAYS absolute. Transaction direction comes strictly from line items (`lines[]`), never from the sign of `totalAmountCents`.
- **Plural Fixed Categories**: Account categories use a fixed plural vocabulary: `Cash`, `Receivables`, `Payables`, `Fixed Assets`, `COGS`, `Revenue`... Singular variants (e.g. `'Receivable'` or `'Fixed Asset'`) match nothing.
- **Dynamic Role Resolution**: Never hardcode literal account IDs. Resolve roles via `resolveAccountRole(account)` or refuse to post.
- **Postable Filtering**: Every financial report or computation MUST filter transactions with `isPostable()` from `src/lib/txFilters.ts`.

By following this exact pattern, we avoid piling complex logic into React components, and maintain a highly modular, plug-and-play toolkit.
