const fs = require('fs');
let content = fs.readFileSync('src/components/intelligence/IntelligenceCenter.tsx', 'utf8');

// remove duplicate imports of Zap, Activity, BarChart3, CandlestickChart, RefreshCw, Clock, LineChart, Building, Home, Building2, Layers, TrendingUp, Wallet
const dups = ['Activity', 'Zap', 'BarChart3', 'CandlestickChart', 'RefreshCw', 'Clock', 'LineChart', 'Building', 'Home', 'Building2', 'Layers', 'TrendingUp', 'Wallet'];

// A regex to match the import statement for lucide-react and remove duplicates within it
const importMatch = content.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
if (importMatch) {
  const inner = importMatch[1];
  const items = inner.split(',').map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  const deduped = [];
  for (let item of items) {
    if (item === 'Scales') {
      item = 'Scale'; // fix Scales -> Scale
    }
    if (!seen.has(item)) {
      seen.add(item);
      deduped.push(item);
    }
  }
  content = content.replace(importMatch[0], `import { ${deduped.join(', ')} } from 'lucide-react'`);
}

fs.writeFileSync('src/components/intelligence/IntelligenceCenter.tsx', content);
console.log('Fixed intelligence center');
