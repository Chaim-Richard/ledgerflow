# Project Architecture and Modification Guide

## System Overview
This project is an advanced Enterprise Resource Planning (ERP) and Financial Ledger system built with React, Vite, and Tailwind CSS. It uses client-side state management and features a plugin-based architecture for dynamic views.

## How to Make Changes Fast

### 1. Adding a New View / Component
- **Location:** Place new major views in their respective category folder under `src/components/` (e.g., `src/components/finance/`, `src/components/ledger/`).
- **Registration:** Open `src/config/registry.tsx`.
  - Add your component to `VIEW_COMPONENTS` using `lazy(() => import('...'))`.
  - Add a tab definition to the appropriate registry (e.g., `APP_TABS`, `REPORT_TABS_REGISTRY`, `SETTINGS_TABS_REGISTRY`).

### 2. Adding a New Financial Algorithm
- **Location:** The math and logic live in `src/lib/algorithms/`.
- **How:** Create a new file (e.g., `my-algo.ts`), define your `AlgorithmDefinition` (inputs, metrics, charts, insights), and export it.
- **Registration:** Open `src/lib/algorithms/index.ts` and add your imported algorithm to the `FINANCIAL_ALGORITHMS` dictionary.

### 3. Modifying Navigation & Menus
- **Location:** Navigation grouping is defined in `src/config/registry.tsx` within `NAV_GROUPS`.
- **Glossary:** If you add new terminology, update `SYSTEM_GLOSSARY`.

### 4. Modifying Types & Schemas
- **Location:** `src/types.ts` is the single source of truth for interfaces (e.g., `Transaction`, `Project`, `Invoice`).

### 5. Plugins
- **Location:** Drop standalone tools in `src/plugins/`. They are automatically picked up by `import.meta.glob('../plugins/*.tsx')` in the registry.

## AI Instructions
- Always refer to `src/config/registry.tsx` when adding or removing features.
- Keep components modular. If a file exceeds 1000 lines, consider breaking it into subcomponents.
- Use the `FINANCIAL_ALGORITHMS` index when interacting with the Tool Sandbox.

### 6. Where is the Source of Truth?
- **Data Truth:** The source of truth for all ledger data is the `Transaction[]` and `ChartAccount[]` arrays in the main application state (`useLedgerStore`, though injected where needed). 
- **Algorithms:** When an algorithm or tool runs, it receives a direct injection of `transactions` and `accounts` in its `compute` function. The tool should *never* fetch state itself; it should remain a pure function deriving insights solely from its inputs. This guarantees reproducibility and easy testing.
