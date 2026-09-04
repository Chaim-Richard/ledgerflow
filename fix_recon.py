import re

with open('src/components/ledger/Reconciliation.tsx', 'r') as f:
    content = f.read()

# 1. Add state
content = content.replace("const [showAutoConfirm, setShowAutoConfirm] = useState(false);", "const [showAutoConfirm, setShowAutoConfirm] = useState(false);\n  const [matchToleranceCents, setMatchToleranceCents] = useState(0);")

# 2. Update logic inside useMemo (we need to inject matchToleranceCents to deps too if possible, but actually we can just replace 150)
content = content.replace("< 150) {", "<= matchToleranceCents) {")
content = content.replace("}, [unmatchedBankLines, unclearedLedgerTransactions, user?.uid]);", "}, [unmatchedBankLines, unclearedLedgerTransactions, user?.uid, matchToleranceCents]);")

# 3. Surface UI
settings_ui = """      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--text)] tracking-tight">Reconciliation Node</h2>
          <p className="text-sm font-bold text-[var(--muted)]">Bond verified external cashflows with internal ledger state.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[var(--surface)] px-3 py-1.5 rounded-lg border border-[var(--line)]">
            <span className="text-xs font-bold text-[var(--muted)]">Tolerance:</span>
            <select 
              value={matchToleranceCents}
              onChange={(e) => setMatchToleranceCents(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-[var(--text)] outline-none"
            >
              <option value={0}>$0.00 (Exact)</option>
              <option value={10}>$0.10</option>
              <option value={50}>$0.50</option>
              <option value={100}>$1.00</option>
              <option value={150}>$1.50</option>
              <option value={500}>$5.00</option>
            </select>
          </div>
"""

content = content.replace("""      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--text)] tracking-tight">Reconciliation Node</h2>
          <p className="text-sm font-bold text-[var(--muted)]">Bond verified external cashflows with internal ledger state.</p>
        </div>
        
        <div className="flex items-center gap-3">""", settings_ui)

# 4. Surface difference when rendering pairs
# We need to find the place where it renders the auto-confirm modal lines or normal suggestion.
# Let's write the modified content back and we can use a separate script if needed.
with open('src/components/ledger/Reconciliation.tsx', 'w') as f:
    f.write(content)

