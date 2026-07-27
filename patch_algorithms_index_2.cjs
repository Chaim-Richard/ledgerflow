const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('ALTMAN_Z_SCORE_ALGO')) {
  code = code.replace("import { MONTE_CARLO_ALGO } from './monte-carlo';", "import { MONTE_CARLO_ALGO } from './monte-carlo';\nimport { ALTMAN_Z_SCORE_ALGO } from './altman-z-score';");
  
  code = code.replace("'valuation_1': CAPITAL_BUDGETING_ALGO,", "'valuation_1': CAPITAL_BUDGETING_ALGO,\n  'valuation_2': ALTMAN_Z_SCORE_ALGO,");
  fs.writeFileSync(file, code);
}
