const fs = require('fs');

let code = fs.readFileSync('src/hooks/useLedgerData.ts', 'utf8');

// Find the transactions listener closing
const txListenerCloseStr = `return () => {\n      unsubTransactions();`;

const replacement = `
    const unsubJournalEntries = onSnapshot(query(collection(db, 'journalEntries'), ...filter, orderBy('timestamp', 'desc'), limit(1000)), (snap) => {
      const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      useLedgerStore.getState().setJournalEntries(entries);
    });

    return () => {
      unsubTransactions();
      unsubJournalEntries();`;

code = code.replace(txListenerCloseStr, replacement);
fs.writeFileSync('src/hooks/useLedgerData.ts', code);
