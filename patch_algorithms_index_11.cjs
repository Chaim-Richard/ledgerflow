const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('CUSTOMER_CHURN_ALGO')) {
  code = code.replace("import { INTEREST_RATE_SENSITIVITY_ALGO } from './interest-rate-sensitivity';", "import { INTEREST_RATE_SENSITIVITY_ALGO } from './interest-rate-sensitivity';\nimport { CUSTOMER_CHURN_ALGO } from './customer-churn';");
  
  code = code.replace("'treasury_2': INTEREST_RATE_SENSITIVITY_ALGO,", "'treasury_2': INTEREST_RATE_SENSITIVITY_ALGO,\n  'intelligence_6': CUSTOMER_CHURN_ALGO,");
  fs.writeFileSync(file, code);
}
