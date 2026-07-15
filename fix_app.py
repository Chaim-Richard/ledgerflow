import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Add import for LedgerAutoAuditor
content = content.replace(
    "import { RootLayout } from './core/layout/RootLayout';",
    "import { RootLayout } from './core/layout/RootLayout';\nimport { LedgerAutoAuditor } from './components/forensics/LedgerAutoAuditor';"
)

# 2. Remove state bindings in App
content = re.sub(r'  const transactions = useLedgerStore\(state => state\.transactions\);\n', '', content)
content = re.sub(r'  const accounts = useLedgerStore\(state => state\.accounts\);\n', '', content)
content = re.sub(r'  const journalEntries = useLedgerStore\(state => state\.journalEntries\);\n', '', content)
content = re.sub(r'  const projects = useLedgerStore\(state => state\.projects\);\n', '', content)
content = re.sub(r'  const autoRules = useLedgerStore\(state => state\.autoRules\);\n', '', content)

# 3. Fix handleSelectTemplate
content = content.replace(
    "const hasTransactions = transactions.length > 0;",
    "const hasTransactions = useLedgerStore.getState().transactions.length > 0;"
)
content = content.replace(
    "if (accounts.length > 0) {",
    "const currentAccounts = useLedgerStore.getState().accounts;\n        if (currentAccounts.length > 0) {"
)
content = content.replace(
    "accounts.forEach(acc => {",
    "currentAccounts.forEach(acc => {"
)
content = content.replace(
    "const existingCodes = new Set(accounts.map(a => a.code));",
    "const currentAccounts = useLedgerStore.getState().accounts;\n        const existingCodes = new Set(currentAccounts.map(a => a.code));"
)
content = content.replace(
    "const existingNames = new Set(accounts.map(a => (a.name || '').toLowerCase().trim()));",
    "const existingNames = new Set(currentAccounts.map(a => (a.name || '').toLowerCase().trim()));"
)

# 4. Fix handleSaveCurrentTemplate
content = content.replace(
    "accounts: accounts.map(a => ({ code: a.code, name: a.name, type: a.type, category: a.category })),",
    "accounts: useLedgerStore.getState().accounts.map(a => ({ code: a.code, name: a.name, type: a.type, category: a.category })),"
)

# 5. Remove useEffect for runFullAudit
content = re.sub(r'  useEffect\(\(\) => \{\n    if \(transactions\.length > 0 && accounts\.length > 0\) \{\n      useLedgerStore\.getState\(\)\.runFullAudit\(\);\n    \}\n  \}, \[transactions, accounts, journalEntries\]\);\n', '', content)

# 6. Remove portalData
content = re.sub(r'  const portalData = useMemo\(\(\) => \(\{[\s\S]*?\}\), \[.*?\]\);\n', '', content)

# 7. Remove portalData from RootLayout props
content = content.replace(
    "          portalData={portalData} \n",
    ""
)

# 8. Add <LedgerAutoAuditor /> inside RootLayout or anywhere
content = content.replace(
    "<RootLayout ",
    "<LedgerAutoAuditor />\n        <RootLayout "
)

# 9. Fix dependency arrays (remove transactions, accounts from them)
content = re.sub(r'\}, \[user, currentWorkspaceId, accounts, transactions\]\);', '}, [user, currentWorkspaceId]);', content)
content = re.sub(r'\}, \[user, currentWorkspaceId, accounts, transactions, setTemplateSelectorOpen, setActiveTab\]\);', '}, [user, currentWorkspaceId, setTemplateSelectorOpen, setActiveTab]);', content)
content = re.sub(r'\}, \[user, currentWorkspaceId, currentWorkspace, accounts\]\);', '}, [user, currentWorkspaceId, currentWorkspace]);', content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
