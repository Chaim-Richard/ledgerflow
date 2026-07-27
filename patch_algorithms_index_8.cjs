const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('SAAS_UNIT_ECONOMICS_ALGO')) {
  code = code.replace("import { CASH_CONVERSION_CYCLE_ALGO } from './cash-conversion-cycle';", "import { CASH_CONVERSION_CYCLE_ALGO } from './cash-conversion-cycle';\nimport { SAAS_UNIT_ECONOMICS_ALGO } from './saas-unit-economics';");
  
  code = code.replace("'ops_1': CASH_CONVERSION_CYCLE_ALGO,", "'ops_1': CASH_CONVERSION_CYCLE_ALGO,\n  'planning_6': SAAS_UNIT_ECONOMICS_ALGO,");
  fs.writeFileSync(file, code);
}
