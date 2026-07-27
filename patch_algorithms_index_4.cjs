const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('VENDOR_CONCENTRATION_ALGO')) {
  code = code.replace("import { CURRENCY_EXPOSURE_ALGO } from './currency-exposure';", "import { CURRENCY_EXPOSURE_ALGO } from './currency-exposure';\nimport { VENDOR_CONCENTRATION_ALGO } from './vendor-concentration';");
  
  code = code.replace("'treasury_1': CURRENCY_EXPOSURE_ALGO,", "'treasury_1': CURRENCY_EXPOSURE_ALGO,\n  'intelligence_4': VENDOR_CONCENTRATION_ALGO,");
  fs.writeFileSync(file, code);
}
