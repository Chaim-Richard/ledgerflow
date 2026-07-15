import re
with open('src/components/ledger/BalanceSheetView.tsx', 'r') as f:
    content = f.read()

content = re.sub(r"import React,import \{ useLedgerStore \} from '\.\./\.\./stores/useLedgerStore'; \{ useState, useMemo \} from 'react';", "import React, { useState, useMemo } from 'react';\nimport { useLedgerStore } from '../../stores/useLedgerStore';", content)

with open('src/components/ledger/BalanceSheetView.tsx', 'w') as f:
    f.write(content)
