const fs = require('fs');
const path = require('path');

// 1. types.ts
let typesPath = path.join(__dirname, 'src/types.ts');
let types = fs.readFileSync(typesPath, 'utf8');
types = types.replace(
  "type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';",
  "type: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_goods' | 'revenue';"
);
fs.writeFileSync(typesPath, types);

// 2. LedgerEngine.ts
let ledgerEnginePath = path.join(__dirname, 'src/kernel/ledger/LedgerEngine.ts');
let ledgerEngine = fs.readFileSync(ledgerEnginePath, 'utf8');
ledgerEngine = ledgerEngine.replace(
  "const isDebit = acc.type === 'asset' || acc.type === 'expense';",
  "const isDebit = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';"
);
ledgerEngine = ledgerEngine.replace(
  "const debit = typeof line.debit === 'number' && Number.isSafeInteger(line.debit) ? line.debit : 0;",
  "const debit = typeof line.debit === 'number' ? Math.round(line.debit * 100) : 0;"
);
ledgerEngine = ledgerEngine.replace(
  "const credit = typeof line.credit === 'number' && Number.isSafeInteger(line.credit) ? line.credit : 0;",
  "const credit = typeof line.credit === 'number' ? Math.round(line.credit * 100) : 0;"
);
fs.writeFileSync(ledgerEnginePath, ledgerEngine);

// 3. useLedgerStore.ts (remove setTimeout race condition)
let storePath = path.join(__dirname, 'src/stores/useLedgerStore.ts');
let store = fs.readFileSync(storePath, 'utf8');
store = store.replace(
  `  recomputeBalances: () => {
    if ((window as any)._recomputeTimer) {
      clearTimeout((window as any)._recomputeTimer);
    }
    
    (window as any)._recomputeTimer = setTimeout(() => {`,
  `  recomputeBalances: () => {
    {`
);
store = store.replace(
  `      }
    }, 10);
  },`,
  `      }
    }
  },`
);
fs.writeFileSync(storePath, store);

// 4. services/auditor.ts (Hash chain sort order and raw currency scale)
let auditorPath = path.join(__dirname, 'src/services/auditor.ts');
let auditor = fs.readFileSync(auditorPath, 'utf8');
auditor = auditor.replace(
  `.sort((a, b) => a.time - b.time)`,
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return a.t ? a.t.id.localeCompare(b.t.id) : (a.tx ? a.tx.id.localeCompare(b.tx.id) : 0); })`
);
auditor = auditor.replace(
  `.sort((a, b) => a.time - b.time)`,
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return a.t ? a.t.id.localeCompare(b.t.id) : (a.tx ? a.tx.id.localeCompare(b.tx.id) : 0); })`
);
auditor = auditor.replace(
  `totalDebits += entryDebit;
      totalCredits += entryCredit;`,
  `totalDebits += Math.round(entryDebit * 100);
      totalCredits += Math.round(entryCredit * 100);`
);
fs.writeFileSync(auditorPath, auditor);

// 5. DoubleEntryValidator.ts (remove fx-rounding mutation duplication)
let validatorPath = path.join(__dirname, 'src/kernel/validation/DoubleEntryValidator.ts');
let validator = fs.readFileSync(validatorPath, 'utf8');
validator = validator.replace(
  `const netImpact = transaction.lines.reduce((sum, line) => {`,
  `transaction.lines = transaction.lines.filter(l => l.accountId !== 'fx-rounding');
    const netImpact = transaction.lines.reduce((sum, line) => {`
);
fs.writeFileSync(validatorPath, validator);

// 6. ReferentialIntegrityEngine.ts
let refPath = path.join(__dirname, 'src/kernel/validation/ReferentialIntegrityEngine.ts');
if (fs.existsSync(refPath)) {
  let ref = fs.readFileSync(refPath, 'utf8');
  // It's not actually used here for account deletion, but we can fix it anyway
}

// Fix useTransactionActions.ts for account deletion (include journal entries)
let txActionsPath = path.join(__dirname, 'src/hooks/useTransactionActions.ts');
let txActions = fs.readFileSync(txActionsPath, 'utf8');
txActions = txActions.replace(
  `const txs = useLedgerStore.getState().transactions;
    const linkedTxs = txs.filter(t => t.lines?.some(l => l.accountId === id));
    const hasTransactions = linkedTxs.length > 0;`,
  `const txs = useLedgerStore.getState().transactions;
    const jes = useLedgerStore.getState().journalEntries;
    const linkedTxs = txs.filter(t => t.lines?.some(l => l.accountId === id));
    const linkedJes = jes.filter(j => j.lines?.some(l => l.accountId === id));
    const hasTransactions = linkedTxs.length > 0 || linkedJes.length > 0;`
);
txActions = txActions.replace(
  `has \${linkedTxs.length} historical transactions`,
  `has \${linkedTxs.length + linkedJes.length} historical records`
);
fs.writeFileSync(txActionsPath, txActions);

// 7. subset-sum.ts (Iteration limit)
let subsetPath = path.join(__dirname, 'src/lib/algorithms/subset-sum.ts');
let subset = fs.readFileSync(subsetPath, 'utf8');
subset = subset.replace(
  `let bestMatch: { id: string }[] | null = null;
    
  // Backtracking branch and bound
  function backtrack(index: number, currentSum: number, currentSet: { id: string }[]) {
    if (bestMatch) return; // Found exact or acceptable match`,
  `let bestMatch: { id: string }[] | null = null;
  let iterations = 0;
  const MAX_ITERATIONS = 50000;
    
  // Backtracking branch and bound
  function backtrack(index: number, currentSum: number, currentSet: { id: string }[]) {
    if (bestMatch || iterations++ > MAX_ITERATIONS) return; // Found exact or acceptable match`
);
fs.writeFileSync(subsetPath, subset);

// 8. BenfordsLawEngine.ts (First digit zero fix)
let benfordPath = path.join(__dirname, 'src/kernel/validation/BenfordsLawEngine.ts');
let benford = fs.readFileSync(benfordPath, 'utf8');
benford = benford.replace(
  `      if (absNum >= 1) {
        const firstDigit = parseInt(absNum.toString().charAt(0), 10);
        if (firstDigit >= 1 && firstDigit <= 9) {
          counts[firstDigit]++;
          totalValid++;
        }
      }`,
  `      let strNum = absNum.toString().replace(/[^1-9]/g, '');
      if (strNum.length > 0) {
        const firstDigit = parseInt(strNum.charAt(0), 10);
        if (firstDigit >= 1 && firstDigit <= 9) {
          counts[firstDigit]++;
          totalValid++;
        }
      }`
);
fs.writeFileSync(benfordPath, benford);

console.log('Patches applied successfully!');
