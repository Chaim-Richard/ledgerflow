const fs = require('fs');
let file = fs.readFileSync('src/components/finance/PayrollHub.tsx', 'utf8');
file = file.replace(/e\.status === 'active'/g, "e.status === 'Active'");
file = file.replace(/e\.payFrequency : 'monthly'/g, "e.payFrequency : 'Monthly'");
file = file.replace(/dominantFrequency === 'weekly'/g, "dominantFrequency === 'Weekly'");
file = file.replace(/dominantFrequency === 'bi-weekly'/g, "dominantFrequency === 'Bi-Weekly'");
file = file.replace(/emp\.taxState \|\| 'CA'/g, ""); // remove 3rd arg

// rewrite the computePeriodPayroll usage
const badBlock = `    const periodData = computePeriodPayroll(emp, taxYear, );
    totalPeriodGrossCents += periodData.grossPayCents;
    totalPeriodNetCents += periodData.netPayCents;
    totalPeriodFITCents += periodData.withholdings.fitCents;
    totalPeriodSITCents += periodData.withholdings.sitCents;
    totalPeriodSSEmployeeCents += periodData.withholdings.ssEmployeeCents;
    totalPeriodMedicareEmployeeCents += periodData.withholdings.medicareEmployeeCents;
    totalPeriodEmployerTaxCents += periodData.employerTaxes.totalEmployerCents;`;

const goodBlock = `    const periodData = computePeriodPayroll(emp, taxYear);
    totalPeriodGrossCents += periodData.grossPayCents;
    totalPeriodNetCents += periodData.netPayCents;
    totalPeriodFITCents += periodData.federalIncomeTaxCents;
    totalPeriodSITCents += periodData.stateIncomeTaxCents;
    totalPeriodSSEmployeeCents += periodData.employeeFicaSocialSecurityCents;
    totalPeriodMedicareEmployeeCents += periodData.employeeFicaMedicareCents;
    totalPeriodEmployerTaxCents += periodData.employerFicaSocialSecurityCents + periodData.employerFicaMedicareCents;`;

file = file.replace(badBlock, goodBlock);
fs.writeFileSync('src/components/finance/PayrollHub.tsx', file);
