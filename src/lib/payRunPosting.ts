/**
 * Posting a pay run (U-02). Per active employee, one pay period by src/lib/payroll-engine.ts; the
 * run adds them up and posts one balanced entry on the pay date:
 *   DR wages expense            gross pay
 *   DR payroll tax expense      the employer's taxes
 *   CR the bank account         net pay (what reaches the employees)
 *   CR payroll liabilities      employee withholding + employer taxes + pre-tax deductions (401k, health)
 * gross + employer taxes = net + withholding + deductions + employer taxes, so it always balances.
 * Before, deductions were left out of the entry and it did not balance when an employee had any.
 */
import type { Employee } from '../types';
import { computePeriodPayroll } from './payroll-engine';

export interface PayRunEmployeeLine {
  employeeId: string;
  name: string;
  grossCents: number;
  deductionsCents: number;
  withheldCents: number;
  employerTaxCents: number;
  netCents: number;
  /** U-01: what was withheld, by kind, for the payslip (runs posted before 7 Oct have none) */
  taxes?: { federalCents: number; stateCents: number; localCents: number; socialSecurityCents: number; medicareCents: number };
}

export interface PayRunTotals {
  employees: PayRunEmployeeLine[];
  grossCents: number;
  deductionsCents: number;
  withheldCents: number;
  employerTaxCents: number;
  netCents: number;
  /** what the run costs the business: gross pay plus the employer's taxes */
  costCents: number;
}

export function payRunTotals(employees: Employee[], year: number): PayRunTotals {
  const lines = employees.filter(e => e.status !== 'Terminated').map(e => {
    const calc = computePeriodPayroll(e, year);
    return {
      employeeId: e.id, name: e.name, grossCents: calc.grossPayCents, deductionsCents: calc.preTaxDeductionsCents,
      withheldCents: calc.totalWithholdingCents, employerTaxCents: calc.totalEmployerTaxCents, netCents: calc.netPayCents,
      taxes: {
        federalCents: calc.employeeFederalTaxCents, stateCents: calc.employeeStateTaxCents,
        localCents: calc.employeeCityTaxCents + calc.employeeCountyTaxCents,
        socialSecurityCents: calc.employeeFicaSocialSecurityCents, medicareCents: calc.employeeFicaMedicareCents,
      },
    };
  });
  const sum = (key: 'grossCents' | 'deductionsCents' | 'withheldCents' | 'employerTaxCents' | 'netCents') => lines.reduce((s, l) => s + l[key], 0);
  const grossCents = sum('grossCents');
  const employerTaxCents = sum('employerTaxCents');
  return {
    employees: lines, grossCents, deductionsCents: sum('deductionsCents'), withheldCents: sum('withheldCents'),
    employerTaxCents, netCents: sum('netCents'), costCents: grossCents + employerTaxCents,
  };
}

export interface PayRunAccounts {
  bank: { id: string; name: string };
  wages: { id: string; name: string };
  taxExpense: { id: string; name: string };
  liabilities: { id: string; name: string };
}

export interface PayRunLine { accountId: string; accountName: string; amountCents: number; description: string }

/** The entry's lines (debits positive); lines on the same account are added together. */
export function payRunLines(t: PayRunTotals, a: PayRunAccounts): PayRunLine[] {
  const rows = new Map<string, PayRunLine>();
  const add = (acc: { id: string; name: string }, cents: number, description: string) => {
    if (!cents) return;
    const row = rows.get(acc.id) || { accountId: acc.id, accountName: acc.name, amountCents: 0, description };
    row.amountCents += cents;
    rows.set(acc.id, row);
  };
  add(a.wages, t.grossCents, `Gross wages (${t.employees.length} employee${t.employees.length === 1 ? '' : 's'})`);
  add(a.taxExpense, t.employerTaxCents, "Employer's payroll taxes");
  add(a.bank, -t.netCents, 'Net pay to employees');
  add(a.liabilities, -(t.withheldCents + t.employerTaxCents + t.deductionsCents), 'Taxes withheld, employer taxes and deductions to pay over');
  return [...rows.values()].filter(r => r.amountCents !== 0);
}

export interface YearToDate { grossCents: number; deductionsCents: number; withheldCents: number; employerTaxCents: number; netCents: number; runs: number }

/**
 * U-03: per employee, what the posted pay runs of a calendar year paid (undone runs left out).
 * Runs posted before U-02 have no per-employee amounts and are not counted.
 */
export function yearToDate(runs: Array<{ date: string; status: string; employees?: PayRunEmployeeLine[] }>, year: string): Map<string, YearToDate> {
  const out = new Map<string, YearToDate>();
  for (const run of runs) {
    if (run.status !== 'processed' || !String(run.date).startsWith(`${year}-`)) continue;
    for (const e of run.employees || []) {
      const row = out.get(e.employeeId) || { grossCents: 0, deductionsCents: 0, withheldCents: 0, employerTaxCents: 0, netCents: 0, runs: 0 };
      row.grossCents += e.grossCents;
      row.deductionsCents += e.deductionsCents;
      row.withheldCents += e.withheldCents;
      row.employerTaxCents += e.employerTaxCents;
      row.netCents += e.netCents;
      row.runs++;
      out.set(e.employeeId, row);
    }
  }
  return out;
}
