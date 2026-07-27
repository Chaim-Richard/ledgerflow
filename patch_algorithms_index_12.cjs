const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('WORKING_CAPITAL_AGING_ALGO')) {
  code = code.replace("import { CUSTOMER_CHURN_ALGO } from './customer-churn';", "import { CUSTOMER_CHURN_ALGO } from './customer-churn';\nimport { WORKING_CAPITAL_AGING_ALGO } from './working-capital-aging';");
  
  code = code.replace("'intelligence_6': CUSTOMER_CHURN_ALGO,", "'intelligence_6': CUSTOMER_CHURN_ALGO,\n  'ops_2': WORKING_CAPITAL_AGING_ALGO,");
  fs.writeFileSync(file, code);
}
