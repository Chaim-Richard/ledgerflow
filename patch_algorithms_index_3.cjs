const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('CURRENCY_EXPOSURE_ALGO')) {
  code = code.replace("import { ALTMAN_Z_SCORE_ALGO } from './altman-z-score';", "import { ALTMAN_Z_SCORE_ALGO } from './altman-z-score';\nimport { CURRENCY_EXPOSURE_ALGO } from './currency-exposure';");
  
  code = code.replace("'valuation_2': ALTMAN_Z_SCORE_ALGO,", "'valuation_2': ALTMAN_Z_SCORE_ALGO,\n  'treasury_1': CURRENCY_EXPOSURE_ALGO,");
  fs.writeFileSync(file, code);
}
