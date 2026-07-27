const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('DUPONT_ANALYSIS_ALGO')) {
  code = code.replace("import { LIQUIDITY_STRESS_ALGO } from './liquidity-stress';", "import { LIQUIDITY_STRESS_ALGO } from './liquidity-stress';\nimport { DUPONT_ANALYSIS_ALGO } from './dupont-analysis';");
  
  code = code.replace("'planning_5': LIQUIDITY_STRESS_ALGO,", "'planning_5': LIQUIDITY_STRESS_ALGO,\n  'valuation_3': DUPONT_ANALYSIS_ALGO,");
  fs.writeFileSync(file, code);
}
