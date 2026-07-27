const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('LIQUIDITY_STRESS_ALGO')) {
  code = code.replace("import { VENDOR_CONCENTRATION_ALGO } from './vendor-concentration';", "import { VENDOR_CONCENTRATION_ALGO } from './vendor-concentration';\nimport { LIQUIDITY_STRESS_ALGO } from './liquidity-stress';");
  
  code = code.replace("'intelligence_4': VENDOR_CONCENTRATION_ALGO,", "'intelligence_4': VENDOR_CONCENTRATION_ALGO,\n  'planning_5': LIQUIDITY_STRESS_ALGO,");
  fs.writeFileSync(file, code);
}
