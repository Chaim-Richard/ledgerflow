import re

with open('src/components/ledger/StatementImporter.tsx', 'r') as f:
    content = f.read()

map_columns_old = """  const handleMapColumns = () => {
    if (mapping.date === -1 || mapping.description === -1 || mapping.amount === -1) {
      toast.error("Please map all required columns (Date, Description, Amount)");
      return;
    }

    const dataRows = csvData.slice(1); // Assume first row is header
    const results = dataRows.map(row => {
      const amountStr = row[mapping.amount]?.replace(/[$,]/g, '');
      const amountCents = TruthEngine.parseAmountToCents(amountStr || '0');
      return {
        date: row[mapping.date],
        description: row[mapping.description],
        amountCents
      };
    }).filter(tx => tx.date && tx.description && !isNaN(tx.amountCents));

    processResults(results);
  };"""

map_columns_new = """  const normalizeDateString = (dateStr: string): string => {
    if (!dateStr) return '';
    const s = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const usMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (usMatch) {
      let [_, m, d, y] = usMatch;
      if (y.length === 2) {
        y = parseInt(y) > 50 ? '19' + y : '20' + y;
      }
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return '';
  };

  const [skippedCount, setSkippedCount] = useState(0);

  const handleMapColumns = () => {
    const hasAmount = mapping.amount !== -1;
    const hasDebitCredit = (mapping as any).debit !== -1 && (mapping as any).credit !== -1;
    
    if (mapping.date === -1 || mapping.description === -1 || (!hasAmount && !hasDebitCredit)) {
      toast.error("Please map Date, Description, and either Amount OR Debit & Credit.");
      return;
    }

    const dataRows = csvData.slice((mapping as any).skipRows !== undefined ? (mapping as any).skipRows : 1);
    
    let skipped = 0;
    
    const results = dataRows.map(row => {
      let amountCents = 0;
      if (hasAmount) {
        const amountStr = row[mapping.amount]?.replace(/[$,]/g, '');
        amountCents = TruthEngine.parseAmountToCents(amountStr || '0');
      } else {
        const debitStr = row[(mapping as any).debit]?.replace(/[$,]/g, '');
        const creditStr = row[(mapping as any).credit]?.replace(/[$,]/g, '');
        const debit = TruthEngine.parseAmountToCents(debitStr || '0');
        const credit = TruthEngine.parseAmountToCents(creditStr || '0');
        amountCents = credit - debit;
      }
      
      const rawDate = row[mapping.date];
      const date = normalizeDateString(rawDate);
      
      const descArr = [row[mapping.description]];
      if ((mapping as any).payee !== undefined && (mapping as any).payee !== -1 && row[(mapping as any).payee]) {
        descArr.push(row[(mapping as any).payee]);
      }
      if ((mapping as any).memo !== undefined && (mapping as any).memo !== -1 && row[(mapping as any).memo]) {
        descArr.push(row[(mapping as any).memo]);
      }
      
      return {
        date,
        description: descArr.filter(Boolean).join(' - '),
        amountCents,
        _originalDate: rawDate
      };
    }).filter(tx => {
      const isValid = tx.date && tx.description && !isNaN(tx.amountCents);
      if (!isValid) skipped++;
      return isValid;
    });

    setSkippedCount(skipped);
    processResults(results);
  };"""

content = content.replace(map_columns_old, map_columns_new)

state_old = "const [mapping, setMapping] = useState({ date: -1, description: -1, amount: -1 });"
state_new = "const [mapping, setMapping] = useState({ date: -1, description: -1, amount: -1, debit: -1, credit: -1, payee: -1, memo: -1, skipRows: 1 });"
content = content.replace(state_old, state_new)

ui_old = "(['date', 'description', 'amount'] as const).map(field => ("
ui_new = "(['date', 'description', 'amount', 'debit', 'credit', 'payee', 'memo'] as const).map(field => ("
content = content.replace(ui_old, ui_new)

header_skip_ui = """                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3 md:col-span-3">
                    <label className="micro-label !text-[var(--text)]">Header Rows to Skip</label>
                    <input type="number" min="0" value={(mapping as any).skipRows} onChange={(e) => setMapping({...mapping, skipRows: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl font-bold text-sm text-[var(--text)] outline-none focus:border-[var(--brass-line)]" />
                  </div>"""

content = content.replace("""                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">""", header_skip_ui)

review_old = """                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black mb-1 uppercase tracking-tight">Review Extraction</h3>
                      <p className="text-xs text-[var(--muted)] font-medium">Verify data integrity before final ledger committal.</p>
                    </div>"""
review_new = """                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black mb-1 uppercase tracking-tight">Review Extraction</h3>
                      <p className="text-xs text-[var(--muted)] font-medium">Verify data integrity before final ledger committal.</p>
                      {skippedCount > 0 && <p className="text-xs text-red-500 font-bold mt-2 bg-red-500/10 inline-block px-2 py-1 rounded">Skipped {skippedCount} invalid rows (e.g., missing date or amount).</p>}
                    </div>"""
content = content.replace(review_old, review_new)

with open('src/components/ledger/StatementImporter.tsx', 'w') as f:
    f.write(content)
