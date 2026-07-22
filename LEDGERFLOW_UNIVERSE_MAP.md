# Unified LedgerFlow Physics & Data Map

## 1. The Global Data Pipeline (The "Truth" Stream)
- **Source of Truth:** Google Cloud Firestore (`transactions`, `chartAccounts`, `journalEntries`).
- **Ingestion (The Synapse):** `useLedgerData.ts` opens a continuous WebSocket stream (`onSnapshot`) to Firebase. It buffers the most recent 5,000 transactions to prevent client OOM (Out Of Memory) crashes.
- **State Machine (The Cache):** `useLedgerStore.ts` (Zustand). All UI views and tools connect *only* to this store.
- **Mutation Path:** When a user alters a transaction, `useTransactionActions.ts` intercepts the call, bypasses the client-side Firebase SDK, and hits `/api/v1/transactions`. The Node.js Express server (`transactionRoutes.ts`) executes a Double-Entry Validation check, writes it to the database inside an ACID transaction, and generates an immutable `journalEntry`.

## 2. The Algorithmic Ecosystem (The "Math" Layer)
Calculations are isolated in strict algorithmic layers, separated from data storage and UI rendering:
1. **The Kernel (`src/kernel/`)**: Pure stateless math functions written in TypeScript. 
   - *Subsystems*: Budgeting, Validation, Forecasting, Metrics, Inventory, and Treasury.
2. **The Lenses (`src/lib/algorithms/`)**: These files wrap the Kernel functions in standard `AlgorithmDefinition` objects, injecting them with live data from Zustand, and mapping the output into standardized `charts` and `metrics`.
3. **The Sandbox (`ToolSandbox.tsx`)**: The UI component that dynamically consumes *any* Lens and renders it mathematically.

## 3. Tool Connectivity & Interoperability
- **The Event Bus / Dispatcher**: `useCommandDispatcher` acts as a centralized brain, catching generic user intents (e.g. `action: 'open-tool'`) and routing them dynamically.
- **The Core Registries (`registry.tsx`)**: All tools, KPIs, terminology, and tabs are registered here. The UI (Sidebar, SubNav) dynamically queries `registry.tsx` to build itself.

## 4. Current Blind Spots & Limitations (Fixed in this patch)
1. **The Memory Horizon Limit**: Previously, advanced calculations (like Anomaly detection) were evaluating *client-side* against the 5,000-record cache. **Limitation**: Any historical analysis beyond the most recent 5k rows was blind.
   - **The Fix**: The `anomalyRouter.ts` has been refactored to query the database natively based on the `workspaceId`. It now bypasses the client cache and acts on the entire dataset.
2. **Client-Driven API Submissions**: Heavy dataset processing was being passed around via HTTP bodies instead of direct DB lookups.
   - **The Fix**: Endpoints now fetch truth directly from Firestore.
