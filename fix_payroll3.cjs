const fs = require('fs');
let file = fs.readFileSync('src/components/finance/PayrollHub.tsx', 'utf8');
file = file.replace("payDate: new Date()", "payDate: new Date(),\n    daysRemaining: 3,\n    dateStr: '',\n    quarter: 'Q3'");
fs.writeFileSync('src/components/finance/PayrollHub.tsx', file);
