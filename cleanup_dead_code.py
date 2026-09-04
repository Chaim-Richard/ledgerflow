import os
import re
import shutil

dead_files = [
    "src/components/forensics/tabs/EconomicsMatrixTab.tsx",
    "src/components/forensics/ForensicChart.tsx",
    "src/components/forensics/tabs/AuditTab.tsx",
    "src/components/forensics/tabs/TracerTab.tsx",
    "src/components/forensics/tabs/CashReconcilerTab.tsx",
    "src/components/forensics/tabs/BookClosureTab.tsx",
    "src/components/intelligence/SystemSearch.tsx",
    "src/components/forensics/tabs/SymmetryTab.tsx",
    "src/components/intelligence/AlgorithmicTruth.tsx",
    "src/lib/business-expenses.ts",
    "src/kernel/reporting/MaterializedViews.ts",
    "src/components/layout/ContextualToolbelt.tsx",
    "src/services/cortexService.ts",
    "src/components/intelligence/DataNetworkMesh.tsx",
    "src/hooks/useSituationTelemetry.ts",
    "src/lib/algorithms/fuzzy.ts",
    "src/kernel/validation/ReconciliationLayer.ts",
    "src/components/platform/ConnectivityMonitor.tsx",
    "src/lib/stats-helpers.ts",
    "src/hooks/useInstallApp.ts",
    "src/services/LedgerService.ts",
    "src/components/platform/Collaborators.tsx",
    "src/kernel/validation/DuplicateDetectionEngine.ts",
    "src/kernel/validation/BenfordsLawEngine.ts",
    "src/kernel/validation/OrphanDetectionEngine.ts",
    "src/components/platform/PrivacyValue.tsx",
    "src/kernel/validation/ReferentialIntegrityEngine.ts",
    "src/constants/accounting.ts",
    "src/services/InvoiceService.ts",
    "src/server/workers/anomalyWorker.ts"
]

for f in dead_files:
    if os.path.exists(f):
        os.remove(f)
        print(f"Removed {f}")
    else:
        print(f"Not found: {f}")

# Also clean up forensics tabs folder if empty
tabs_dir = "src/components/forensics/tabs"
if os.path.exists(tabs_dir) and not os.listdir(tabs_dir):
    os.rmdir(tabs_dir)
    print("Removed empty forensics tabs directory.")

