const fs = require('fs');
let code = fs.readFileSync('src/server/routes/transactionRoutes.ts', 'utf8');

const target = `DoubleEntryValidator.validateJournalEntry(transaction);`;
const rep = `DoubleEntryValidator.validateJournalEntry(transaction);
    
    // Standardize totalAmountCents
    if (!transaction.totalAmountCents) {
       // We can't fetch accounts here synchronously easily without a big refactor, 
       // but the client should have already set it. If not, fallback:
       transaction.totalAmountCents = transaction.lines[0]?.amountCents || 0;
    }`;

code = code.replace(target, rep);
fs.writeFileSync('src/server/routes/transactionRoutes.ts', code);
console.log("Patched transactionRoutes.ts!");
