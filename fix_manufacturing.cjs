const fs = require('fs');
let code = fs.readFileSync('src/components/operations/ManufacturingHub.tsx', 'utf8');
code = code.replace(
  /const \[workOrders, setWorkOrders\] = useState<WorkOrder\[\]>\(\[[\s\S]*?\]\);/,
  "const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);"
);
fs.writeFileSync('src/components/operations/ManufacturingHub.tsx', code);
