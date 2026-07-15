const fs = require('fs');
let file = fs.readFileSync('src/components/operations/EsgLedger.tsx', 'utf8');

const fakeData = `  const data = [
    { month: 'Jan', co2: 4120 },
    { month: 'Feb', co2: 3850 },
    { month: 'Mar', co2: 4300 },
    { month: 'Apr', co2: 3900 },
    { month: 'May', co2: 3600 },
    { month: 'Jun', co2: totalEmissions / 10 },
  ];`;

const realData = `  const data = transactions.reduce((acc, tx) => {
    const month = new Date(tx.date).toLocaleString('default', { month: 'short' });
    const existing = acc.find(a => a.month === month);
    // Estimate: $1000 = ~120kg CO2e based on general scope 3
    const emission = tx.lines.reduce((s, l) => s + (l.debit || 0), 0) * 0.12; 
    if (existing) {
      existing.co2 += emission;
    } else {
      acc.push({ month, co2: emission });
    }
    return acc;
  }, [] as { month: string, co2: number }[]).slice(-6).reverse();
  
  if (data.length === 0) data.push({ month: 'Current', co2: 0 });`;

file = file.replace(fakeData, realData);
file = file.replace("  // Mock calculation of ESG based on transactions\n  // Real implementation would extract exact values from metadata\n  const totalEmissions = transactions.length * 45.2;", "  const totalEmissions = transactions.reduce((s, tx) => s + (tx.lines.reduce((ls, l) => ls + (l.debit || 0), 0) * 0.12), 0);");
fs.writeFileSync('src/components/operations/EsgLedger.tsx', file);
