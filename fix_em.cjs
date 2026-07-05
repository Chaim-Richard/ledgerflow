const fs = require('fs');
let content = fs.readFileSync('src/components/operations/EquipmentMaintenance.tsx', 'utf8');
content = content.replace(/import { Wrench,/g, "import { ArrowRight, Wrench,");
fs.writeFileSync('src/components/operations/EquipmentMaintenance.tsx', content);
