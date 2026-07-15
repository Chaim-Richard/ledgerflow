const fs = require('fs');

const path = 'src/components/finance/WealthHub.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `  const assetAllocationData = useMemo(() => {
    const data = [
      { name: 'Liquid Assets', value: displayData.liquidAssets },
      { name: 'Investments', value: displayData.investments },
      { name: 'Real Estate', value: displayData.realEstate }
    ];
    return data.filter(d => d.value > 0);
  }, [displayData]);`,
  `  const assetAllocationData = useMemo(() => {
    const data = [
      { name: 'Liquid Assets', value: displayData.liquidAssets, color: '#10b981' },
      { name: 'Investments', value: displayData.investments, color: '#3b82f6' },
      { name: 'Real Estate', value: displayData.realEstate, color: '#f59e0b' },
      { name: 'Other', value: 0, color: '#6366f1' }
    ];
    return data.filter(d => d.value > 0);
  }, [displayData]);`
);

fs.writeFileSync(path, content);
console.log("Updated WealthHub.tsx");
