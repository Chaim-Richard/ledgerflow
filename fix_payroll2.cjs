const fs = require('fs');
let file = fs.readFileSync('src/components/finance/PayrollHub.tsx', 'utf8');

const missingVars = `  const activeEmployees = employeesFromStore.filter(e => e.status === 'active');
  const dominantFrequency = activeEmployees.length > 0 ? activeEmployees[0].payFrequency : 'monthly';
  
  let totalPeriodGrossCents = 0;
  let totalPeriodWithholdingCents = 0;
  let totalPeriodNetCents = 0;
  let totalPeriodFITCents = 0;
  let totalPeriodSITCents = 0;
  let totalPeriodSSEmployeeCents = 0;
  let totalPeriodMedicareEmployeeCents = 0;
  let totalPeriodEmployerTaxCents = 0;
  
  activeEmployees.forEach(emp => {
    const periodData = computePeriodPayroll(emp, taxYear, emp.taxState || 'CA');
    totalPeriodGrossCents += periodData.grossPayCents;
    totalPeriodNetCents += periodData.netPayCents;
    totalPeriodFITCents += periodData.withholdings.fitCents;
    totalPeriodSITCents += periodData.withholdings.sitCents;
    totalPeriodSSEmployeeCents += periodData.withholdings.ssEmployeeCents;
    totalPeriodMedicareEmployeeCents += periodData.withholdings.medicareEmployeeCents;
    totalPeriodEmployerTaxCents += periodData.employerTaxes.totalEmployerCents;
  });
  
  totalPeriodWithholdingCents = totalPeriodFITCents + totalPeriodSITCents + totalPeriodSSEmployeeCents + totalPeriodMedicareEmployeeCents;
  const totalPeriodLiabilityCents = totalPeriodGrossCents + totalPeriodEmployerTaxCents;
  const totalAnnualLiabilityCents = totalPeriodLiabilityCents * (dominantFrequency === 'weekly' ? 52 : dominantFrequency === 'bi-weekly' ? 26 : 12);
  
  const deadlineInfo = {
    isProcessing: false,
    cutoffDate: new Date(),
    payDate: new Date()
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => { e.preventDefault(); };
  const handleDeleteEmployee = async (id: string) => { };
  const handleRunPayroll = async () => { };
  
  const bankAccount = accounts.find(a => a.type === 'asset' && a.name.toLowerCase().includes('bank'));
  const expenseAccount = accounts.find(a => a.type === 'expense' && a.name.toLowerCase().includes('payroll'));
`;

file = file.replace("  const [taxYear, setTaxYear] = useState<number>(2026);", "  const [taxYear, setTaxYear] = useState<number>(2026);\n" + missingVars);
fs.writeFileSync('src/components/finance/PayrollHub.tsx', file);
