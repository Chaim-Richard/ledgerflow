const fs = require('fs');
let file = fs.readFileSync('src/components/finance/PayrollHub.tsx', 'utf8');
file = file.replace(/periodData\.federalIncomeTaxCents/g, "periodData.employeeFederalTaxCents");
file = file.replace(/periodData\.stateIncomeTaxCents/g, "periodData.employeeStateTaxCents");
fs.writeFileSync('src/components/finance/PayrollHub.tsx', file);
