const fs = require('fs');
let path = 'src/components/finance/GlobalLiquidityMap.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `    const regions: any[] = [];
    const total = regions.reduce((sum, r) => sum + r.value, 0);
    if (total === 0 && transactions.length > 0) {
      regions[0].value = transactions.reduce((sum, t) => sum + Math.abs(t.totalAmountCents || 0), 0);
    }
    return regions;`,
  `    const parsedRegions = Object.entries(locMap).map(([name, value]) => ({ name, value }));
    const total = parsedRegions.reduce((sum, r) => sum + r.value, 0);
    if (parsedRegions.length === 0 && transactions.length > 0) {
      parsedRegions.push({ name: 'Unassigned', value: transactions.reduce((sum, t) => sum + Math.abs(t.totalAmountCents || 0), 0) });
    }
    return parsedRegions;`
);

fs.writeFileSync(path, content);
console.log("Updated GlobalLiquidityMap.tsx");
