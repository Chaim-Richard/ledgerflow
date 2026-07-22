# Comprehensive System Audit & Architecture Map (Updated)

## 1. Executive Summary
This document provides a deep, code-level analysis of the LedgerFlow ERP system after the recent architectural security patches. It maps the true data flow, the algorithmic ecosystem, the interplay between server and client, and highlights the updated architectural decisions.

## 2. Data Flow & Synchronization Architecture
The application has transitioned to a **Hybrid "Thick-Client" / Full-Stack API** model. 
Read operations rely on real-time Firebase sync, while critical write operations have been secured via the Express API.

**The Complete Flow:**
1. **Remote Storage (Firestore):** The database acts as the central source of truth (`transactions`, `chartAccounts`, `projects`, etc.).
2. **Real-Time Bridge (`src/hooks/useLedgerData.ts`):** 
   - Uses WebSocket listeners (`onSnapshot`) to stream real-time updates directly into Zustand.
3. **Client-Side Cache (`src/stores/useLedgerStore.ts`):** 
   - Acts as an in-memory database for rapid React UI rendering.
4. **Secured Mutation Path (`src/hooks/useTransactionActions.ts` -> `/api/v1/transactions`):** 
   - When a user saves or modifies a transaction, the UI no longer uses the Firebase SDK `setDoc` or `updateDoc` directly.
   - It issues an authenticated HTTP `POST` or `PUT` to the Node.js Express server (`/api/v1/transactions`).
   - The Server (`src/server/routes/transactionRoutes.ts`) performs strict cryptographic Double-Entry Integrity checks (`DoubleEntryValidator.validateJournalEntry`).
   - The Server executes an ACID-compliant Firestore Transaction (`db.runTransaction`) to guarantee balance safety, preventing race conditions.
   - The Server concurrently logs raw ledger events into `journalEntries` (Event Sourcing).
   - Once the write completes, Firestore triggers `onSnapshot`, automatically updating the UI.

## 3. Algorithm & Tool Ecosystem Map
The system separates analytical complexities into three distinct layers.

### Layer A: The Kernel (`src/kernel/`)
Stateless TypeScript classes that have zero knowledge of databases.
- **Validation Engines:** `DoubleEntryValidator`, `AnomalyDetectionEngine`, `DuplicateDetectionEngine`, `OrphanDetectionEngine`.
- **Financial Metrics:** `AltmanZScoreEngine`, `LiquidityEngine`, `WaccEngine`, `EbitdaEngine`, `FinancialRatiosEngine`.
- **Operational Math:** `EoqEngine` (Inventory), `DepreciationEngine`, `AmortizationEngine`, `MacrsEngine`.

### Layer B: Algorithmic Lenses (`src/lib/algorithms/`)
Wrappers (`AlgorithmDefinition`) that bridge the raw Kernels to the Zustand data cache.
- **Data Ingestion:** Lenses extract raw `transactions` and `accounts` from Zustand.
- **Execution:** Feed the data into the Kernel engines.
- **Formatting:** Format the output into standard `metrics`, `charts`, and `insights`.

### Layer C: The UI Sandbox (`ToolSandbox.tsx` & `IntelligenceCenter.tsx`)
A dynamic React component that renders any Algorithmic Lens. It automatically builds input sliders based on `AlgorithmDefinition.inputs` and renders Recharts dynamically.

## 4. The Server-Client Dichotomy (Resolved)
Previously, the Node.js Express backend (`server.ts`) presented a massive routing structure that was largely bypassed by the client. 

**Current State:**
- **AI Processing (`src/services/aiBackendService.ts`):** Handles `@google/genai` requests via `/api/ai/process` with SHA-256 caching.
- **Background Workers (`src/server/workers/anomalyWorker.ts`):** Scans for anomalies in detached threads.
- **Financial Write Operations:** Fully integrated! All transaction creations, edits, bulk updates, and reconciliations are now routed exclusively through the Express API (`/api/v1/transactions`).

## 5. Security & System Integrity Upgrades
The critical vulnerabilities identified in the previous audit have been **resolved**:

### A. Client-Side Validation Bypass (Fixed)
- **Previous Risk:** `firestore.rules` allowed authenticated users to bypass the Double-Entry checks and inject corrupted transactions via REST API.
- **The Fix:** `transactions` rules have been locked down (`allow create: if false; allow update: if false;`). Write operations are re-routed to the Backend Server validation layer.

### B. Concurrency & Race Conditions (Fixed)
- **Previous Risk:** Client-side updates could result in ledger drift if multiple users saved concurrently.
- **The Fix:** The backend `/api/v1/transactions` and `/api/v1/transactions/reconcile` endpoints now use `db.runTransaction()` and `db.batch()` to ensure true ACID compliance across the ledger network.

### C. The Event Sourcing Disconnect (Fixed)
- **Previous Risk:** The immutable audit trail was modeled in the kernel but bypassed in the UI data flow.
- **The Fix:** The backend `/api/v1/transactions` route now actively appends individual immutable entries to `journalEntries` every time a transaction is recorded, establishing a cryptographically verifiable trail.

## 6. Remaining Limitations (For Future Scalability)

### The Memory Limit Horizon (Data Proximity)
- **The Issue:** `useLedgerData.ts` streams a maximum of 5,000 transactions to the client to prevent browser OOM (Out Of Memory) crashes.
- **The Limitation:** Because complex forecasting and forensic algorithms (e.g., Benford's Law, Monte Carlo VaR) execute *client-side* against this Zustand cache, they only analyze the most recent 5,000 records. They are blind to older historical data.
- **The Next Step:** To achieve true enterprise maturity for ledgers with 1M+ rows, these specific analytical lenses must be transitioned to execute asynchronously on the backend (e.g., in Python or Node worker threads) directly against the full Firestore dataset or BigQuery, pushing only the final analytical aggregates to the UI.
