const fs = require('fs');
let file = 'src/lib/algorithms/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('PROFITABILITY_HEATMAP_ALGO')) {
  code = code.replace("import { SAAS_UNIT_ECONOMICS_ALGO } from './saas-unit-economics';", "import { SAAS_UNIT_ECONOMICS_ALGO } from './saas-unit-economics';\nimport { PROFITABILITY_HEATMAP_ALGO } from './profitability-heatmap';");
  
  code = code.replace("'planning_6': SAAS_UNIT_ECONOMICS_ALGO,", "'planning_6': SAAS_UNIT_ECONOMICS_ALGO,\n  'intelligence_5': PROFITABILITY_HEATMAP_ALGO,");
  fs.writeFileSync(file, code);
}
