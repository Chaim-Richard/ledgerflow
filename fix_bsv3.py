with open('src/components/ledger/BalanceSheetView.tsx', 'r') as f:
    lines = f.readlines()

new_lines = [
    "import React, { useState, useMemo } from 'react';\n",
    "import { useLedgerStore } from '../../stores/useLedgerStore';\n"
]

# find where import { ChartAccount begins
start_idx = 0
for i, line in enumerate(lines):
    if "import { ChartAccount" in line:
        start_idx = i
        break

new_lines.extend(lines[start_idx:])

with open('src/components/ledger/BalanceSheetView.tsx', 'w') as f:
    f.writelines(new_lines)
