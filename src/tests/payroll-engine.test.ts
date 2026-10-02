import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { computePeriodPayroll, getFederalTaxYearConfig, PAYROLL_DISCLAIMER } from '../lib/payroll-engine.js';
import { Employee } from '../types.js';

describe('Payroll Engine Mathematical Tie-Out & Cap Verification', () => {
  test('Tax configuration loads statutory limits for 2026', () => {
    const config = getFederalTaxYearConfig(2026);
    assert.equal(config.socialSecurityWageBaseCents, 18300000); // $183,000
    assert.equal(config.futaWageBaseCents, 700000); // $7,000
    assert.equal(config.standardDeductionSingleCents, 1545000); // $15,450
    assert.equal(config.standardDeductionMarriedCents, 3090000); // $30,900
    assert.equal(config.additionalMedicareThresholdSingleCents, 20000000); // $200,000
    assert.equal(config.additionalMedicareThresholdMarriedCents, 25000000); // $250,000
  });

  test('FUTA is capped at $7,000 wage base (maximum $42/yr)', () => {
    const highEarner: Employee = {
      id: 'emp_1',
      uid: 'u1',
      workspaceId: 'ws_1',
      name: 'Alice High Earner',
      email: 'alice@example.com',
      role: 'Executive',
      salaryCents: 20000000, // $200,000/yr
      payFrequency: 'Monthly', // 12 periods
      status: 'Active',
      createdAt: '2026-01-01'
    };

    const breakdown = computePeriodPayroll(highEarner, 2026);
    // Annual FUTA = 0.6% * $7,000 = $42.00 = 4200 cents. Monthly = 4200 / 12 = 350 cents ($3.50)
    assert.equal(breakdown.employerFutaCents, 350, 'FUTA was not capped at $7,000 wage base');
  });

  test('Social Security is capped at annual wage limit', () => {
    const standardEarner: Employee = {
      id: 'emp_2',
      uid: 'u1',
      workspaceId: 'ws_1',
      name: 'Bob Standard',
      email: 'bob@example.com',
      role: 'Engineer',
      salaryCents: 6000000, // $60,000/yr
      payFrequency: 'Monthly', // 12 periods
      status: 'Active',
      createdAt: '2026-01-01'
    };

    const highEarner: Employee = {
      id: 'emp_3',
      uid: 'u1',
      workspaceId: 'ws_1',
      name: 'Charlie Executive',
      email: 'charlie@example.com',
      role: 'VP',
      salaryCents: 30000000, // $300,000/yr
      payFrequency: 'Monthly', // 12 periods
      status: 'Active',
      createdAt: '2026-01-01'
    };

    const stdBreakdown = computePeriodPayroll(standardEarner, 2026);
    const highBreakdown = computePeriodPayroll(highEarner, 2026);

    // Standard earner: 6.2% of $60,000 = $3,720/yr -> $310/mo = 31000 cents
    assert.equal(stdBreakdown.employeeFicaSocialSecurityCents, 31000);
    assert.equal(stdBreakdown.employerFicaSocialSecurityCents, 31000);

    // High earner capped at $183,000 for 2026 -> 6.2% of $183,000 = $11,346/yr -> $945.50/mo = 94550 cents
    assert.equal(highBreakdown.employeeFicaSocialSecurityCents, 94550);
    assert.equal(highBreakdown.employerFicaSocialSecurityCents, 94550);
  });

  test('Additional Medicare Tax applies only to high earners over threshold and is not matched by employer', () => {
    const singleExec: Employee = {
      id: 'emp_4',
      uid: 'u1',
      workspaceId: 'ws_1',
      name: 'Diana Single VP',
      email: 'diana@example.com',
      role: 'VP',
      salaryCents: 30000000, // $300,000/yr
      payFrequency: 'Monthly', // 12 periods
      filingStatus: 'Single',
      status: 'Active',
      createdAt: '2026-01-01'
    };

    const breakdown = computePeriodPayroll(singleExec, 2026);

    // Single threshold is $200,000. Excess = $100,000.
    // Base Medicare = 1.45% of $300k = $4,350/yr -> $362.50/mo = 36250 cents.
    // Additional Medicare = 0.9% of $100k = $900/yr -> $75.00/mo = 7500 cents.
    // Total Employee Medicare = 36250 + 7500 = 43750 cents.
    // Employer Medicare = standard 1.45% only = 36250 cents.
    assert.equal(breakdown.employeeAdditionalMedicareCents, 7500);
    assert.equal(breakdown.employeeFicaMedicareCents, 43750);
    assert.equal(breakdown.employerFicaMedicareCents, 36250);
  });

  test('Pre-tax deductions reduce taxable income and net pay correctly', () => {
    const employeeWithBenefits: Employee = {
      id: 'emp_5',
      uid: 'u1',
      workspaceId: 'ws_1',
      name: 'Evan Benefits',
      email: 'evan@example.com',
      role: 'Staff',
      salaryCents: 12000000, // $120,000/yr ($10,000/mo)
      payFrequency: 'Monthly',
      preTaxDeductionsCents: 100000, // $1,000/mo 401(k) / Health
      status: 'Active',
      createdAt: '2026-01-01'
    };

    const breakdown = computePeriodPayroll(employeeWithBenefits, 2026);
    assert.equal(breakdown.grossPayCents, 1000000); // $10,000
    assert.equal(breakdown.preTaxDeductionsCents, 100000); // $1,000
    assert.equal(breakdown.taxableGrossCents, 900000); // $9,000

    // Net pay must equal grossPay - preTaxDeductions - totalWithholding
    assert.equal(
      breakdown.netPayCents,
      breakdown.grossPayCents - breakdown.preTaxDeductionsCents - breakdown.totalWithholdingCents
    );
  });

  test('Total enterprise liability ties out: Gross Pay + Total Employer Taxes', () => {
    const employee: Employee = {
      id: 'emp_6',
      uid: 'u1',
      workspaceId: 'ws_1',
      name: 'Fiona Test',
      email: 'fiona@example.com',
      role: 'Dev',
      salaryCents: 9600000, // $96,000/yr ($8,000/mo)
      payFrequency: 'Monthly',
      status: 'Active',
      createdAt: '2026-01-01'
    };

    const breakdown = computePeriodPayroll(employee, 2026);
    assert.equal(
      breakdown.totalPeriodLiabilityCents,
      breakdown.grossPayCents + breakdown.totalEmployerTaxCents
    );
    assert.equal(breakdown.disclaimer, PAYROLL_DISCLAIMER);
  });
});
