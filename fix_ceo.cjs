const fs = require('fs');
let code = fs.readFileSync('src/components/intelligence/CEOBoardroom.tsx', 'utf8');

code = code.replace(
  "const [investorLines, setInvestorLines] = useState<InvestorLine[]>([\n    { id: '1', name: 'Founders Collective', equityShare: 100, isFounder: true }\n  ]);",
  "const [investorLines, setInvestorLines] = useState<InvestorLine[]>([]);"
);

code = code.replace(
  "setInvestorLines([{ id: '1', name: 'Founders Collective', equityShare: 100, isFounder: true }]);",
  "setInvestorLines([]);"
);

fs.writeFileSync('src/components/intelligence/CEOBoardroom.tsx', code);
