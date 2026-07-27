const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('INTEREST_RATE_SENSITIVITY_ALGO')) {
  code = code.replace("import { PROFITABILITY_HEATMAP_ALGO } from './profitability-heatmap';", "import { PROFITABILITY_HEATMAP_ALGO } from './profitability-heatmap';\nimport { INTEREST_RATE_SENSITIVITY_ALGO } from './interest-rate-sensitivity';");
  
  code = code.replace("'intelligence_5': PROFITABILITY_HEATMAP_ALGO,", "'intelligence_5': PROFITABILITY_HEATMAP_ALGO,\n  'treasury_2': INTEREST_RATE_SENSITIVITY_ALGO,");
  fs.writeFileSync(file, code);
}
