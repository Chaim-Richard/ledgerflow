const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('MONTE_CARLO_ALGO')) {
  code = code.replace("import { SHARED_TRANSACTION_IDENTITY_ALGO } from './shared-transaction-identity';", "import { SHARED_TRANSACTION_IDENTITY_ALGO } from './shared-transaction-identity';\nimport { MONTE_CARLO_ALGO } from './monte-carlo';");
  
  code = code.replace("'planning_3': CASH_RUNWAY_ALGO,", "'planning_3': CASH_RUNWAY_ALGO,\n  'planning_4': MONTE_CARLO_ALGO,");
  fs.writeFileSync(file, code);
}
