const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('CASH_CONVERSION_CYCLE_ALGO')) {
  code = code.replace("import { DUPONT_ANALYSIS_ALGO } from './dupont-analysis';", "import { DUPONT_ANALYSIS_ALGO } from './dupont-analysis';\nimport { CASH_CONVERSION_CYCLE_ALGO } from './cash-conversion-cycle';");
  
  code = code.replace("'valuation_3': DUPONT_ANALYSIS_ALGO,", "'valuation_3': DUPONT_ANALYSIS_ALGO,\n  'ops_1': CASH_CONVERSION_CYCLE_ALGO,");
  fs.writeFileSync(file, code);
}
