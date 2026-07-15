const fs = require('fs');
let registry = fs.readFileSync('src/config/registry.tsx', 'utf8');
registry = registry.replace(
  "lazy(() => import('../components/purchases/ProcurementHub'))",
  "lazy(() => import('../components/operations/UnifiedOperationsHub'))"
);
fs.writeFileSync('src/config/registry.tsx', registry);
