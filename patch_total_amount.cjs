const fs = require('fs');
let code = fs.readFileSync('src/modules/integrity/TruthEngine.ts', 'utf8');

const helperCode = `
  static deriveSignedTotal(lines: any[], accounts?: any[]): number {
    if (!lines || lines.length === 0) return 0;
    
    if (accounts && accounts.length > 0) {
      const assetLines = lines.filter(l => {
        const acc = accounts.find(a => a.id === l.accountId);
        return acc && acc.type === 'asset';
      });
      if (assetLines.length > 0) {
        return assetLines.reduce((sum, l) => sum + (l.amountCents || 0), 0);
      }
      
      const liabilityLines = lines.filter(l => {
        const acc = accounts.find(a => a.id === l.accountId);
        return acc && acc.type === 'liability';
      });
      if (liabilityLines.length > 0) {
        // Liability increasing (credit/negative) means inflow of cash
        return -liabilityLines.reduce((sum, l) => sum + (l.amountCents || 0), 0);
      }
    }
    
    // Fallback: If no accounts context, assume it's a simple expense entry where credit is the source of funds (negative)
    // We will just find the maximum absolute value and assign it the sign of the asset/bank line if we can guess it.
    // Easiest signed fallback for a balanced entry:
    // If we just want a standard signed metric, and we don't know the accounts, we return the net sum of all debits? No, that's positive.
    // Return the first line's amount if there's only 2 lines.
    return lines[0]?.amountCents || 0;
  }
`;

code = code.replace('static parseAmountToCents', helperCode + '\n  static parseAmountToCents');
fs.writeFileSync('src/modules/integrity/TruthEngine.ts', code);
console.log("Added deriveSignedTotal to TruthEngine!");
