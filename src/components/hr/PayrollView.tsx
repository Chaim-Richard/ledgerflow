import React, { useState, useMemo } from 'react';
import { Employee, PayRun, Transaction, TransactionLine } from '../../types';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { computePeriodPayroll, PAYROLL_DISCLAIMER } from '../../lib/payroll-engine';
import { formatCurrency, formatDate, getLocalDateISO } from '../../lib/utils';
import { isPostable, lineAmount } from '../../lib/txFilters';
import { useTimeout } from '../../hooks/useTimeout';
import { 
  Users, 
  Plus, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Briefcase, 
  X,
  Check
} from 'lucide-react';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';

export const PayrollView: React.FC = () => {
  const employees = useLedgerStore(s => (s.employees || []) as Employee[]);
  const setEmployees = useLedgerStore(s => s.setEmployees);
  const payRuns = useLedgerStore(s => (s.payRuns || []) as PayRun[]);
  const setPayRuns = useLedgerStore(s => s.setPayRuns);
  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  const setTransactions = useLedgerStore(s => s.setTransactions);
  useLedgerCollections('employees', 'payRuns');
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const user = useAuthStore(s => s.user);
  const currentWorkspace = getCurrentWorkspace();

  const [activeTab, setActiveTab] = useState<'runs' | 'employees'>('runs');
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isGeneratingRun, setIsGeneratingRun] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { setSafeTimeout } = useTimeout();

  // New employee form
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empSalary, setEmpSalary] = useState('');
  const [empFrequency, setEmpFrequency] = useState<Employee['payFrequency']>('Monthly');
  const [empStatus, setEmpStatus] = useState<Employee['filingStatus']>('Single');
  const [empState, setEmpState] = useState('CA');

  // Pay run generation form
  const [runPayDate, setRunPayDate] = useState(getLocalDateISO());
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');

  // Auto-calculated pay run preview
  const calculatedPayRun = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status !== 'Terminated');
    let totalGrossCents = 0;
    let totalNetCents = 0;
    let totalTaxWithheldCents = 0;
    let totalEmployerTaxesCents = 0;

    const breakdownItems = [];
    for (const emp of activeEmployees) {
      const calc = computePeriodPayroll(emp);
      totalGrossCents += calc.grossPayCents;
      totalNetCents += calc.netPayCents;
      totalTaxWithheldCents += calc.totalWithholdingCents;
      totalEmployerTaxesCents += calc.totalEmployerTaxCents;

      breakdownItems.push({
        employee: emp,
        calc
      });
    }

    return {
      items: breakdownItems,
      totalGrossCents,
      totalNetCents,
      totalTaxWithheldCents,
      totalEmployerTaxesCents,
      totalCostCents: totalGrossCents + totalEmployerTaxesCents
    };
  }, [employees]);

  const handleSaveEmployee = () => {
    if (!empName || !empSalary) return;

    const salaryCents = Math.round(parseFloat(empSalary) * 100);
    const newEmp: Employee = {
      id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid: user?.uid || 'system',
      workspaceId: currentWorkspace?.id || 'default',
      name: empName,
      email: empEmail || undefined,
      role: empRole || 'Team Member',
      salaryCents,
      payFrequency: empFrequency,
      filingStatus: empStatus,
      state: empState,
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    setEmployees([...employees, newEmp]);
    setIsAddingEmployee(false);
    setEmpName('');
    setEmpEmail('');
    setEmpRole('');
    setEmpSalary('');
    setSuccessMessage(`Added employee "${empName}" to roster.`);
    setSafeTimeout(() => setSuccessMessage(null), 4000);
  };

  const handlePostPayRunToLedger = () => {
    if (calculatedPayRun.items.length === 0) return;

    // Find cash/bank account
    const bankAcc = accounts.find(a => a.id === selectedBankAccountId) || 
      accounts.find(a => a.category === 'Cash' || a.name.toLowerCase().includes('checking') || a.name.toLowerCase().includes('bank')) ||
      accounts[0] || { id: 'acc_cash_default', name: 'Operating Cash' };

    // Find or fallback payroll expense & liability accounts
    const wageExpenseAcc = accounts.find(a => a.name.toLowerCase().includes('wage') || a.name.toLowerCase().includes('payroll') || a.category === 'COGS' || a.category === 'Operating Expense') || 
      accounts[0] || { id: 'acc_wages_default', name: 'Wages Expense' };
    const taxExpenseAcc = accounts.find(a => a.name.toLowerCase().includes('payroll tax')) || wageExpenseAcc;
    const taxPayableAcc = accounts.find(a => a.name.toLowerCase().includes('payroll tax payable') || a.category === 'Payables') || 
      accounts[0] || { id: 'acc_tax_payable_default', name: 'Payroll Taxes Payable' };

    // Construct Balanced Double-Entry Journal Lines
    const lines: TransactionLine[] = [
      // 1. Debit Gross Wages Expense
      {
        accountId: wageExpenseAcc.id,
        accountName: wageExpenseAcc.name,
        amountCents: calculatedPayRun.totalGrossCents,
        category: 'Payroll & Wages',
        description: `Gross Wages (${calculatedPayRun.items.length} employees)`
      },
      // 2. Debit Employer Payroll Taxes Expense
      {
        accountId: taxExpenseAcc.id,
        accountName: taxExpenseAcc.name,
        amountCents: calculatedPayRun.totalEmployerTaxesCents,
        category: 'Employer Payroll Taxes',
        description: 'Employer FICA / FUTA / SUTA Tax Liability'
      },
      // 3. Credit Cash / Bank (Net Pay distributed to employees)
      {
        accountId: bankAcc.id,
        accountName: bankAcc.name,
        amountCents: -calculatedPayRun.totalNetCents,
        description: 'Net Pay Direct Deposits'
      },
      // 4. Credit Payroll Taxes Payable (Employee withholding + Employer tax obligation)
      {
        accountId: taxPayableAcc.id,
        accountName: taxPayableAcc.name,
        amountCents: -(calculatedPayRun.totalTaxWithheldCents + calculatedPayRun.totalEmployerTaxesCents),
        description: 'Federal & State Payroll Taxes Withheld & Due'
      }
    ];

    const runId = `payrun_${Date.now()}`;
    const newTx: Transaction = {
      id: `tx_${runId}`,
      uid: user?.uid || 'system',
      workspaceId: currentWorkspace?.id || 'default',
      date: runPayDate,
      description: `Payroll Run — ${calculatedPayRun.items.length} Employees (${runPayDate})`,
      totalAmountCents: calculatedPayRun.totalCostCents,
      currency: 'USD',
      status: 'completed',
      type: 'journal',
      lines,
      createdAt: new Date().toISOString()
    };

    setTransactions([...transactions, newTx]);

    const record: PayRun = {
      id: runId,
      uid: user?.uid || 'system',
      workspaceId: currentWorkspace?.id || 'default',
      date: runPayDate,
      totalAmountCents: calculatedPayRun.totalCostCents,
      employeeCount: calculatedPayRun.items.length,
      status: 'processed',
      createdAt: new Date().toISOString()
    };

    setPayRuns([...payRuns, record]);
    setIsGeneratingRun(false);
    setSuccessMessage(`Pay Run posted to General Ledger: ${formatCurrency(calculatedPayRun.totalCostCents)} total employer cost.`);
    setSafeTimeout(() => setSuccessMessage(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" id="payroll-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-800" />
            Payroll & Compensation Engine
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Progressive gross-to-net calculations, statutory tax withholding schedules, and atomic general ledger postings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingEmployee(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg flex items-center gap-1.5 transition-colors border border-neutral-300 cursor-pointer"
            id="add-employee-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Employee
          </button>
          <button
            onClick={() => setIsGeneratingRun(true)}
            disabled={employees.length === 0}
            className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            id="create-pay-run-btn"
          >
            <Play className="w-3.5 h-3.5" />
            Generate Pay Run
          </button>
        </div>
      </div>

      {/* Statutory Disclaimer Banner */}
      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Statutory Note: </span>
          {PAYROLL_DISCLAIMER}
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-neutral-200 bg-neutral-100/60 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('runs')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === 'runs' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Pay Runs History ({payRuns.length})
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === 'employees' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Employee Directory ({employees.length})
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'runs' ? (
        payRuns.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-neutral-200 p-6">
            <Briefcase className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-neutral-800">No Pay Runs Processed Yet</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              Add employees to your roster and execute your first automated pay run to calculate deductions and post wages to the ledger.
            </p>
            <button
              onClick={() => setIsGeneratingRun(true)}
              disabled={employees.length === 0}
              className="mt-4 px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Generate First Pay Run
            </button>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Pay Run Date</th>
                  <th className="py-3 px-4 text-center">Employees</th>
                  <th className="py-3 px-4 text-right">Total Employer Cost</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {payRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-neutral-900 font-mono">
                      {formatDate(run.date)}
                    </td>
                    <td className="py-3 px-4 text-center text-neutral-600">
                      {run.employeeCount} team members
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                      {formatCurrency(run.totalAmountCents)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {run.status === 'processed' ? 'Posted to Ledger' : run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        employees.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-neutral-200 p-6">
            <Users className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-neutral-800">No Employees in Directory</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              Add team members to calculate recurring payroll obligations, tax withholdings, and pay stubs.
            </p>
            <button
              onClick={() => setIsAddingEmployee(true)}
              className="mt-4 px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Employee
            </button>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Role & State</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4 text-right">Annual Gross</th>
                  <th className="py-3 px-4 text-right">Period Net Pay</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {employees.map((emp) => {
                  const est = computePeriodPayroll(emp);

                  return (
                    <tr key={emp.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-neutral-900">
                        <div>{emp.name}</div>
                        {emp.email && <div className="text-[11px] text-neutral-400 font-normal">{emp.email}</div>}
                      </td>
                      <td className="py-3 px-4 text-neutral-700">
                        <div>{emp.role || 'Team Member'}</div>
                        <div className="text-[11px] text-neutral-400">{emp.state || 'CA'} &bull; {emp.filingStatus || 'Single'}</div>
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {emp.payFrequency}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-neutral-900">
                        {formatCurrency(emp.salaryCents || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(est.netPayCents)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-semibold">
                          {emp.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Add Employee Modal */}
      {isAddingEmployee && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <h3 className="text-sm font-bold text-neutral-900">Add Employee to Roster</h3>
              <button onClick={() => setIsAddingEmployee(false)} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={empName}
                  onChange={e => setEmpName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="alex@company.com"
                    value={empEmail}
                    onChange={e => setEmpEmail(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Job Role / Title</label>
                  <input
                    type="text"
                    placeholder="Senior Engineer"
                    value={empRole}
                    onChange={e => setEmpRole(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Annual Salary ($)</label>
                  <input
                    type="number"
                    placeholder="95000"
                    value={empSalary}
                    onChange={e => setEmpSalary(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Pay Frequency</label>
                  <select
                    value={empFrequency}
                    onChange={e => setEmpFrequency(e.target.value as Employee['payFrequency'])}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                  >
                    <option value="Weekly">Weekly (52/yr)</option>
                    <option value="Bi-Weekly">Bi-Weekly (26/yr)</option>
                    <option value="Monthly">Monthly (12/yr)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Filing Status</label>
                  <select
                    value={empStatus}
                    onChange={e => setEmpStatus(e.target.value as Employee['filingStatus'])}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married Filing Jointly</option>
                    <option value="Head of Household">Head of Household</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">State Tax Code</label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="CA / NY / TX"
                    value={empState}
                    onChange={e => setEmpState(e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden uppercase"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingEmployee(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEmployee}
                  disabled={!empName || !empSalary}
                  className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Employee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Pay Run Modal & Preview */}
      {isGeneratingRun && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Execute Pay Run</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Preview withholding taxes and post balanced journal entries to the ledger.
                </p>
              </div>
              <button onClick={() => setIsGeneratingRun(false)} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Disbursement Date</label>
                  <input
                    type="date"
                    value={runPayDate}
                    onChange={e => setRunPayDate(e.target.value)}
                    className="w-full p-2 bg-white border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Disbursement Bank Account</label>
                  <select
                    value={selectedBankAccountId}
                    onChange={e => setSelectedBankAccountId(e.target.value)}
                    className="w-full p-2 bg-white border border-neutral-300 rounded-lg"
                  >
                    <option value="">Default Operating Account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.code || acc.category})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Calculation Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <div className="text-[11px] text-neutral-500">Gross Wages</div>
                  <div className="font-mono font-bold text-neutral-900">{formatCurrency(calculatedPayRun.totalGrossCents)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Employee Withholdings</div>
                  <div className="font-mono font-bold text-rose-600">{formatCurrency(calculatedPayRun.totalTaxWithheldCents)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Employer Taxes</div>
                  <div className="font-mono font-bold text-rose-600">{formatCurrency(calculatedPayRun.totalEmployerTaxesCents)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Net Distribution</div>
                  <div className="font-mono font-bold text-emerald-600">{formatCurrency(calculatedPayRun.totalNetCents)}</div>
                </div>
              </div>

              {/* Employee Breakdown */}
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                    <tr>
                      <th className="py-2 px-3">Employee</th>
                      <th className="py-2 px-3 text-right">Gross</th>
                      <th className="py-2 px-3 text-right">Income Tax W/H</th>
                      <th className="py-2 px-3 text-right">FICA & Med</th>
                      <th className="py-2 px-3 text-right">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {calculatedPayRun.items.map((item) => (
                      <tr key={item.employee.id}>
                        <td className="py-2 px-3 font-medium text-neutral-900">{item.employee.name}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.calc.grossPayCents)}</td>
                        <td className="py-2 px-3 text-right font-mono text-neutral-600">
                          {formatCurrency(item.calc.employeeFederalTaxCents + item.calc.employeeStateTaxCents)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-neutral-600">
                          {formatCurrency(item.calc.employeeFicaSocialSecurityCents + item.calc.employeeFicaMedicareCents)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                          {formatCurrency(item.calc.netPayCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <button
                onClick={() => setIsGeneratingRun(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePostPayRunToLedger}
                className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Approve & Post to General Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollView;
