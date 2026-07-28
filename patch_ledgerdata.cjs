const fs = require('fs');
let code = fs.readFileSync('src/hooks/useLedgerData.ts', 'utf8');

if (!code.includes('limit(5000)')) {
  code = code.replace(
    /onSnapshot\(query\(collection\(db, 'transactions'\), \.\.\.filter, orderBy\('date', 'desc'\), \), \(snap\)/g,
    "onSnapshot(query(collection(db, 'transactions'), ...filter, orderBy('date', 'desc'), limit(5000)), (snap)"
  );

  if (!code.includes('import { collection,')) {
      // it should be already there
  }
  
  if (!code.includes('limit')) {
    code = code.replace('orderBy,', 'orderBy, limit,');
    if (!code.includes('limit,')) {
       code = code.replace("import { collection, doc, onSnapshot,", "import { collection, doc, onSnapshot, limit,");
    }
  }

  fs.writeFileSync('src/hooks/useLedgerData.ts', code);
}
