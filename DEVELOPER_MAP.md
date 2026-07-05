# LedgerFlow Developer Map: Physics of the Codebase

Welcome to LedgerFlow. This codebase is crafted to achieve near-zero friction for changes, editing, and extensions over time.

---

## 🗺️ Architectural Philosophy
Every button, card, text string, and tool behaves like a modular, self-aware piece of a larger puzzle. 

1. **Centralized Configuration**: All layout definitions, KPI configurations, navigation paths, and translations are located in a single file: `/src/config/registry.tsx`.
2. **Zero-Configuration Plugins**: To add a new tab/tool, you do **not** edit any import statements or routers. Simply drop a `.tsx` file into `/src/plugins/`.
3. **No Hardcoded UI Strings**: All visual text elements use the `<LexiconText>` component or look up from `SYSTEM_GLOSSARY` in `registry.tsx` for instant developer modification.
4. **Isolated Project Contexts**: Data collections are strictly partitioned at the query level by `workspaceId`.

---

## 🛠️ How-To: Perform Common Modifications

### 1. How to Edit Any Text or Translating in the App
Never search fifty files for a hardcoded label. 
* **Global Translations File**: Open `/src/config/registry.tsx` and locate the `SYSTEM_GLOSSARY` mapping. 
* **Inline Components**: Elements across the app are wrapped inside `<LexiconText cardKey="my.key" defaultVal="Standard English Label" />`. 
* **Editing UI Vocabulary**:
  ```tsx
  // Example entry in SYSTEM_GLOSSARY
  'header.hub': { en: 'HUB', he: 'מרכז בקרה' }
  ```

### 2. How to Add a New Tab / Tool to the Sidebar & Navigation
LedgerFlow uses dynamic workspace-aware routes.
* **Option A: The Plugin Way (Zero Configuration)**:
  1. Create a file under `/src/plugins/MyNewComponent.tsx`.
  2. Export a config file and default component:
     ```tsx
     import React from 'react';
     import { Sparkles } from 'lucide-react';
     import { useSystemProps, useCommandDispatcher } from '../hooks/useSystemContext';

     export const config = {
       id: 'my-lightning-plugin',
       label: { en: 'Instant Tool', he: 'כלי מהיר' },
       icon: Sparkles,
       groupId: 'insights', // 'insights' | 'operations' | 'audit_system'
     };

     export default function InstantTool() {
       const { handleAction } = useCommandDispatcher();
       const props = useSystemProps(handleAction);
       return (
         <div className="p-10">
           <h1 className="text-3xl font-black uppercase">My Instant Tool</h1>
         </div>
       );
     }
     ```
  3. The applet automatically scans the directory, registers the tab, adds it to the correct sidebar group, and setups the dynamic view.

* **Option B: Core View Registries (Static Routing)**:
  1. Open `/src/config/registry.tsx`.
  2. Locate `CORE_TAB_GROUPS` to position/add the tab in the sidebar layout.
  3. Map your component lazily under the `VIEW_COMPONENTS` dictionary in `registry.tsx`.

### 3. How to Add or Change a Dashboard KPI Card
Dashboard metrics are built declaratively.
* **Open File**: `/src/config/registry.tsx`.
* **Registry Array**: Locating `DASHBOARD_KPI_REGISTRY`. 
* **Adding a KPI Card**:
  ```tsx
  {
    id: 'my-performance-kpi',
    label: { en: 'Capital Yield', he: 'תשואת הון' },
    getValue: (metrics) => metrics.customYield || 0,
    format: 'currency',
    bg: 'bg-indigo-50/50',
    border: 'border-indigo-100',
    iconColor: 'text-indigo-600',
    icon: Sparkles,
    trendType: 'positive',
    action: 'open-yield-center' // central dispatcher handling
  }
  ```
The dashboard handles layout grid mapping, currency formatting, dark/light theme classes, interactive trend line rendering, and onClick action dispatching automatically.

### 4. How to Connect UI Components to Real-Time Data (Zustand & Firebase)
* **Single Unified Interface**: Use the custom hook `useSystemProps(handleAction)` or pull directly from `useLedgerStore` in `/src/stores/useLedgerStore.ts`.
* All list elements—`transactions`, `accounts`, `projects`, etc.—are populated via real-time snapshots in `/src/hooks/useLedgerData.ts` and locked strictly under the `workspaceId === currentWorkspaceId` boundary to prevent cross-workspace data leakage.

---

## 🗂️ Map of Key Directories & Files

```bash
├── src/
│   ├── config/
│   │   └── registry.tsx            # <--- THE SINGLE SOURCE OF SYSTEM TRUTH (KPIs, Tabs, Lenses, Glossary)
│   ├── plugins/
│   │   └── *.tsx                   # <--- Drop plug-and-play components here
│   ├── hooks/
│   │   ├── useLexicon.tsx          # Localization translator & dev inline text controllers
│   │   ├── useLedgerData.ts        # Database listeners (workspace-isolated)
│   │   └── useSystemContext.ts     # System environment bridges
│   ├── stores/
│   │   ├── useLedgerStore.ts       # Performance state machine
│   │   └── useUIStore.ts           # Presentation controls
│   ├── types.ts                    # Deep structural interfaces
│   └── App.tsx                     # Top-level coordinator
```
