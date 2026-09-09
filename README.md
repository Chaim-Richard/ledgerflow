# LedgerFlow Enterprise ERP

LedgerFlow is an Enterprise Resource Planning (ERP) and Financial Ledger system built with React 18, Vite, Tailwind CSS, and Zustand. It features real-time double-entry ledger accounting, zero-configuration plugin views, and pure financial algorithm tools.

## Architecture & System Overview

All tools and views are organized into three strict layers:

1. **Layer 1: Data Source of Truth (Zustand & Firestore)**
   - Core financial data is stored in `useLedgerStore` (`src/stores/useLedgerStore.ts`).
   - The primary data sources are top-level Firestore collections (`transactions`, `accounts`, `invoices`, `bills`, `projects`, `recurring`) scoped strictly by `workspaceId`.

2. **Layer 2: Pure Math Algorithms (`src/lib/algorithms/`)**
   - Pure, deterministic financial algorithms receiving an `AlgorithmContext` (`{ transactions, accounts, period, asOfDate, reportingCurrency }`) and returning `{ metrics, charts, insights }`.
   - Registered centrally in `FINANCIAL_ALGORITHMS` (`src/lib/algorithms/index.ts`).

3. **Layer 3: Dynamic Views & Registries (`src/config/registry.tsx`)**
   - Standard React components registered under `VIEW_COMPONENTS` and navigation registries in `src/config/registry.tsx`.
   - Plug-and-play components dropped into `src/plugins/` are automatically scanned and mounted.

## Common Developer Tasks

### 1. Adding a Financial Algorithm
- Create your algorithm file in `src/lib/algorithms/your-algorithm.ts`.
- Export an `AlgorithmDefinition` implementing `compute: (ctx, inputs) => AlgoResult`.
- Register it in `src/lib/algorithms/index.ts`. It will automatically appear in the Tool Sandbox.

### 2. Adding a New View
- **Plugin Option (Zero Configuration):** Create `src/plugins/MyTool.tsx` exporting `config` and a default React component. It is auto-discovered via `import.meta.glob`.
- **Core View Option:** Add your component under `src/components/`, register it lazily in `VIEW_COMPONENTS` inside `src/config/registry.tsx`, and add its tab definition to `NAV_GROUPS`.

### 3. Modifying Types & Schemas
- `src/types.ts` is the single source of truth for TypeScript interfaces (`Transaction`, `ChartAccount`, `Invoice`, etc.).
- `src/schemas.ts` defines Zod validation schemas for API endpoints.

## CLI Commands

```bash
npm run dev              # Start Vite dev server on port 3000
npm run build            # Full production build
npm run lint             # Run tsc and eslint
npm test                 # Run test suite
npm run grant-admin <uid-or-email> # Grant platform admin claim and update user profile
npm run scaffold:plugin  # Scaffold a new plugin component
npm run scaffold:algo    # Scaffold a new algorithm
```
