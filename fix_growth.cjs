const fs = require('fs');
let code = fs.readFileSync('src/components/intelligence/GrowthStrategy.tsx', 'utf8');
code = code.replace(
  /const \[campaigns, setCampaigns\] = useState<\{[\s\S]*?\}\]>([\s\S]*?\]\);)/,
  "const [campaigns, setCampaigns] = useState<{ id: string, name: string, spend: number, clients: number, revenue: number, status: 'active' | 'paused' }[]>([]);"
);
fs.writeFileSync('src/components/intelligence/GrowthStrategy.tsx', code);

code = fs.readFileSync('src/components/intelligence/CFOAtHome.tsx', 'utf8');
code = code.replace(
  /const \[householdAssets, setHouseholdAssets\] = useState<HouseholdAsset\[\]>\(\[[\s\S]*?\]\);/,
  "const [householdAssets, setHouseholdAssets] = useState<HouseholdAsset[]>([]);"
);
code = code.replace(
  /const \[householdLiabilities, setHouseholdLiabilities\] = useState<HouseholdLiability\[\]>\(\[[\s\S]*?\]\);/,
  "const [householdLiabilities, setHouseholdLiabilities] = useState<HouseholdLiability[]>([]);"
);
fs.writeFileSync('src/components/intelligence/CFOAtHome.tsx', code);

code = fs.readFileSync('src/components/intelligence/DiagnosticConsole.tsx', 'utf8');
code = code.replace(
  /const \[history, setHistory\] = useState<string\[\]>\(\[[\s\S]*?\]\);/,
  "const [history, setHistory] = useState<string[]>([]);"
);
fs.writeFileSync('src/components/intelligence/DiagnosticConsole.tsx', code);
