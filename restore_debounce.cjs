const fs = require('fs');
const path = require('path');
let storePath = path.join(__dirname, 'src/stores/useLedgerStore.ts');
let store = fs.readFileSync(storePath, 'utf8');

store = store.replace(
  `  recomputeBalances: () => {
    {`,
  `  recomputeBalances: () => {
    if (typeof window !== 'undefined') {
      if ((window as any)._recomputeTimer) {
        clearTimeout((window as any)._recomputeTimer);
      }
      (window as any)._recomputeTimer = setTimeout(() => {`
);

store = store.replace(
  `      if (changed || get().totalLedgerBalance !== totalBal || currentComputed.length !== nextComputedAccounts.length) {
        set({ 
          computedAccounts: nextComputedAccounts,
          totalLedgerBalance: totalBal
        });
      }
    }
  },`,
  `      if (changed || get().totalLedgerBalance !== totalBal || currentComputed.length !== nextComputedAccounts.length) {
        set({ 
          computedAccounts: nextComputedAccounts,
          totalLedgerBalance: totalBal
        });
      }
      }, 10);
    }
  },`
);

fs.writeFileSync(storePath, store);
