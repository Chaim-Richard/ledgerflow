const fs = require('fs');
let code = fs.readFileSync('src/modules/integrity/TruthEngine.ts', 'utf8');

const target = `  static parseAmountToCents(amountString: string | number): number {
    const cleaned = String(amountString).replace(/,/g, '');
    if (!cleaned) return 0;
    try {
      return new Decimal(cleaned).mul(100).round().toNumber();
    } catch (e) {
      return 0; // Fallback on invalid floats instead of NaN
    }
  }`;

const replacement = `  static parseAmountToCents(amountString: string | number): number {
    const cleaned = String(amountString).replace(/,/g, '');
    if (!cleaned) throw new Error('Integrity Violation: Amount cannot be empty');
    try {
      const val = new Decimal(cleaned).mul(100).round().toNumber();
      if (isNaN(val)) throw new Error('Integrity Violation: Parsed amount is NaN');
      return val;
    } catch (e) {
      throw new Error(\`Integrity Violation: Invalid amount format: \${amountString}\`);
    }
  }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/modules/integrity/TruthEngine.ts', code);
console.log("Patched TruthEngine!");
