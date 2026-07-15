const fs = require('fs');
let code = fs.readFileSync('src/hooks/useSnapshotBridge.ts', 'utf8');

code = code.replace(
  'import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";',
  'import { repository } from "../services/repository";'
);
code = code.replace('import { db } from "../firebase";\n', '');

code = code.replace(
  'const snapDoc = doc(db, "ledgerSnapshots", currentWorkspaceId);',
  ''
);

code = code.replace(
  `setDoc(snapDoc, {
        totalIncome: balances.totalIncome.toString(),
        totalExpense: balances.totalExpense.toString(),
        totalBalance: balances.totalBalance.toString(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(console.error);`,
  `repository.createDoc("ledgerSnapshots", {
        totalIncome: balances.totalIncome.toString(),
        totalExpense: balances.totalExpense.toString(),
        totalBalance: balances.totalBalance.toString(),
        updatedAt: new Date().toISOString()
      }, currentWorkspaceId).catch(console.error);`
);

code = code.replace(
  `const snapDoc = doc(db, "ledgerSnapshots", workspaceId);
  try {
    const snap = await getDoc(snapDoc);
    if (snap.exists()) {
      return snap.data();
    }
  } catch(e) {
    console.warn("Bridge missing:", e);
  }`,
  `try {
    const data = await repository.getDoc("ledgerSnapshots", workspaceId);
    if (data) {
      return data;
    }
  } catch(e) {
    console.warn("Bridge missing:", e);
  }`
);

fs.writeFileSync('src/hooks/useSnapshotBridge.ts', code);
