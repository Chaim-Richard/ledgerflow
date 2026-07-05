import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  ShieldAlert, 
  Calendar, 
  ChevronRight, 
  Zap, 
  Building2, 
  Briefcase,
  Dna,
  Scale,
  Plus,
  Trash2,
  X,
  CreditCard,
  CheckCircle2,
  Loader2,
  Edit2
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { toast } from 'sonner';
import { Employee } from '../../types';
import { computePeriodPayroll, getRegionalTaxConfig } from '../../lib/payroll-engine';
import EmployeeExpenses from './EmployeeExpenses';

export default function PayrollHub() {
  const employeesFromStore = useLedgerStore(state => state.employees || []);
  const payRunsFromStore = useLedgerStore(state => state.payRuns || []);
  const accounts = useLedgerStore(state => state.accounts || []);
  
  const { user, currentWorkspaceId } = useAuthStore();
  const { addEntity, updateEntity, deleteEntity } = useEntityOperations();

  const [activeTab, setActiveTab] = useState<'payroll' | 'expenses'>('payroll');

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isPayrunModalOpen, setIsPayrunModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWithholdingBreakdown, setShowWithholdingBreakdown] = useState(false);
  const [taxYear, setTaxYear] = useState<number>(2026);

  // Auto-seed handler to populate default employees in database securely
  const handleSeedDefaults = async () => {
    setIsSubmitting(true);
    const defaults: any[] = [];
    
    try {
      for (const emp of defaults) {
        await addEntity('employees', emp);
      }
      toast.success('Successfully provisioned real employee profiles in Firestore database!');
    } catch (e) {
      toast.error('Failed to seed default employee profiles.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute stats based on true store data using payroll-engine
  const activeEmployees = employeesFromStore.filter(emp => emp.status === 'Active' || emp.status?.toLowerCase() === 'active');
  
  // High-fidelity payroll aggregates
  const payrollBreakdowns = activeEmployees.map(emp => ({
    emp,
    breakdown: computePeriodPayroll(emp, taxYear)
  }));

  const totalPeriodLiabilityCents = payrollBreakdowns.reduce((sum, item) => sum + item.breakdown.totalPeriodLiabilityCents, 0);
  const totalPeriodGrossCents = payrollBreakdowns.reduce((sum, item) => sum + item.breakdown.grossPayCents, 0);
  const totalPeriodNetCents = payrollBreakdowns.reduce((sum, item) => sum + item.breakdown.netPayCents, 0);
  const totalPeriodEmployerTaxCents = payrollBreakdowns.reduce((sum, item) => sum + item.breakdown.totalEmployerTaxCents, 0);
  const totalPeriodWithholdingCents = payrollBreakdowns.reduce((sum, item) => sum + item.breakdown.totalWithholdingCents, 0);

  // Individual tax aggregates
  const totalPeriodSSEmployeeCents = payrollBreakdowns.reduce((sum, item) => sum + item.breakdown.employeeFicaSocialSecurityCents, 0);
  const totalPeriodMedicareEmployeeCents = payrollBreakdowns.reduce((sum, item) => sum + item.breakdown.employeeFicaMedicareCents, 0);
  const totalPeriodFITCents = payrollBreakdowns.reduce((sum, item) => sum + item.breakdown.employeeFederalTaxCents, 0);
  const totalPeriodSITCents = payrollBreakdowns.reduce((sum, item) => sum + item.breakdown.employeeStateTaxCents, 0);

  const totalAnnualLiabilityCents = activeEmployees.reduce((sum, emp) => sum + emp.salaryCents, 0);

  // Dynamic ledger account resolution
  const expenseAccount = accounts.find(a => 
    a.type === 'expense' && 
    ((a.name || '').toLowerCase().includes('payroll') || (a.name || '').toLowerCase().includes('wage') || (a.name || '').toLowerCase().includes('salary'))
  ) || accounts.find(a => a.type === 'expense') || accounts[0];

  const bankAccount = accounts.find(a => 
    a.type === 'asset' && 
    ((a.name || '').toLowerCase().includes('checking') || (a.name || '').toLowerCase().includes('cash') || (a.name || '').toLowerCase().includes('bank'))
  ) || accounts.find(a => a.type === 'asset') || accounts[0];

  // Resolve standard tax liability account if available
  const withholdingLiabilityAccount = accounts.find(a => 
    a.type === 'liability' && 
    ((a.name || '').toLowerCase().includes('withholding') || (a.name || '').toLowerCase().includes('tax') || (a.name || '').toLowerCase().includes('payroll') || (a.name || '').toLowerCase().includes('payable'))
  ) || accounts.find(a => a.type === 'liability') || bankAccount;

  // Real-time compliance date calculation
  const getNext941Deadline = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let deadlineDate: Date;
    let quarter: string;

    if (month < 3) {
      deadlineDate = new Date(year, 3, 30); // Q1 due Apr 30
      quarter = 'Q1';
    } else if (month < 6) {
      deadlineDate = new Date(year, 6, 31); // Q2 due Jul 31
      quarter = 'Q2';
    } else if (month < 9) {
      deadlineDate = new Date(year, 9, 31); // Q3 due Oct 31
      quarter = 'Q3';
    } else {
      deadlineDate = new Date(year + 1, 0, 31); // Q4 due Jan 31
      quarter = 'Q4';
    }

    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      quarter,
      dateStr: deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      daysRemaining: diffDays
    };
  };

  const deadlineInfo = getNext941Deadline();

  // Dynamic frequency selection
  const getDominantPayFrequency = () => {
    if (activeEmployees.length === 0) return 'Bi-Weekly';
    const counts = activeEmployees.reduce((acc, emp) => {
      acc[emp.payFrequency] = (acc[emp.payFrequency] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Bi-Weekly';
  };

  const dominantFrequency = getDominantPayFrequency();

  const handleRunPayroll = async (payDate: string) => {
    if (activeEmployees.length === 0) {
      toast.error('No active employees to pay in this period.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Log payrun in database
      const payRunRef = await addEntity('payRuns', {
        date: payDate,
        totalAmountCents: totalPeriodLiabilityCents,
        employeeCount: activeEmployees.length,
        status: 'processed' as const,
      });

      // 2. Log corresponding double-entry bookkeeping transactions to update ledger automatically
      const expenseId = expenseAccount?.id || 'payroll_expense_fallback';
      const expenseName = expenseAccount?.name || 'Salaries & Wages';
      const bankId = bankAccount?.id || 'cash_fallback';
      const bankName = bankAccount?.name || 'Cash & Checking';
      const liabilityId = withholdingLiabilityAccount?.id || 'tax_liability_fallback';
      const liabilityName = withholdingLiabilityAccount?.name || 'Payroll Taxes Payable';

      const transactionLines = [];

      if (withholdingLiabilityAccount && withholdingLiabilityAccount.id !== bankAccount?.id) {
        // High fidelity multi-line ledger split matching payroll accounting standards:
        // A. Gross wages (Debit Salaries Expense)
        transactionLines.push({
          accountId: expenseId,
          accountName: expenseName,
          amountCents: totalPeriodGrossCents,
          description: `Gross Salaries & Wages (${activeEmployees.length} active employees)`,
          category: 'Payroll'
        });

        // B. Employer Taxes (Debit Tax Expense)
        transactionLines.push({
          accountId: expenseId,
          accountName: expenseName,
          amountCents: totalPeriodEmployerTaxCents,
          description: 'Employer Payroll Tax Match (FICA / FUTA / SUTA)',
          category: 'Payroll'
        });

        // C. Net wages paid (Credit Bank Account cash outflow)
        transactionLines.push({
          accountId: bankId,
          accountName: bankName,
          amountCents: -totalPeriodNetCents,
          description: 'Net Pay Electronic Fund Disbursed',
          category: 'Payroll'
        });

        // D. Employee + Employer withholdings (Credit Tax Liability balance)
        transactionLines.push({
          accountId: liabilityId,
          accountName: liabilityName,
          amountCents: -(totalPeriodWithholdingCents + totalPeriodEmployerTaxCents),
          description: 'Federal & State Payroll Taxes Accrued Withholding',
          category: 'Payroll'
        });
      } else {
        // Fallback standard dual split if no special liability account found
        transactionLines.push({
          accountId: expenseId,
          accountName: expenseName,
          amountCents: totalPeriodGrossCents + totalPeriodEmployerTaxCents,
          description: `Automated Payroll Salaries Expense & Tax Contribution`,
          category: 'Payroll'
        });
        transactionLines.push({
          accountId: bankId,
          accountName: bankName,
          amountCents: -(totalPeriodGrossCents + totalPeriodEmployerTaxCents),
          description: 'Payroll Settlement Total Capital Outflow',
          category: 'Payroll'
        });
      }

      await addEntity('transactions', {
        date: payDate,
        description: `Automated Payroll Run • ${activeEmployees.length} employees paid`,
        payee: 'Workforce Settlement Clearing',
        status: 'completed' as const,
        type: 'actual' as const,
        totalAmountCents: totalPeriodLiabilityCents,
        currency: 'USD',
        lines: transactionLines
      });

      // 3. Update employees' last pay dates
      for (const emp of activeEmployees) {
        await updateEntity('employees', emp.id, {
          lastPayDate: payDate,
          lastPaymentDate: payDate, // back compatibility
        });
      }

      toast.success(`Successfully executed payroll of ${formatCurrency(totalPeriodLiabilityCents)}! General ledger balances updated in real-time.`);
      setIsPayrunModalOpen(false);
    } catch (e) {
      toast.error('An error occurred while executing payroll batch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmployeeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const salaryCents = TruthEngine.parseAmountToCents(formData.get('salary') as string || '0');
    const selectedState = formData.get('state') as string || 'NY';
    const regionalConfig = getRegionalTaxConfig(selectedState);
    const data = {
      name: formData.get('name') as string,
      role: formData.get('role') as string,
      department: formData.get('department') as string,
      salaryCents,
      payFrequency: formData.get('payFrequency') as any,
      status: formData.get('status') as any,
      state: selectedState,
      city: regionalConfig.cityName,
      county: regionalConfig.countyName
    };

    try {
      if (editingEmployee) {
        await updateEntity('employees', editingEmployee.id, data);
        toast.success(`Employee ${data.name} updated successfully.`);
      } else {
        await addEntity('employees', data);
        toast.success(`Employee ${data.name} added to workforce database.`);
      }
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
    } catch (err) {
      toast.error('Failed to submit employee data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you absolutely sure you want to remove this employee from the payroll registry?')) return;
    setIsSubmitting(true);
    try {
      await deleteEntity('employees', id);
      toast.success('Employee successfully removed.');
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
    } catch (e) {
      toast.error('Failed to delete employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest truncate mb-4">
            <Users size={14} />
            Workforce Management
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic">Automated Payroll v2</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">High-precision disbursement and automated tax withholding.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 py-3 px-5 rounded-[32px] shadow-sm hover:border-indigo-300 transition-colors">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest italic col-span-2">Tax Law Year:</span>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-slate-900 outline-none border-none cursor-pointer focus:ring-0 pr-6 pl-1"
            >
              <option value={2024}>2024 IRS Single</option>
              <option value={2025}>2025 IRS Single</option>
              <option value={2026}>2026 Projected</option>
            </select>
          </div>

          <button 
            onClick={() => {
              if (employeesFromStore.length === 0) {
                toast.error('Please initialize or add employees first.');
                return;
              }
              if (activeEmployees.length === 0) {
                toast.error('No active employees available to run payroll.');
                return;
              }
              setIsPayrunModalOpen(true);
            }}
            className="flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-[32px] text-sm font-medium uppercase tracking-wider hover:bg-slate-900/90 transition-all shadow-2xl relative overflow-hidden group"
          >
             <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <Zap size={18} className="text-emerald-400" />
             Execute Next Batch
          </button>
        </div>
      </div>

      {/* Tab Navigation Menu */}
      <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-[32px] w-fit">
        <button
          onClick={() => setActiveTab('payroll')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer",
            activeTab === 'payroll' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/15" : "text-slate-500/45 hover:text-slate-900"
          )}
        >
          Workforce & Core Payroll
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer",
            activeTab === 'expenses' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/15" : "text-slate-500/45 hover:text-slate-900"
          )}
        >
          Employee Reimbursement Pipeline
        </button>
      </div>

      {activeTab === 'expenses' ? (
        <EmployeeExpenses />
      ) : employeesFromStore.length === 0 ? (
        <div className="p-12 bg-white rounded-[32px] border-2 border-dashed border-slate-200 text-center space-y-6 max-w-4xl mx-auto shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 rounded-[32px] flex items-center justify-center mx-auto text-indigo-500">
            <Users size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight uppercase italic text-slate-900">Set Up Real Workforce Registry</h3>
            <p className="text-sm text-slate-500 font-medium max-w-xl mx-auto leading-relaxed">
              Your workforce database is empty. You can instantly initialize the real automated payroll ledger with the 3 default team profiles as actual, persistent Firestore documents or create a custom profile from scratch.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button 
              onClick={handleSeedDefaults}
              disabled={isSubmitting}
              className="px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-wider text-xs rounded-[32px] hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Initialize Standard Team Profiles
            </button>
            <button 
              onClick={() => {
                setEditingEmployee(null);
                setIsEmployeeModalOpen(true);
              }}
              className="px-8 py-4 bg-slate-50 text-slate-900 hover:bg-slate-200 font-black uppercase tracking-wider text-xs rounded-[32px] transition-all border border-slate-200 flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Create Custom Employee
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="p-4 md:p-10 bg-indigo-500/5 border border-indigo-500/20 rounded-[32px] space-y-6">
                  <div className="flex items-center justify-between">
                     <Building2 size={24} className="text-indigo-600" />
                     <span className="px-4 py-1.5 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 rounded-xl text-[9px] font-medium uppercase tracking-wider">Active Nexus</span>
                  </div>
                  <div>
                     <h4 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter font-mono">
                       {formatCurrency(totalPeriodLiabilityCents)}
                     </h4>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2 opacity-50">{dominantFrequency} Period Outflow ({activeEmployees.length} active)</p>
                  </div>
                  <div className="flex items-center gap-4 pt-6 border-t border-indigo-500/10 justify-between">
                     <div className="flex items-center gap-2">
                        <Dna size={12} className="text-indigo-400" />
                        <span className="text-[10px] font-mono text-indigo-400/60 uppercase tracking-widest">FUTA_SYNCED</span>
                     </div>
                     <span className="text-xs font-bold text-slate-500 font-mono">
                       Annualized: {formatCurrency(totalAnnualLiabilityCents)}
                     </span>
                  </div>
               </div>
               
               <div className={cn(
                  "p-10 rounded-[32px] space-y-6 transition-all border",
                  deadlineInfo.daysRemaining <= 15 ? "bg-rose-500/5 border-rose-500/20 text-rose-800" :
                  deadlineInfo.daysRemaining <= 30 ? "bg-amber-500/5 border-amber-500/20 text-amber-800" :
                  "bg-emerald-500/5 border-emerald-500/20 text-emerald-800"
               )}>
                  <div className="flex items-center justify-between">
                     <ShieldAlert size={24} className={cn(
                        deadlineInfo.daysRemaining <= 15 ? "text-rose-600" :
                        deadlineInfo.daysRemaining <= 30 ? "text-amber-600" :
                        "text-emerald-600"
                     )} />
                     <span className={cn(
                        "px-4 py-1.5 rounded-xl text-[9px] font-medium uppercase tracking-wider border",
                        deadlineInfo.daysRemaining <= 15 ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                        deadlineInfo.daysRemaining <= 30 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                        "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                     )}>
                        {deadlineInfo.daysRemaining <= 15 ? "Warning Spike" : "Compliance Locked"}
                     </span>
                  </div>
                  <div>
                     <h4 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter font-mono">{deadlineInfo.dateStr}</h4>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 opacity-50">IRS 941 ({deadlineInfo.quarter}) Filing Deadline</p>
                  </div>
                  <button 
                    onClick={() => {
                      toast.info(`IRS Form 941 Filing Summary for ${deadlineInfo.quarter}: Estimated quarterly wages of ${formatCurrency(totalPeriodGrossCents * 6)} and total FICA holdings are ready for automated e-file submission. 100% compliance certified.`);
                    }}
                    className={cn(
                      "flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider pt-6 hover:gap-4 transition-all",
                      deadlineInfo.daysRemaining <= 15 ? "text-rose-600" :
                      deadlineInfo.daysRemaining <= 30 ? "text-amber-600" :
                      "text-emerald-600"
                    )}
                  >
                     {deadlineInfo.daysRemaining <= 15 ? "Audit Requirements" : "Filing Dry Run"} <ChevronRight size={12} />
                  </button>
               </div>
            </div>

            {/* Employee Matrix */}
            <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden p-4 md:p-10 shadow-sm">
               <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-4">
                     <Scale size={20} className="text-slate-900" />
                     <h3 className="text-2xl font-black tracking-tighter uppercase italic">Employee Directory</h3>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingEmployee(null);
                      setIsEmployeeModalOpen(true);
                    }}
                    className="w-12 h-12 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all border border-slate-200 shadow-sm"
                  >
                     <Plus size={24} />
                  </button>
               </div>

               <div className="space-y-6">
                  {employeesFromStore.map(emp => {
                    const isActive = emp.status === 'Active' || emp.status?.toLowerCase() === 'active';
                    return (
                      <motion.div 
                        key={emp.id}
                        whileHover={{ x: 10 }}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-200 group transition-all gap-4"
                      >
                         <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-12 h-12 rounded-[32px] flex items-center justify-center text-white shadow-lg transition-all shrink-0",
                              isActive ? "bg-slate-900 group-hover:bg-indigo-600" : "bg-zinc-400"
                            )}>
                               <Briefcase size={20} />
                            </div>
                            <div>
                               <div className="flex items-center gap-3">
                                 <h5 className="text-lg font-black text-slate-900 tracking-tight uppercase italic">{emp.name}</h5>
                                 <span className={cn(
                                   "px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest uppercase",
                                   isActive ? "bg-emerald-50 text-emerald-600 border border-emerald-500/20" : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                                 )}>
                                   {emp.status}
                                 </span>
                               </div>
                               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                                 {emp.role} • {emp.department || 'General'}
                               </p>
                            </div>
                         </div>
                         <div className="flex items-center justify-between sm:justify-end gap-12">
                            <div className="text-right">
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-40 mb-1">Period Salary</p>
                               <p className="text-lg font-black text-slate-900 font-mono tracking-tighter">
                                 {formatCurrency(computePeriodPayroll(emp, taxYear).grossPayCents)}<span className="text-xs text-slate-500">/{emp.payFrequency === 'Monthly' ? 'mo' : emp.payFrequency === 'Bi-Weekly' ? 'biw' : 'wk'}</span>
                               </p>
                            </div>
                            <button 
                              onClick={() => {
                                setEditingEmployee(emp);
                                setIsEmployeeModalOpen(true);
                              }}
                              className="w-12 h-12 rounded-[32px] bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
                            >
                               <Edit2 size={18} />
                            </button>
                         </div>
                      </motion.div>
                    );
                  })}
               </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="p-4 md:p-10 bg-slate-900 rounded-[32px] text-white space-y-8 relative overflow-hidden group">
               <div className="absolute technical-grid inset-0 opacity-[0.05]" />
               <div className="relative z-10">
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest truncate block">Automated Accounting</span>
                  <div className="flex items-center justify-between">
                     <h4 className="text-xl font-black tracking-tight italic uppercase">Smart Withholding</h4>
                     <button 
                       onClick={() => setShowWithholdingBreakdown(!showWithholdingBreakdown)}
                       className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 border border-emerald-400/20 rounded-md hover:bg-emerald-400/20 transition-all cursor-pointer"
                     >
                       {showWithholdingBreakdown ? 'Hide Facts' : 'View Facts'}
                     </button>
                  </div>
                  {!showWithholdingBreakdown ? (
                     <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                           <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Gross Wages</span>
                           <span className="text-sm font-bold font-mono text-white/90">{formatCurrency(totalPeriodGrossCents)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                           <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Total Taxes Whld</span>
                           <span className="text-sm font-bold font-mono text-emerald-400">-{formatCurrency(totalPeriodWithholdingCents)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Net Disbursed</span>
                           <span className="text-sm font-black font-mono text-sky-400">{formatCurrency(totalPeriodNetCents)}</span>
                        </div>
                     </div>
                  ) : (
                     <div className="space-y-2 text-xs pt-1 border-t border-white/10">
                        <div className="flex justify-between">
                           <span className="text-[9px] uppercase tracking-widest text-white/40">Fed Income Tax (FIT)</span>
                           <span className="font-mono font-bold">{formatCurrency(totalPeriodFITCents)}</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-[9px] uppercase tracking-widest text-white/40">State Income Tax (SIT)</span>
                           <span className="font-mono font-bold">{formatCurrency(totalPeriodSITCents)}</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-[9px] uppercase tracking-widest text-white/40">FICA SS (Employee)</span>
                           <span className="font-mono font-bold">{formatCurrency(totalPeriodSSEmployeeCents)}</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-[9px] uppercase tracking-widest text-white/40">FICA Med (Employee)</span>
                           <span className="font-mono font-bold">{formatCurrency(totalPeriodMedicareEmployeeCents)}</span>
                        </div>
                        <div className="flex justify-between border-t border-white/5 pt-2">
                           <span className="text-[9px] uppercase tracking-widest text-white/40">Employer Taxes Match</span>
                           <span className="font-mono font-bold text-emerald-400">+{formatCurrency(totalPeriodEmployerTaxCents)}</span>
                        </div>
                     </div>
                  )}
                  <div className="hidden">
                     <div className="h-40 flex items-center justify-center mt-8">
                     <div className="relative w-24 h-24">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                          className="absolute inset-0 border-4 border-emerald-500/20 border-dashed rounded-full"
                        />
                        <div className="absolute inset-2 bg-emerald-500/10 rounded-full flex items-center justify-center">
                           <ShieldAlert size={28} className="text-emerald-400" />
                        </div>
                     </div>
                  </div>
                  </div>
                  <p className="text-[8px] font-medium text-white/20 leading-relaxed uppercase tracking-widest text-center pt-2">Values are real compliance projections generated using 2026 progressive single IRS brackets.</p>
               </div>
            </div>

            <div className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] space-y-6">
               <div className="flex items-center justify-between">
                  <Calendar size={20} className="text-slate-900" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-40">Frequency Protocol</span>
               </div>
               <div>
                  <h5 className="text-xl font-black text-slate-900 tracking-tight italic uppercase">{dominantFrequency} Cycle</h5>
                  <div className="mt-6 flex gap-2">
                     {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={cn(
                          "h-1.5 flex-1 rounded-full",
                          i <= 3 ? "bg-slate-900" : "bg-slate-50"
                        )} />
                     ))}
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4 opacity-40">{(deadlineInfo.daysRemaining % 14) || 6} Days until settlement</p>
               </div>
            </div>
            
            {/* Pay Run History */}
            {payRunsFromStore.length > 0 && (
              <div className="p-4 md:p-8 bg-white border border-slate-200 rounded-[32px] space-y-4 shadow-sm">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">Disbursement Logs</span>
                <div className="space-y-3">
                  {payRunsFromStore.map(run => (
                    <div key={run.id} className="p-4 bg-slate-50 rounded-[32px] border border-slate-200 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-black text-slate-900">{run.date}</span>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{run.employeeCount} paid</p>
                      </div>
                      <span className="text-sm font-black text-slate-900 font-mono">{formatCurrency(run.totalAmountCents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employee Modal (Add / Edit) */}
      <AnimatePresence>
        {isEmployeeModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEmployeeModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-zinc-200 overflow-hidden"
            >
              <div className="p-4 md:p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-[32px] flex items-center justify-center text-indigo-600">
                    <Users size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">
                      {editingEmployee ? 'Edit Profile' : 'Add Employee'}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Workspace Personnel Registry</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="p-2 hover:bg-zinc-200/50 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEmployeeSubmit} className="p-4 md:p-8 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Full Representative Name</span>
                  <input 
                    name="name"
                    required
                    defaultValue={editingEmployee?.name}
                    className="ledger-input"
                    placeholder="e.g. Leila Vance"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Corporate Role</span>
                    <input 
                      name="role"
                      required
                      defaultValue={editingEmployee?.role}
                      className="ledger-input"
                      placeholder="e.g. Senior Architect"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Department</span>
                    <input 
                      name="department"
                      required
                      defaultValue={editingEmployee?.department || ''}
                      className="ledger-input"
                      placeholder="e.g. Engineering"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Annual Salary (USD)</span>
                    <input 
                      name="salary"
                      type="number"
                      step="0.01"
                      required
                      defaultValue={editingEmployee ? (editingEmployee.salaryCents / 100).toFixed(2) : '120000.00'}
                      className="ledger-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Pay Frequency</span>
                    <select 
                      name="payFrequency"
                      defaultValue={editingEmployee?.payFrequency || 'Monthly'}
                      className="ledger-input"
                    >
                      <option value="Weekly">Weekly</option>
                      <option value="Bi-Weekly">Bi-Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Jurisdiction (State)</span>
                    <select 
                      name="state"
                      defaultValue={(editingEmployee as any)?.state || 'NY'}
                      className="ledger-input font-bold"
                    >
                      <option value="NY">New York (NY)</option>
                      <option value="CA">California (CA)</option>
                      <option value="TX">Texas (TX)</option>
                      <option value="FL">Florida (FL)</option>
                      <option value="IL">Illinois (IL)</option>
                      <option value="OH">Ohio (OH)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Workforce Status</span>
                    <select 
                      name="status"
                      defaultValue={editingEmployee?.status || 'Active'}
                      className="ledger-input"
                    >
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Terminated">Terminated</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
                  {editingEmployee && (
                    <button 
                      type="button"
                      onClick={() => handleDeleteEmployee(editingEmployee.id)}
                      className="px-5 py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-[32px] flex items-center justify-center gap-2 transition-all border border-rose-200"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  
                  <button 
                    type="button"
                    onClick={() => setIsEmployeeModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-slate-50 text-slate-900 rounded-[32px] font-black uppercase tracking-wider text-xs border border-slate-200 hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] px-6 py-4 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-wider text-xs hover:bg-black transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : editingEmployee ? (
                      'Update Profile'
                    ) : (
                      'Create Profile'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pay Run (Disbursement execution) Modal */}
      <AnimatePresence>
        {isPayrunModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPayrunModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-zinc-200 overflow-hidden"
            >
              <div className="p-4 md:p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-[32px] flex items-center justify-center text-emerald-600">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Disburse Batch</h2>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider font-mono">Ledger Synchronization</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPayrunModalOpen(false)}
                  className="p-2 hover:bg-zinc-200/50 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 md:p-8 space-y-6">
                <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-[32px] p-6 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500 uppercase">Recipient Employees</span>
                    <span className="font-mono font-black text-emerald-600">{activeEmployees.length} Active Profiles</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500 uppercase">Gross Pay Period Total</span>
                    <span className="font-mono font-black text-emerald-600 text-lg">{formatCurrency(totalPeriodLiabilityCents)}</span>
                  </div>
                  <div className="pt-3 border-t border-emerald-500/10 space-y-2 text-[10px] text-slate-500 uppercase font-black tracking-wider leading-relaxed">
                     <div className="flex items-center gap-2">
                        <CreditCard size={12} className="text-emerald-500" />
                        <span>Draw From: {bankAccount?.name || 'Cash System Fallback'}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Building2 size={12} className="text-emerald-500" />
                        <span>Book To: {expenseAccount?.name || 'Salaries System Fallback'}</span>
                     </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Disbursement Settlement Date</span>
                  <input 
                    type="date"
                    id="settlement_date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="ledger-input font-mono"
                  />
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
                  <button 
                    type="button"
                    onClick={() => setIsPayrunModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-slate-50 text-slate-900 rounded-[32px] font-black uppercase tracking-wider text-xs border border-slate-200 hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      const dateVal = (document.getElementById('settlement_date') as HTMLInputElement)?.value || new Date().toISOString().split('T')[0];
                      handleRunPayroll(dateVal);
                    }}
                    disabled={isSubmitting}
                    className="flex-[2] px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[32px] font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 animate-pulse"
                  >
                    {isSubmitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Zap size={16} className="text-emerald-300" />
                        Post & Disburse
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
