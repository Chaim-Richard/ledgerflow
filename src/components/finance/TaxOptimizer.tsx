import React, { useMemo, useState } from 'react';
import { Transaction } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Target, 
  ShieldCheck, 
  AlertTriangle, 
  Info,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Zap,
  Lightbulb,
  FileText,
  Baby,
  Sparkles,
  Check,
  Brain,
  Copy,
  FileSpreadsheet,
  Coins
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { computeFederalIncomeTaxWithholding, getRegionalTaxConfig, getFederalTaxYearConfig } from '../../lib/payroll-engine';
import { computeExpenseDeductibility } from '../../lib/business-expenses';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
  Line
} from 'recharts';

interface TaxOptimizerProps {
  transactions: Transaction[];
  onAction: (action: string, details?: any) => void;
}

export default function TaxOptimizer({ transactions, onAction }: TaxOptimizerProps) {
  const [activePanel, setActivePanel] = useState<'matrix' | 'projections' | 'filing_draft'>('matrix');
  const [revenueGrowth, setRevenueGrowth] = useState<number>(15);
  const [expenseGrowth, setExpenseGrowth] = useState<number>(10);
  const [inflationRate, setInflationRate] = useState<number>(2.5);
  const [selectedFormatYear, setSelectedFormatYear] = useState<number>(2026);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);
  const [activeFilingForm, setActiveFilingForm] = useState<'schedule_c' | 'form_1120'>('schedule_c');

  const TAXPAYER_PERSONAS: any[] = [];

  const applyTaxPersona = (p: typeof TAXPAYER_PERSONAS[0]) => {
    setEntityType(p.entityType);
    if (p.entityType === 'C-Corp') {
      setActiveFilingForm('form_1120');
    } else {
      setActiveFilingForm('schedule_c');
    }
    setPersonalProfile({
      filingStatus: p.filingStatus,
      dependentsCount: p.dependentsCount,
      state: p.state,
      childTaxCreditAmountCents: p.dependentsCount * 2000 * 100,
      explanation: p.explanation,
      isConfirmed: true
    });
  };

  const [taxRate, setTaxRate] = useState(21); // Default C-Corp flat rate is 21%
  const [taxYear, setTaxYear] = useState<number>(2026);
  const [entityType, setEntityType] = useState<'Sole-Prop' | 'S-Corp' | 'C-Corp'>('Sole-Prop');
  const [sCorpSalaryPercent, setSCorpSalaryPercent] = useState<number>(60); // W-2 Reasonable Compensation (default 60%)

  // Personal status and dependent tax strategist state
  const [personalProfile, setPersonalProfile] = useState<{
    filingStatus: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household';
    dependentsCount: number;
    state: string;
    childTaxCreditAmountCents: number;
    explanation: string;
    isConfirmed: boolean;
  }>({
    filingStatus: 'Single',
    dependentsCount: 0,
    state: 'NY',
    childTaxCreditAmountCents: 0,
    explanation: 'Unconfigured profile. Default single filer progressive tax brackets apply.',
    isConfirmed: false
  });

  const [chatInput, setChatInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const taxMetrics = useMemo(() => {
    const revenue = transactions.filter(t => t.totalAmountCents > 0).reduce((s, t) => s + t.totalAmountCents, 0);
    const expenses = transactions.filter(t => t.totalAmountCents < 0).reduce((s, t) => s + Math.abs(t.totalAmountCents), 0);
    
    let totalDeductibleCents = 0;
    let totalNonDeductibleCents = 0;

    // Segment and accumulate category-level stats
    const categorySubtotals: Record<string, { raw: number; deductible: number; nonDeductible: number; rate: number; warning?: string }> = {};
    const deductibleGroups: Record<string, number> = {};

    transactions.filter(t => t.totalAmountCents < 0).forEach(t => {
      const accountName = t.lines?.[0]?.accountName || 'General Operating';
      const description = t.description || '';
      const amountCents = Math.abs(t.totalAmountCents);

      const calc = computeExpenseDeductibility(accountName, amountCents, description);
      
      totalDeductibleCents += calc.deductibleAmountCents;
      totalNonDeductibleCents += calc.nonDeductibleAmountCents;

      const catName = calc.category.name;
      if (!categorySubtotals[catName]) {
        categorySubtotals[catName] = {
          raw: 0,
          deductible: 0,
          nonDeductible: 0,
          rate: calc.category.irsDeductibilityRate,
          warning: calc.category.potentialMishapWarning
        };
      }
      categorySubtotals[catName].raw += amountCents;
      categorySubtotals[catName].deductible += calc.deductibleAmountCents;
      categorySubtotals[catName].nonDeductible += calc.nonDeductibleAmountCents;

      deductibleGroups[catName] = (deductibleGroups[catName] || 0) + calc.deductibleAmountCents;
    });

    const scheduleCTable = Object.entries(categorySubtotals).map(([name, bundle]) => ({
      categoryName: name,
      rawAmountCents: bundle.raw,
      deductibleAmountCents: bundle.deductible,
      nonDeductibleAmountCents: bundle.nonDeductible,
      rate: bundle.rate,
      potentialMishapWarning: bundle.warning
    })).sort((a, b) => b.rawAmountCents - a.rawAmountCents);

    const netOperatingProfit = Math.max(0, revenue - totalDeductibleCents);
    let standardDeductionCents = 0;

    if (personalProfile.filingStatus === 'Married Filing Jointly') {
      standardDeductionCents = 3090000; // 2026 Proj value Standard Married
    } else if (personalProfile.filingStatus === 'Head of Household') {
      standardDeductionCents = 2315000;
    } else {
      standardDeductionCents = 1545000;
    }

    let selfEmploymentTaxCents = 0;
    let payrollTaxCents = 0;
    let stateTaxCents = 0;
    let localTaxCents = 0;
    let federalTaxableIncomeCents = 0;
    let progressiveFedTax = 0;
    let qbiDeductionCents = 0;

    const regional = getRegionalTaxConfig(personalProfile.state, `${taxYear}-12-31`);

    if (entityType === 'Sole-Prop') {
      // Net profit is draft Schedule C income
      // Subject to 15.3% Self-Employment Tax on 92.35%
      const netEarningsCents = Math.round(netOperatingProfit * 0.9235);
      
      // Social security cap for 2026 is ~$182,150
      const ssLimitCents = 182150 * 100;
      const ssTaxableCents = Math.min(netEarningsCents, ssLimitCents);
      const ssTax = Math.round(ssTaxableCents * 0.124);
      
      const medTax = Math.round(netEarningsCents * 0.029);
      // Additional Medicare tax 0.9% above threshold
      const addMedThreshold = personalProfile.filingStatus === 'Married Filing Jointly' ? 250000 * 100 : 200000 * 100;
      const addMedTaxable = Math.max(0, netEarningsCents - addMedThreshold);
      const addMedTax = Math.round(addMedTaxable * 0.009);

      selfEmploymentTaxCents = ssTax + medTax + addMedTax;

      // 50% SE tax is deductible from AGI under Section 164(f)
      const seDeductionCents = Math.round(selfEmploymentTaxCents * 0.5);

      // Qualified Business Income (QBI) deduction
      // Software is Specified Service Trade or Business (SSTB). Phaseouts apply:
      const qbiBase = Math.max(0, netOperatingProfit - seDeductionCents);
      const threshold = personalProfile.filingStatus === 'Married Filing Jointly' ? 364200 * 100 : 182100 * 100;
      const phaseOutRange = 50000 * 100;

      if (qbiBase <= threshold) {
        qbiDeductionCents = Math.round(qbiBase * 0.20);
      } else if (qbiBase < threshold + phaseOutRange) {
        const fraction = 1 - (qbiBase - threshold) / phaseOutRange;
        qbiDeductionCents = Math.round(qbiBase * 0.20 * fraction);
      } else {
        qbiDeductionCents = 0; // Fully phased out for SSTB services above upper limit!
      }

      federalTaxableIncomeCents = Math.max(0, netOperatingProfit - standardDeductionCents - seDeductionCents - qbiDeductionCents);
      progressiveFedTax = computeFederalIncomeTaxWithholding(federalTaxableIncomeCents, 1, taxYear);
      
      if (personalProfile.filingStatus === 'Married Filing Jointly') {
        progressiveFedTax = Math.round(progressiveFedTax * 0.85); 
      } else if (personalProfile.filingStatus === 'Head of Household') {
        progressiveFedTax = Math.round(progressiveFedTax * 0.92);
      }

      stateTaxCents = Math.round(netOperatingProfit * regional.stateRate);
      localTaxCents = Math.round(netOperatingProfit * ((regional.cityRate || 0) + (regional.countyRate || 0)));

    } else if (entityType === 'S-Corp') {
      // S-Corp reasonable salary allocation
      const salaryPercent = sCorpSalaryPercent / 100;
      const w2SalaryCents = Math.round(netOperatingProfit * salaryPercent);
      const remainingProfitCents = Math.max(0, netOperatingProfit - w2SalaryCents);

      // FICA tax: 15.3% overall on W-2 salary part
      const ssLimitCents = 182150 * 100;
      const ssTaxableCents = Math.min(w2SalaryCents, ssLimitCents);
      
      const employerFicaCents = Math.round(ssTaxableCents * 0.062 + w2SalaryCents * 0.0145);
      const employeeFicaCents = Math.round(ssTaxableCents * 0.062 + w2SalaryCents * 0.0145);
      
      payrollTaxCents = employerFicaCents + employeeFicaCents;

      // Employer FICA deductions reduces corporate profit passes-through
      const sCorpNetDistributionCents = Math.max(0, remainingProfitCents - employerFicaCents);

      // QBI deduction calculated on the S-Corp Net Distribution
      const threshold = personalProfile.filingStatus === 'Married Filing Jointly' ? 364200 * 100 : 182100 * 100;
      const phaseOutRange = 50000 * 100;
      const qbiBase = sCorpNetDistributionCents;

      if (qbiBase <= threshold) {
        qbiDeductionCents = Math.round(qbiBase * 0.20);
      } else if (qbiBase < threshold + phaseOutRange) {
        const fraction = 1 - (qbiBase - threshold) / phaseOutRange;
        qbiDeductionCents = Math.round(qbiBase * 0.20 * fraction);
      } else {
        qbiDeductionCents = 0;
      }

      // personal federal taxable income
      federalTaxableIncomeCents = Math.max(0, w2SalaryCents + sCorpNetDistributionCents - standardDeductionCents - qbiDeductionCents);
      progressiveFedTax = computeFederalIncomeTaxWithholding(federalTaxableIncomeCents, 1, taxYear);
      
      if (personalProfile.filingStatus === 'Married Filing Jointly') {
        progressiveFedTax = Math.round(progressiveFedTax * 0.85); 
      } else if (personalProfile.filingStatus === 'Head of Household') {
        progressiveFedTax = Math.round(progressiveFedTax * 0.92);
      }

      stateTaxCents = Math.round(netOperatingProfit * regional.stateRate);
      localTaxCents = Math.round(netOperatingProfit * ((regional.cityRate || 0) + (regional.countyRate || 0)));

    } else {
      // C-Corp flat rate applies (21%)
      progressiveFedTax = Math.round((netOperatingProfit * taxRate) / 100);
      stateTaxCents = Math.round(netOperatingProfit * regional.stateRate);
      localTaxCents = Math.round(netOperatingProfit * ((regional.cityRate || 0) + (regional.countyRate || 0)));
      federalTaxableIncomeCents = netOperatingProfit;
    }

    // Child Tax Credit Offsets ($2,000 per children directly subtracted)
    const ctcSubtracted = personalProfile.isConfirmed ? personalProfile.dependentsCount * 2000 * 100 : 0;
    const fedTaxAfterCredit = Math.max(0, progressiveFedTax - ctcSubtracted);

    const estimatedTax = fedTaxAfterCredit + selfEmploymentTaxCents + payrollTaxCents + stateTaxCents + localTaxCents;

    const dedData = Object.entries(deductibleGroups)
      .map(([name, value]) => ({ name, value: value / 100 }))
      .sort((a, b) => b.value - a.value);

    // Calculate dynamic effective rate
    const calculatedEffectiveRate = netOperatingProfit > 0 ? (estimatedTax / netOperatingProfit) * 100 : 0;

    // S-Corp theoretical optimization savings compared to a basic Sole-Prop structure
    let potentialSavings = 0;
    if (entityType === 'Sole-Prop') {
      const reasonableW2 = Math.round(netOperatingProfit * 0.60);
      const theoreticalEmployerFica = Math.round(Math.min(reasonableW2, 18660000) * 0.062 + reasonableW2 * 0.0145);
      const theoreticalEmployeeFica = Math.round(Math.min(reasonableW2, 18660000) * 0.062 + reasonableW2 * 0.0145);
      const theoreticalTotalFica = theoreticalEmployerFica + theoreticalEmployeeFica;
      potentialSavings = Math.max(0, selfEmploymentTaxCents - theoreticalTotalFica);
    } else if (entityType === 'S-Corp') {
      const fullSE = Math.round(netOperatingProfit * 0.9235 * 0.153);
      potentialSavings = Math.max(0, fullSE - payrollTaxCents);
    } else {
      potentialSavings = Math.max(0, (netOperatingProfit * 0.35) - estimatedTax);
    }

    return {
      revenue,
      expenses,
      totalDeductibleCents,
      totalNonDeductibleCents,
      taxableIncome: federalTaxableIncomeCents,
      estimatedTax,
      calculatedEffectiveRate,
      dedData,
      scheduleCTable,
      potentialSavings,
      
      // Personal metadata breakdown
      isPersonalized: personalProfile.isConfirmed,
      standardDeductionCents,
      progressiveFedTax,
      ctcSubtracted,
      stateTax: stateTaxCents,
      localTax: localTaxCents,
      selfEmploymentTaxCents,
      payrollTaxCents,
      filingStatus: personalProfile.filingStatus,
      dependentsCount: personalProfile.dependentsCount,
      personalState: personalProfile.state
    };
  }, [transactions, taxRate, taxYear, entityType, personalProfile, sCorpSalaryPercent]);

  const forecastYears = useMemo(() => {
    const years = [2026, 2027, 2028, 2029, 2030];
    
    // Base parameters from current transactions
    const baseRevenue = taxMetrics.revenue;
    const baseDeductibleExpenses = taxMetrics.totalDeductibleCents;
    const baseNonDeductibleExpenses = taxMetrics.totalNonDeductibleCents;
    
    return years.map((yr, idx) => {
      const yearMultiplierRev = Math.pow(1 + revenueGrowth / 100, idx);
      const yearMultiplierExp = Math.pow(1 + expenseGrowth / 100, idx);
      
      const projectedRevenueCents = Math.round(baseRevenue * yearMultiplierRev);
      const projectedDeductibleCents = Math.round(baseDeductibleExpenses * yearMultiplierExp);
      const projectedNonDeductibleCents = Math.round(baseNonDeductibleExpenses * yearMultiplierExp);
      const totalExpensesCents = projectedDeductibleCents + projectedNonDeductibleCents;
      
      const netOperatingIncomeCents = Math.max(0, projectedRevenueCents - projectedDeductibleCents);
      
      // Calculate standard deduction indexed for inflation
      let standardDeductionCents = 0;
      if (personalProfile.filingStatus === 'Married Filing Jointly') {
        standardDeductionCents = 3090000;
      } else if (personalProfile.filingStatus === 'Head of Household') {
        standardDeductionCents = 2315000;
      } else {
        standardDeductionCents = 1545000;
      }
      // Apply compounding inflation
      standardDeductionCents = Math.round(standardDeductionCents * Math.pow(1 + inflationRate / 100, idx));
      
      let selfEmploymentTaxCents = 0;
      let payrollTaxCents = 0;
      let qbiDeductionCents = 0;
      let federalTaxableCents = 0;
      let progressiveFedTaxCents = 0;

      const regional = getRegionalTaxConfig(personalProfile.state, `${taxYear + idx}-12-31`);

      if (entityType === 'Sole-Prop') {
        // Sole Prop: 15.3% SE tax on 92.35%
        const netEarningsCents = Math.round(netOperatingIncomeCents * 0.9235);
        const ssLimitCents = 182150 * 100 * Math.pow(1 + inflationRate / 100, idx); // indexed limit
        const ssTaxableCents = Math.min(netEarningsCents, ssLimitCents);
        const ssTax = Math.round(ssTaxableCents * 0.124);
        const medTax = Math.round(netEarningsCents * 0.029);
        
        selfEmploymentTaxCents = ssTax + medTax;
        const seDeductionCents = Math.round(selfEmploymentTaxCents * 0.5);

        // QBI with Specified Service Trade or Business (SSTB) bounds
        const qbiBase = Math.max(0, netOperatingIncomeCents - seDeductionCents);
        const threshold = (personalProfile.filingStatus === 'Married Filing Jointly' ? 364200 * 100 : 182100 * 100) * Math.pow(1 + inflationRate / 100, idx);
        const phaseOutRange = 50000 * 100;

        if (qbiBase <= threshold) {
          qbiDeductionCents = Math.round(qbiBase * 0.20);
        } else if (qbiBase < threshold + phaseOutRange) {
          const fraction = 1 - (qbiBase - threshold) / phaseOutRange;
          qbiDeductionCents = Math.round(qbiBase * 0.20 * fraction);
        } else {
          qbiDeductionCents = 0;
        }

        federalTaxableCents = Math.max(0, netOperatingIncomeCents - standardDeductionCents - seDeductionCents - qbiDeductionCents);
        
        const config = getFederalTaxYearConfig(2026);
        let hohMultiplier = 1;
        if (personalProfile.filingStatus === 'Married Filing Jointly') hohMultiplier = 2;
        else if (personalProfile.filingStatus === 'Head of Household') hohMultiplier = 1.45;

        const inflatedBrackets = config.brackets.map(bracket => ({
          rate: bracket.rate,
          limitCents: bracket.limitCents === Infinity 
            ? Infinity 
            : Math.round(bracket.limitCents * hohMultiplier * Math.pow(1 + inflationRate / 100, idx))
        }));

        let remainingCents = federalTaxableCents;
        let previousLimitCents = 0;
        for (const bracket of inflatedBrackets) {
          const widthCents = bracket.limitCents - previousLimitCents;
          const taxableInThisBracketCents = Math.min(remainingCents, widthCents);
          if (taxableInThisBracketCents <= 0) break;
          progressiveFedTaxCents += taxableInThisBracketCents * bracket.rate;
          remainingCents -= taxableInThisBracketCents;
          previousLimitCents = bracket.limitCents;
        }

      } else if (entityType === 'S-Corp') {
        const salaryPercent = sCorpSalaryPercent / 100;
        const w2SalaryCents = Math.round(netOperatingIncomeCents * salaryPercent);
        const remainingProfitCents = Math.max(0, netOperatingIncomeCents - w2SalaryCents);

        const ssLimitCents = 182150 * 100 * Math.pow(1 + inflationRate / 100, idx);
        const ssTaxableCents = Math.min(w2SalaryCents, ssLimitCents);
        const employerFicaCents = Math.round(ssTaxableCents * 0.062 + w2SalaryCents * 0.0145);
        const employeeFicaCents = Math.round(ssTaxableCents * 0.062 + w2SalaryCents * 0.0145);
        payrollTaxCents = employerFicaCents + employeeFicaCents;

        const sCorpNetDistributionCents = Math.max(0, remainingProfitCents - employerFicaCents);

        const threshold = (personalProfile.filingStatus === 'Married Filing Jointly' ? 364200 * 100 : 182100 * 100) * Math.pow(1 + inflationRate / 100, idx);
        const phaseOutRange = 50000 * 100;
        const qbiBase = sCorpNetDistributionCents;

        if (qbiBase <= threshold) {
          qbiDeductionCents = Math.round(qbiBase * 0.20);
        } else if (qbiBase < threshold + phaseOutRange) {
          const fraction = 1 - (qbiBase - threshold) / phaseOutRange;
          qbiDeductionCents = Math.round(qbiBase * 0.20 * fraction);
        } else {
          qbiDeductionCents = 0;
        }

        federalTaxableCents = Math.max(0, w2SalaryCents + sCorpNetDistributionCents - standardDeductionCents - qbiDeductionCents);
        
        const config = getFederalTaxYearConfig(2026);
        let hohMultiplier = 1;
        if (personalProfile.filingStatus === 'Married Filing Jointly') hohMultiplier = 2;
        else if (personalProfile.filingStatus === 'Head of Household') hohMultiplier = 1.45;

        const inflatedBrackets = config.brackets.map(bracket => ({
          rate: bracket.rate,
          limitCents: bracket.limitCents === Infinity 
            ? Infinity 
            : Math.round(bracket.limitCents * hohMultiplier * Math.pow(1 + inflationRate / 100, idx))
        }));

        let remainingCents = federalTaxableCents;
        let previousLimitCents = 0;
        for (const bracket of inflatedBrackets) {
          const widthCents = bracket.limitCents - previousLimitCents;
          const taxableInThisBracketCents = Math.min(remainingCents, widthCents);
          if (taxableInThisBracketCents <= 0) break;
          progressiveFedTaxCents += taxableInThisBracketCents * bracket.rate;
          remainingCents -= taxableInThisBracketCents;
          previousLimitCents = bracket.limitCents;
        }

      } else {
        // C-Corp (Flat Rate)
        federalTaxableCents = netOperatingIncomeCents;
        progressiveFedTaxCents = (netOperatingIncomeCents * taxRate) / 100;
      }
      
      // Child tax credit (CTC)
      const ctcCents = personalProfile.dependentsCount * 2000 * 100;
      const federalTaxAfterCreditCents = Math.max(0, progressiveFedTaxCents - ctcCents);
      
      // State and local surcharges
      const stateTaxCents = Math.round(netOperatingIncomeCents * regional.stateRate);
      const localTaxCents = Math.round(netOperatingIncomeCents * ((regional.cityRate || 0) + (regional.countyRate || 0)));
      
      const totalTaxLiabilityCents = federalTaxAfterCreditCents + selfEmploymentTaxCents + payrollTaxCents + stateTaxCents + localTaxCents;
      const afterTaxNetIncomeCents = projectedRevenueCents - totalExpensesCents - totalTaxLiabilityCents;
      
      const effectiveRate = netOperatingIncomeCents > 0 ? (totalTaxLiabilityCents / netOperatingIncomeCents) * 100 : 0;
      
      return {
        year: yr,
        revenue: projectedRevenueCents,
        expenses: totalExpensesCents,
        deductibleExpenses: projectedDeductibleCents,
        netIncome: projectedRevenueCents - totalExpensesCents,
        standardDeduction: standardDeductionCents,
        qbiDeduction: qbiDeductionCents,
        taxableIncome: federalTaxableCents,
        fedTax: progressiveFedTaxCents,
        ctcOffset: ctcCents,
        stateTax: stateTaxCents,
        localTax: localTaxCents,
        taxLiability: totalTaxLiabilityCents,
        afterTaxNet: afterTaxNetIncomeCents,
        effectiveTaxRate: effectiveRate
      };
    });
  }, [
    taxMetrics, 
    revenueGrowth, 
    expenseGrowth, 
    inflationRate, 
    personalProfile, 
    entityType, 
    taxRate,
    sCorpSalaryPercent
  ]);

  const handleAIParse = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsAnalyzing(true);
    try {
      const text = queryText.toLowerCase();
      
      // Infer entity structure from natural language
      let inferredEntity: 'Sole-Prop' | 'S-Corp' | 'C-Corp' = 'Sole-Prop';
      if (text.includes('c-corp') || text.includes('c corp') || text.includes('corporation') || text.includes('flat rate') || text.includes('corporate tax') || text.includes('inc.')) {
        inferredEntity = 'C-Corp';
      } else if (text.includes('s-corp') || text.includes('s corp')) {
        inferredEntity = 'S-Corp';
      } else if (text.includes('sole prop') || text.includes('sole proprietor') || text.includes('schedule c') || text.includes('freelancer') || text.includes('gig')) {
        inferredEntity = 'Sole-Prop';
      }
      setEntityType(inferredEntity);

      let filingStatus: "Single" | "Married Filing Jointly" | "Married Filing Separately" | "Head of Household" = "Single";
      if (text.includes('married') && text.includes('separately')) {
        filingStatus = "Married Filing Separately";
      } else if (text.includes('married') || text.includes('joint')) {
        filingStatus = "Married Filing Jointly";
      } else if (text.includes('head of household')) {
        filingStatus = "Head of Household";
      }

      const depsMatch = text.match(/(\d+)\s+(child|children|kid|kids|dependent|dependents)/);
      const dependentsCount = depsMatch ? parseInt(depsMatch[1]) : 0;
      
      const stateMatch = text.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i);
      const state = stateMatch ? stateMatch[1].toUpperCase() : 'NY';

      setPersonalProfile({
        filingStatus: filingStatus,
        dependentsCount: dependentsCount,
        state: state,
        childTaxCreditAmountCents: dependentsCount * 200000,
        explanation: `Algorithmically inferred profile from text.` + (inferredEntity === 'C-Corp' ? ' Clustered under corporate C-Corp flat-tax modeling.' : (inferredEntity === 'S-Corp' ? ' Calibrated to custom S-Corp split dividend-salary modeling.' : ' Calibrated to personal flow-through sole-proprietorship progressive tax modeling.')),
        isConfirmed: true // Auto-confirm for instant simulation!
      });
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const currentFilingDraftText = useMemo(() => {
    if (activeFilingForm === 'schedule_c') {
      const grossReceipts = taxMetrics.revenue / 100;
      const totalDed = taxMetrics.totalDeductibleCents / 100;
      const netProfit = grossReceipts - totalDed;
      const qbiDec = netProfit * 0.20;

      return `========================================================================
             DEPARTMENT OF THE TREASURY - INTERNAL REVENUE SERVICE
                         FORM 1040 SCHEDULE C (DRAFT)
========================================================================
Tax Law Year:  ${taxYear} (Personal Sync Mode)
Filer Status:   ${personalProfile.filingStatus}
Principal Business Code:  541511 (Software & Technical Advisory)
Business Name:  Ledger Node Enterprise Studio (Draft System LLC)
State Jurisdiction: ${personalProfile.state}
------------------------------------------------------------------------
PART I - INCOME
------------------------------------------------------------------------
Line 1: Gross Receipts or Sales                  $ ${grossReceipts.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Line 3: Gross Profit                             $ ${grossReceipts.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Line 7: Gross Income                             $ ${grossReceipts.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}

------------------------------------------------------------------------
PART II - DETAILED BUSINESS DEDUCTIBLE EXPENSES (§ 162 IRC)
------------------------------------------------------------------------
${taxMetrics.scheduleCTable.map(row => `${row.categoryName.padEnd(46, '.')} $ ${(row.deductibleAmountCents / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`).join('\n')}

Line 28: Total Allowable Expenses                $ ${totalDed.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Line 31: NET OPERATING PROFIT (OR LOSS)          $ ${netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}

------------------------------------------------------------------------
FORM 8995 SUMMARY - QUALIFIED BUSINESS INCOME (QBI) ADVISOR
------------------------------------------------------------------------
Line 1: Qualified Business Income (QBI)          $ ${netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Line 4: QBI Flat 20% Section 199A Deduction      $ ${qbiDec.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
(Estimated reduction in net exposure: saves about $ ${(qbiDec * 0.22).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} in federal tax)
========================================================================`;
    } else {
      const grossReceipts = taxMetrics.revenue / 100;
      const totalDed = taxMetrics.totalDeductibleCents / 100;
      const taxable = Math.max(0, grossReceipts - totalDed);
      const fedTaxObj = (taxable * taxRate) / 100;

      return `========================================================================
             DEPARTMENT OF THE TREASURY - INTERNAL REVENUE SERVICE
                            FORM 1120 (C-CORPORATION)
========================================================================
Tax Law Year:  ${taxYear} (Flat Corporate Sync)
Entity Structure: C-Corporation (1120 Flat Rate)
Tax Rate Base: ${taxRate} % Flat Federal
Federal EIN Status: Pending Entity Verification / Unlinked
State Jurisdiction: ${personalProfile.state}
------------------------------------------------------------------------
Line 1a: Gross Receipts or Sales                 $ ${grossReceipts.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Line 11: Total Gross Income                      $ ${grossReceipts.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}

------------------------------------------------------------------------
PART II - DEDUCTIONS
------------------------------------------------------------------------
Line 22: Operating deductions (§ 162 Rules)      $ ${totalDed.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Line 27: Total Deductions                        $ ${totalDed.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Line 30: TAXABLE OPERATING INCOME                $ ${taxable.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}

------------------------------------------------------------------------
TAX LIABILITY & BALANCES
------------------------------------------------------------------------
Line 31: Total Base Federal Tax Owed (${taxRate}%)      $ ${fedTaxObj.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Line 35: Combined State Franchise / SIT Owed     $ ${(taxMetrics.stateTax / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
========================================================================`;
    }
  }, [activeFilingForm, taxMetrics, taxYear, taxRate, personalProfile]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(currentFilingDraftText);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const formatCurrencyValue = (cents: number) => {
    return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const COLORS = ['#F97316', '#10B981', '#6366F1', '#EC4899', '#8B5CF6'];

  return (
    <div className="space-y-12 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate mb-4">
            <Calculator size={14} />
            Fiscal Obligation Architect
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase">Tax Strategy Node</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">Advanced modeling for multi-jurisdictional tax optimization and compliance.</p>
        </div>
        <div className="p-4 md:p-8 bg-slate-50 rounded-[32px] border border-slate-200 flex flex-wrap md:flex-nowrap items-center gap-8 shadow-sm">
           <div className="space-y-2">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-40">Entity Structure</span>
             <select
               value={entityType}
               onChange={(e) => setEntityType(e.target.value as any)}
               className="bg-white border border-slate-200 rounded-xl px-4 py-1.5 text-xs font-black text-slate-900 outline-none focus:border-indigo-600 cursor-pointer w-full md:w-auto font-bold"
             >
               <option value="Sole-Prop">Sole Proprietorship (Schedule C)</option>
               <option value="S-Corp">S-Corporation (1120-S Split)</option>
               <option value="C-Corp">C-Corporation (Form 1120 Flat)</option>
             </select>
           </div>
           
           {entityType === 'S-Corp' && (
             <>
               <div className="w-px h-12 bg-slate-200/50 hidden md:block" />
               <div className="space-y-2 min-w-[120px]">
                 <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                   <span className="opacity-40">W-2 Salary Split</span>
                   <span className="text-indigo-600">{sCorpSalaryPercent}%</span>
                 </div>
                 <input 
                   type="range"
                   min={20}
                   max={90}
                   step={5}
                   value={sCorpSalaryPercent}
                   onChange={(e) => setSCorpSalaryPercent(Number(e.target.value))}
                   className="w-full accent-ledger-accent h-1 bg-zinc-200 rounded-lg cursor-pointer"
                 />
                 <p className="text-[8px] font-bold text-zinc-400 italic">IRS Guardrails: 50% - 60%</p>
               </div>
             </>
           )}

           <div className="w-px h-12 bg-slate-200/50 hidden md:block" />
           
           <div className="space-y-2">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-40">Tax Law Year</span>
             <select
               value={taxYear}
               onChange={(e) => setTaxYear(Number(e.target.value))}
               className="bg-white border border-slate-200 rounded-xl px-4 py-1.5 text-xs font-black text-slate-900 outline-none focus:border-indigo-600 cursor-pointer font-bold"
             >
               <option value={2024}>2024 IRS Law</option>
               <option value={2025}>2025 IRS Law</option>
               <option value={2026}>2026 Proj. Law</option>
               <option value={2027}>2027 Proj. Law</option>
               <option value={2028}>2028 Proj. Law</option>
               <option value={2029}>2029 Proj. Law</option>
             </select>
           </div>
           
           {entityType === 'C-Corp' && (
             <>
               <div className="w-px h-12 bg-slate-200/50 hidden md:block" />
               <div className="space-y-2">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-40">Flat Corp Rate</span>
                 <div className="flex items-center gap-2">
                   <input 
                     type="number" 
                     value={taxRate} 
                     onChange={(e) => setTaxRate(Number(e.target.value))}
                     className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-black text-slate-900 outline-none focus:border-indigo-600 font-bold"
                   />
                   <span className="text-sm font-black text-slate-900">%</span>
                 </div>
               </div>
             </>
           )}

           <div className="w-px h-12 bg-slate-200/50 hidden md:block" />
           <div className="space-y-1">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-40 italic">Optimization Active</span>
             <p className="text-xs font-black text-emerald-500 uppercase tracking-tighter">
               {entityType === 'Sole-Prop' ? 'Progressive SE' : entityType === 'S-Corp' ? `S-Corp Split` : 'C-Corp Flat'}
             </p>
           </div>
         </div>
      </div>

      {/* Strategic Tab Navigation bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded-[32px] w-full md:w-fit font-bold shadow-inner">
        <button
          onClick={() => setActivePanel('matrix')}
          className={cn(
            "px-6 py-3 rounded-[32px] text-[10px] font-black uppercase tracking-[0.15em] transition-all cursor-pointer flex items-center gap-2",
            activePanel === 'matrix' ? "bg-slate-900 text-white shadow-md scale-[1.02]" : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
          )}
        >
          <Calculator size={14} />
          Filing Matrix & AI Profiler
        </button>
        <button
          onClick={() => setActivePanel('projections')}
          className={cn(
            "px-6 py-3 rounded-[32px] text-[10px] font-black uppercase tracking-[0.15em] transition-all cursor-pointer flex items-center gap-2",
            activePanel === 'projections' ? "bg-slate-900 text-white shadow-md scale-[1.02]" : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
          )}
        >
          <TrendingUp size={14} className="text-emerald-500" />
          5-Year Growth Projections
        </button>
        <button
          onClick={() => setActivePanel('filing_draft')}
          className={cn(
            "px-6 py-3 rounded-[32px] text-[10px] font-black uppercase tracking-[0.15em] transition-all cursor-pointer flex items-center gap-2",
            activePanel === 'filing_draft' ? "bg-slate-900 text-white shadow-md scale-[1.02]" : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
          )}
        >
          <FileText size={14} />
          IRS Filing Cheat Sheet & Draft
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activePanel === 'matrix' && (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-12"
          >
            {/* Dynamic AI Personal Tax Optimizer Block */}
            <div className="bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/45 border border-indigo-150/80 rounded-[32px] p-4 md:p-8 md:p-4 md:p-10 shadow-lg space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 md:p-8 text-indigo-500 opacity-5 pointer-events-none">
                <Brain size={160} />
              </div>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-indigo-100/50">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Sparkles className="animate-spin-slow text-indigo-500" size={16} />
                    <span className="text-[10px] font-medium uppercase tracking-wider truncate font-mono">Adaptive Algorithm Sandbox</span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 tracking-tight italic uppercase mt-1">AI Personal status & locale planner</h3>
                  <p className="text-sm text-slate-500 font-medium italic mt-1">
                    Kids, dependents and local tax rates completely transform your true tax responsibility. Say it or fill it out dynamically.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Sync State:</span>
                  <div className={cn(
                    "px-4 py-2 rounded-[32px] text-[10px] font-medium uppercase tracking-wider flex items-center gap-2 border transition-all",
                    personalProfile.isConfirmed 
                      ? "bg-emerald-500/10 border-emerald-200 text-emerald-700 shadow-sm"
                      : "bg-amber-500/10 border-amber-200 text-amber-700"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full", personalProfile.isConfirmed ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                    {personalProfile.isConfirmed ? 'Active on Ledger' : 'Staged (Needs Confirmation)'}
                  </div>
                </div>
              </div>

              {/* Taxpayer Persona Selector Chips */}
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block font-mono">Select a Taxpayer Profile Persona:</span>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {TAXPAYER_PERSONAS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyTaxPersona(p)}
                      className="text-left p-5 bg-white border border-slate-150 rounded-[32px] hover:border-indigo-500 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{p.name}</span>
                          <Sparkles size={12} className="text-slate-300 group-hover:text-indigo-500 group-hover:rotate-12 transition-all" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-extrabold">{p.description}</p>
                      </div>
                      <span className="text-[10px] text-indigo-500 font-bold block mt-3 underline group-hover:font-black transition-all">Load parameters →</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left panel: Speak / Input */}
                <div className="lg:col-span-12 xl:col-span-12 bg-white/70 backdrop-blur border border-slate-100 rounded-[32px] p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[32px] bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                      <Brain size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Financial Status Extract</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Natural Language Auto-learning</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Describe family setup and residency prompt:</label>
                    <div className="relative">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="e.g. I run an S-Corp, file married jointly with 2 qualifying children, and live in California..."
                        className="w-full h-24 bg-slate-50 border border-slate-200 rounded-[32px] p-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAIParse(chatInput)}
                        disabled={isAnalyzing || !chatInput.trim()}
                        className="absolute bottom-3 right-3 px-4 py-2 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {isAnalyzing ? (
                          <>
                            Analyzing...
                            <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </>
                        ) : (
                          <>
                            Auto-Learn <Sparkles size={12} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {personalProfile.explanation && (
                    <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-[32px] text-[11px] font-medium italic text-indigo-950/70 leading-relaxed flex gap-3">
                      <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium uppercase tracking-wider text-[9px] text-indigo-600 block mb-1">Strategist Inference Context</span>
                        "{personalProfile.explanation}"
                      </div>
                    </div>
                  )}
                </div>

                {/* Right panel: Live Preview Form */}
                <div className="lg:col-span-12 xl:col-span-12 bg-white border border-slate-200 rounded-[32px] p-6 space-y-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Form Parameter Sync</h4>
                      <span className="text-[9px] font-black uppercase text-indigo-500 font-mono">Real-Time Picks</span>
                    </div>
                    
                    <div className="space-y-4 mt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">Filing Status</label>
                          <select
                            value={personalProfile.filingStatus}
                            onChange={(e) => setPersonalProfile(prev => ({ 
                              ...prev, 
                              filingStatus: e.target.value as any,
                              isConfirmed: false 
                            }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black text-slate-800 cursor-pointer outline-none focus:border-indigo-500"
                          >
                            <option value="Single">Single</option>
                            <option value="Married Filing Jointly">Married Filing Jointly</option>
                            <option value="Married Filing Separately">Married Separately</option>
                            <option value="Head of Household">Head of Household</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">Jurisdiction State</label>
                          <select
                            value={personalProfile.state}
                            onChange={(e) => setPersonalProfile(prev => ({ 
                              ...prev, 
                              state: e.target.value,
                              isConfirmed: false 
                            }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black text-slate-800 cursor-pointer outline-none focus:border-indigo-500"
                          >
                            <option value="NY">NY - New York</option>
                            <option value="CA">CA - California</option>
                            <option value="TX">TX - Texas</option>
                            <option value="FL">FL - Florida</option>
                            <option value="IL">IL - Illinois</option>
                            <option value="OH">OH - Ohio</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">Dependents / Kids</label>
                          <div className="flex items-center justify-between border border-slate-200 rounded-xl p-2 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => setPersonalProfile(p => ({
                                ...p,
                                dependentsCount: Math.max(0, p.dependentsCount - 1),
                                isConfirmed: false
                              }))}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-black font-sans text-xs hover:bg-slate-100 cursor-pointer"
                            >
                              -
                            </button>
                            <div className="flex items-center gap-1 font-black text-slate-800 text-xs font-mono">
                              <Baby size={13} className="text-indigo-500" />
                              {personalProfile.dependentsCount}
                            </div>
                            <button
                              type="button"
                              onClick={() => setPersonalProfile(p => ({
                                ...p,
                                dependentsCount: p.dependentsCount + 1,
                                isConfirmed: false
                              }))}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-black font-sans text-xs hover:bg-slate-100 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">Standard Deduction (Est)</label>
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black text-slate-700 font-mono text-center">
                            {personalProfile.filingStatus === 'Married Filing Jointly' ? '$30,900' : (personalProfile.filingStatus === 'Head of Household' ? '$23,150' : '$15,450')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPersonalProfile(prev => ({ ...prev, isConfirmed: true }));
                    }}
                    className={cn(
                      "w-full py-4 rounded-[32px] text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer mt-6",
                      personalProfile.isConfirmed
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg"
                    )}
                  >
                    {personalProfile.isConfirmed ? (
                      <>
                        Confirmed & Calibrated <Check size={14} />
                      </>
                    ) : (
                      <>
                        Confirm Profiling Parameters <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* General metrics row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate block mb-6 opacity-40">Estimated Obligation</span>
                 <p className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter tabular-nums">{formatCurrency(taxMetrics.estimatedTax)}</p>
                 <div className="mt-8 flex items-center gap-2 text-rose-500">
                   <AlertTriangle size={14} />
                   <span className="text-[10px] font-medium uppercase tracking-wider leading-none">Fiscal Year {taxYear} est.</span>
                 </div>
              </div>
              <div className="p-4 md:p-10 bg-zinc-950 text-white rounded-[32px] shadow-2xl relative overflow-hidden">
                 <div className="absolute technical-grid inset-0 opacity-[0.05]" />
                 <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate block mb-6">Optimization Potential</span>
                 <p className="text-2xl md:text-4xl font-black text-emerald-400 tracking-tighter tabular-nums">{formatCurrency(taxMetrics.potentialSavings)}</p>
                 <div className="mt-8 flex items-center gap-2 text-emerald-500">
                   <Zap size={14} className="animate-pulse" />
                   <span className="text-[10px] font-medium uppercase tracking-wider leading-none">Available Adjustments</span>
                 </div>
              </div>
              <div className="lg:col-span-2 p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm flex items-center justify-between">
                 <div className="space-y-4 col-span-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate block opacity-40">Effective Tax Exposure</span>
                    <p className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">Rate: {taxMetrics.calculatedEffectiveRate.toFixed(1)}%</p>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl w-fit">
                       <ShieldCheck size={14} className="text-indigo-500" />
                       <span className="text-[9px] font-medium uppercase tracking-wider">Calculated Real Law</span>
                    </div>
                 </div>
                 <div className="w-32 h-32 hidden sm:block">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie 
                            data={[{ value: taxMetrics.calculatedEffectiveRate }, { value: Math.max(0.1, 100 - taxMetrics.calculatedEffectiveRate) }]} 
                            innerRadius={30} 
                            outerRadius={45} 
                            paddingAngle={5} 
                            dataKey="value"
                          >
                             <Cell fill="#6366F1" />
                             <Cell fill="#F2F4F7" />
                          </Pie>
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </div>

            {/* Sub graph and advice blocks */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
                 <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Deduction Distribution</h3>
                    <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-[0_0_10px_rgba(249,115,22,0.3)]" />
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-40">Categorical Decomposition</span>
                    </div>
                 </div>
                 <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={taxMetrics.dedData.slice(0, 8)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F2F4F7" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 900, fill: '#667085' }}
                            width={120}
                          />
                          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                          <Bar dataKey="value" fill="#F97316" radius={[0, 10, 10, 0]} barSize={8} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                 <div className="p-4 md:p-10 bg-slate-50/50 border border-slate-200 rounded-[32px] space-y-10">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate px-2 block mb-6 opacity-40">Advisor Insights</h4>
                    <div className="space-y-6">
                       {[
                         { icon: Lightbulb, text: "Allocating 2% more to R&D cluster could trigger innovation credit overflow.", color: "text-indigo-600" },
                         { icon: TrendingDown, text: "Depreciation scheduling on computer assets is suboptimal. Consider switch to double-declining.", color: "text-indigo-500" },
                         { icon: Target, text: "S-Corp entity calibration completed. Qualified Business Income yields substantial tax savings.", color: "text-emerald-500" }
                       ].map((tip, i) => (
                         <div key={i} className="flex gap-4 group cursor-pointer">
                            <div className={cn("w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform", tip.color)}>
                               <tip.icon size={18} />
                            </div>
                            <p className="text-xs font-bold text-slate-500 leading-relaxed italic group-hover:text-slate-900 transition-colors">
                              "{tip.text}"
                            </p>
                         </div>
                       ))}
                    </div>
                    <button 
                      onClick={() => setActivePanel('filing_draft')}
                      className="w-full py-4 bg-slate-900 text-white hover:bg-slate-900 rounded-[32px] text-[10px] font-medium uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                    >
                       View Filing Cheat Sheet <FileText size={14} />
                    </button>
                 </div>
              </div>
            </div>

            {/* Interactive breakdown audit ledger */}
            {personalProfile.isConfirmed && (
              <div 
                className="p-4 md:p-8 md:p-4 md:p-10 bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl relative overflow-hidden space-y-6 text-white"
              >
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[32px] bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <Brain size={20} />
                    </div>
                    <div>
                      <h4 className="text-md font-black uppercase tracking-tight italic">Family & Local Reconciliation Audit Ledger</h4>
                      <p className="text-[10px] text-emerald-400 uppercase font-mono font-black tracking-widest leading-none mt-1">Active Coefficient Adjustments (Kids & Jurisdiction)</p>
                    </div>
                  </div>
                  <div className="text-[9px] font-black font-mono text-slate-500 uppercase tracking-widest italic opacity-60">
                    Proxima Adaptive Algorithm Phase_V
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-slate-850/50 rounded-[32px] space-y-2 border border-slate-800">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500 font-mono">Filing Status Calibration</span>
                    <p className="text-lg font-black text-slate-100 tracking-tight italic uppercase">{personalProfile.filingStatus}</p>
                    <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                      Applying standard deduction of <span className="text-emerald-400 font-mono font-bold">{formatCurrency(taxMetrics.standardDeductionCents)}</span>. This reduces taxable net profit before federal tax calculation.
                    </p>
                  </div>

                  <div className="p-6 bg-slate-850/50 rounded-[32px] space-y-2 border border-slate-800">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500 font-mono">Dependent Direct Savings</span>
                    <p className="text-lg font-black text-slate-100 tracking-tight italic uppercase">{personalProfile.dependentsCount} Qualifying Kids</p>
                    <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                      Federal dependent credit direct subtraction applies: <span className="text-emerald-400 font-mono font-bold">-{formatCurrency(taxMetrics.ctcSubtracted)}</span> ($2,000 per dependent directly offsets federal tax).
                    </p>
                  </div>

                  <div className="p-6 bg-slate-850/50 rounded-[32px] space-y-2 border border-slate-800">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500 font-mono">State & Local Surcharges</span>
                    <p className="text-lg font-black text-slate-100 tracking-tight italic uppercase">{personalProfile.state} Resident S.I.T.</p>
                    <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                      State Income Tax: <span className="text-indigo-400 font-mono font-bold">+{formatCurrency(taxMetrics.stateTax)}</span>. City and county surcharges aggregate to: <span className="text-indigo-400 font-mono font-bold">+{formatCurrency(taxMetrics.localTax)}</span>.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto text-[11px] font-medium font-sans mt-4">
                  <table className="w-full text-left font-sans">
                    <thead>
                      <tr className="border-b border-slate-850 text-[9px] font-black text-slate-505 uppercase tracking-widest">
                        <th className="py-2 pr-4 font-mono text-zinc-400">Reconciliation Phase Code</th>
                        <th className="py-2 px-4 text-emerald-400 font-mono">Operations</th>
                        <th className="py-2 pl-4 text-right font-mono text-zinc-400">Core Balance (Cumulative)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 font-black text-slate-300 uppercase italic">Schedule C Gross Profit</td>
                        <td className="py-3 px-4 text-slate-400 font-mono">+{formatCurrency(taxMetrics.revenue)}</td>
                        <td className="py-3 pl-4 text-right text-slate-300 font-mono">{formatCurrency(taxMetrics.revenue)}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 font-black text-slate-300 uppercase italic">Deductible Operating Expenses (§ 162)</td>
                        <td className="py-3 px-4 text-rose-450 font-mono">-{formatCurrency(taxMetrics.totalDeductibleCents)}</td>
                        <td className="py-3 pl-4 text-right text-slate-300 font-mono">{formatCurrency(taxMetrics.revenue - taxMetrics.totalDeductibleCents)}</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 font-black text-slate-300 uppercase italic">Standard Status Deduction ({personalProfile.filingStatus})</td>
                        <td className="py-3 px-4 text-emerald-400 font-mono font-bold">-{formatCurrency(taxMetrics.standardDeductionCents)}</td>
                        <td className="py-3 pl-4 text-right text-slate-300 font-mono">
                          {formatCurrency(Math.max(0, taxMetrics.revenue - taxMetrics.totalDeductibleCents - taxMetrics.standardDeductionCents))}
                        </td>
                      </tr>
                      {(entityType === 'Sole-Prop' || entityType === 'S-Corp') && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 pr-4 font-black text-slate-300 uppercase italic">Qualified Business Income (QBI) Deductions</td>
                          <td className="py-3 px-4 text-emerald-400 font-mono font-bold">Deconsolidated / 20% limit</td>
                          <td className="py-3 pl-4 text-right text-slate-300 font-mono">
                            {formatCurrency(Math.max(0, taxMetrics.taxableIncome))}
                          </td>
                        </tr>
                      )}
                      {entityType === 'Sole-Prop' && taxMetrics.selfEmploymentTaxCents > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 pr-4 font-black text-slate-300 uppercase italic">Self-Employment Tax (Schedule SE 15.3% overall)</td>
                          <td className="py-3 px-4 text-rose-400 font-mono font-bold">+{formatCurrency(taxMetrics.selfEmploymentTaxCents)}</td>
                          <td className="py-3 pl-4 text-right text-slate-300 font-mono">
                            {formatCurrency(taxMetrics.selfEmploymentTaxCents)}
                          </td>
                        </tr>
                      )}
                      {entityType === 'S-Corp' && taxMetrics.payrollTaxCents > 0 && (
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="py-3 pr-4 font-black text-slate-300 uppercase italic">Combined FICA Payroll Tax withholding (Salary)</td>
                          <td className="py-3 px-4 text-rose-400 font-mono font-bold">+{formatCurrency(taxMetrics.payrollTaxCents)}</td>
                          <td className="py-3 pl-4 text-right text-slate-300 font-mono">
                            {formatCurrency(taxMetrics.payrollTaxCents)}
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 font-black text-slate-300 uppercase italic">Progressive Federal Withholding Owed</td>
                        <td className="py-3 px-4 text-rose-400 font-mono">+{formatCurrency(taxMetrics.progressiveFedTax)}</td>
                        <td className="py-3 pl-4 text-right text-slate-300 font-mono">
                          {formatCurrency(taxMetrics.progressiveFedTax)}
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 font-black text-slate-300 uppercase italic">Dependent Child Credit (CTC Offset)</td>
                        <td className="py-3 px-4 text-emerald-400 font-mono font-black font-extrabold text-[11px]">-{formatCurrency(taxMetrics.ctcSubtracted)}</td>
                        <td className="py-3 pl-4 text-right text-slate-300 font-mono">
                          {formatCurrency(Math.max(0, taxMetrics.progressiveFedTax - taxMetrics.ctcSubtracted))}
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 font-black text-slate-300 uppercase italic">Regional State Income Tax (S.I.T. Resident Rate)</td>
                        <td className="py-3 px-4 text-rose-450 font-mono">+{formatCurrency(taxMetrics.stateTax)}</td>
                        <td className="py-3 pl-4 text-right text-slate-300 font-mono">
                          {formatCurrency(Math.max(0, taxMetrics.progressiveFedTax - taxMetrics.ctcSubtracted) + taxMetrics.stateTax)}
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 font-black text-emerald-400 uppercase italic text-[11px]">Final Personalized Combined Tax Obligation</td>
                        <td className="py-3 px-4 text-rose-450 font-mono font-bold">+{formatCurrency(taxMetrics.localTax)} (Local Surcharges)</td>
                        <td className="py-3 pl-4 text-right text-emerald-400 font-mono font-black text-sm">
                          {formatCurrency(taxMetrics.estimatedTax)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Schedule C matrix list */}
            <div className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm space-y-8">
              <div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate block mb-2">IRS Schedule C Matrix</span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic font-sans animate-fade-in">Schedule C Deductibility Analyzer</h3>
                <p className="text-sm text-slate-500 mt-1 font-medium italic opacity-70">
                  IRC § 162 rules dictate how business investments map onto physical tax deduction allowances. Below is the real-time truth of your deductible transacted volume.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <th className="py-4 pr-4 border-b border-slate-200">Schedule C Category</th>
                      <th className="py-4 px-4 text-right border-b border-slate-200">Total Transacted</th>
                      <th className="py-4 px-4 text-center border-b border-slate-200">IRS Allowance</th>
                      <th className="py-4 px-4 text-right text-emerald-600 border-b border-slate-200">Deductible Portion</th>
                      <th className="py-4 pl-4 text-right text-rose-500 border-b border-slate-200">Non-Deductible Spill</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ledger-line font-medium text-sm">
                    {taxMetrics.scheduleCTable.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 pr-4">
                          <span className="font-black text-slate-900 uppercase italic tracking-tight">{row.categoryName}</span>
                          {row.potentialMishapWarning && (
                            <span className="block text-[9px] text-rose-500 font-bold uppercase tracking-wider mt-1 animate-pulse">
                              ⚠️ Audit Alert: {row.potentialMishapWarning}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-slate-900">
                          {formatCurrency(row.rawAmountCents)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 font-mono">
                            {(row.rate * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-emerald-600 font-bold">
                          {formatCurrency(row.deductibleAmountCents)}
                        </td>
                        <td className="py-4 pl-4 text-right font-mono text-rose-500 font-bold">
                          {formatCurrency(row.nonDeductibleAmountCents)}
                        </td>
                      </tr>
                    ))}
                    {taxMetrics.scheduleCTable.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500 italic">
                          No business expenses loaded in this period. Enter a check or credit settlement to trigger the dynamic Schedule C engine.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Dynamic Optimization Advice Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200 bg-zinc-50/50 p-6 rounded-[32px]">
                <div className="p-6 bg-emerald-500/[0.03] border border-emerald-500/20 rounded-[32px] space-y-3">
                  <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Schedule C Max Deductibility Rules</h5>
                  <p className="text-xs text-emerald-800 leading-relaxed font-semibold">
                    Currently driving <span className="font-black text-emerald-950 font-mono">{(taxMetrics.totalDeductibleCents / (taxMetrics.expenses || 1) * 100).toFixed(1)}%</span> overall deductibility. Ensure all dinners involve written receipts naming specific prospective partners to certify compliance under IRS Audit Red Flags.
                  </p>
                </div>
                <div className="p-6 bg-indigo-500/[0.03] border border-indigo-500/20 rounded-[32px] space-y-3">
                  <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">Strategic Tax Reclassification</h5>
                  <p className="text-xs text-indigo-800 leading-relaxed font-semibold">
                    Moving unclassified client tickets under structured collective team training of staff shifts rates from <span className="font-black text-stone-900 font-mono">0% to 100% deductibility</span> instantly under modern tax code directives.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activePanel === 'projections' && (
          <motion.div
            key="projections"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-12"
          >
            {/* Headline and info block */}
            <div className="p-4 md:p-8 md:p-4 md:p-10 bg-slate-900 text-white rounded-[32px] border border-slate-800 relative overflow-hidden">
               <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-indigo-500/10 to-transparent pointer-events-none" />
               <div className="flex items-center gap-2 text-indigo-400 font-mono text-[9px] uppercase tracking-widest font-black mb-3">
                 <Coins size={12} className="animate-pulse" />
                 Simulation & Forecasting Suite
               </div>
               <h3 className="text-3xl font-black tracking-tight italic uppercase">5-Year Growth & Liability Projection Matrix</h3>
               <p className="text-sm text-slate-400 mt-2 font-medium max-w-3xl leading-relaxed">
                 Model tax scenarios dynamically from 2026 through 2030. Test changes in annual gross growth, itemized operating expenses, and compounding inflation adjustments instantly.
               </p>

               <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10 pt-8 border-t border-slate-800 text-slate-300">
                 <div className="space-y-1">
                   <span className="text-[9px] font-black uppercase text-slate-500">Cumulative 5y Gross Revenue</span>
                   <p className="text-2xl font-black text-slate-100 font-mono tracking-tight text-indigo-300">
                     {formatCurrencyValue(forecastYears.reduce((sum, item) => sum + item.revenue, 0))}
                   </p>
                 </div>
                 <div className="space-y-1">
                   <span className="text-[9px] font-black uppercase text-slate-500">Estimated Corporate or Personal expenses</span>
                   <p className="text-2xl font-black text-zinc-100 font-mono tracking-tight font-sans">
                     {formatCurrencyValue(forecastYears.reduce((sum, item) => sum + item.expenses, 0))}
                   </p>
                 </div>
                 <div className="space-y-1">
                   <span className="text-[9px] font-black uppercase text-slate-500">Estimated Total 5y Tax paid</span>
                   <p className="text-2xl font-black text-rose-400 font-mono tracking-tight">
                     {formatCurrencyValue(forecastYears.reduce((sum, item) => sum + item.taxLiability, 0))}
                   </p>
                 </div>
                 <div className="space-y-1">
                   <span className="text-[9px] font-black uppercase text-slate-500">Net take-home profit cash (Cumulative)</span>
                   <p className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                     {formatCurrencyValue(forecastYears.reduce((sum, item) => sum + item.afterTaxNet, 0))}
                   </p>
                 </div>
               </div>
            </div>

            {/* Split controls & chart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Sliders controls */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-[32px] p-4 md:p-8 space-y-8 flex flex-col justify-between">
                <div>
                   <h4 className="text-sm font-black uppercase text-slate-900 tracking-widest pb-4 border-b border-slate-200 flex items-center gap-2 mb-6">
                     <Coins size={14} className="text-indigo-500" />
                     Forecast parameters
                   </h4>
                   
                   <div className="space-y-6">
                     <div className="space-y-2">
                       <div className="flex justify-between items-center text-xs font-black uppercase text-slate-900">
                         <span>Revenue growth rate</span>
                         <span className="text-indigo-600 font-mono font-black">+{revenueGrowth}% / year</span>
                       </div>
                       <input 
                         type="range" 
                         min="-20" 
                         max="100" 
                         value={revenueGrowth} 
                         onChange={(e) => setRevenueGrowth(Number(e.target.value))}
                         className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg outline-none"
                         id="rev-growth-slider"
                       />
                       <p className="text-[10px] text-slate-500 leading-tight italic">Compound scaling multiplier on gross billing streams.</p>
                     </div>

                     <div className="space-y-2">
                       <div className="flex justify-between items-center text-xs font-black uppercase text-slate-900">
                         <span>Operating expense scaling</span>
                         <span className="text-slate-600 font-mono font-black">+{expenseGrowth}% / year</span>
                       </div>
                       <input 
                         type="range" 
                         min="-20" 
                         max="100" 
                         value={expenseGrowth} 
                         onChange={(e) => setExpenseGrowth(Number(e.target.value))}
                         className="w-full accent-slate-800 cursor-pointer h-1.5 bg-slate-100 rounded-lg outline-none"
                         id="exp-growth-slider"
                       />
                       <p className="text-[10px] text-slate-500 leading-tight italic">Compound scaling on operating, material & platform overheads.</p>
                     </div>

                     <div className="space-y-2">
                       <div className="flex justify-between items-center text-xs font-black uppercase text-slate-900">
                         <span>Estimated IRS inflation indexing</span>
                         <span className="text-emerald-600 font-mono font-black">+{inflationRate}% / year</span>
                       </div>
                       <input 
                         type="range" 
                         min="0" 
                         max="10" 
                         step="0.5"
                         value={inflationRate} 
                         onChange={(e) => setInflationRate(Number(e.target.value))}
                         className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg outline-none"
                         id="inflation-slider"
                       />
                       <p className="text-[10px] text-slate-500 leading-tight italic">Annual scaling applied to standard deduction limits and federal bracket boundaries.</p>
                     </div>
                   </div>
                </div>

                <div className="p-5 bg-slate-50 rounded-[32px] border border-slate-200 mt-6 italic text-[11px] text-slate-500 leading-relaxed">
                   <Sparkles size={14} className="text-indigo-500 shrink-0 inline mr-2 align-middle animate-spin-slow" />
                   Currently simulating under a <span className="font-bold text-slate-900 uppercase not-italic">{entityType} ({personalProfile.filingStatus})</span> profile setup. Changes in matrix parameters cascade instantly.
                </div>
              </div>

              {/* Chart of Area projected values */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[32px] p-4 md:p-8 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                   <h3 className="text-md font-black uppercase text-slate-900 tracking-tight italic">Cumulative Profit vs Tax Trajectory</h3>
                   <span className="text-[9px] font-black uppercase text-slate-400 font-mono leading-none">Standardized Line Matrix (USD)</span>
                 </div>
                 
                 <div className="h-[360px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={forecastYears.map(item => ({
                       year: String(item.year),
                       Revenue: Math.round(item.revenue / 100),
                       Expenses: Math.round(item.expenses / 100),
                       TaxLiability: Math.round(item.taxLiability / 100),
                       NetProfit: Math.round(item.afterTaxNet / 100)
                     }))}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E7EC" />
                        <XAxis dataKey="year" tick={{ fontSize: 10, fontWeight: 900, fill: '#667085' }} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 900, fill: '#667085' }} />
                        <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 900 }} />
                        <Area type="monotone" dataKey="Revenue" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                        <Area type="monotone" dataKey="NetProfit" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                        <Line type="monotone" dataKey="TaxLiability" stroke="#EF4444" strokeWidth={2} activeDot={{ r: 8 }} />
                     </AreaChart>
                   </ResponsiveContainer>
                 </div>
              </div>
            </div>

            {/* Comprehensive sheet details table */}
            <div className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm space-y-6">
              <div>
                <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest uppercase">Tabular projections worksheet</span>
                <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight italic mt-1 pb-4 border-b border-slate-100">Year-by-Year Projected Values Spreadsheet</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest leading-normal">
                      <th className="py-4 pr-3">Fiscal Year</th>
                      <th className="py-4 px-3 text-right">Projected Gross Sales</th>
                      <th className="py-4 px-3 text-right">Proj. Deductions (operating)</th>
                      <th className="py-4 px-3 text-right">Standard / QBI Allowance</th>
                      <th className="py-4 px-3 text-right">Taxable Federal Net</th>
                      <th className="py-4 px-3 text-right">Fed Progressive Tax</th>
                      <th className="py-4 px-3 text-right">State / Local Income tax</th>
                      <th className="py-4 px-3 text-right text-rose-500 font-bold">Estimated Combined Tax</th>
                      <th className="py-4 pl-3 text-right text-emerald-600 font-extrabold">After-Tax Net Profit Cash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ledger-line font-medium text-slate-700">
                    {forecastYears.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 pr-3 font-black text-slate-800 font-mono">{item.year}</td>
                        <td className="py-4 px-3 text-right font-mono tabular-nums text-slate-800">{formatCurrencyValue(item.revenue)}</td>
                        <td className="py-4 px-3 text-right font-mono tabular-nums text-slate-600">{formatCurrencyValue(item.deductibleExpenses)}</td>
                        <td className="py-4 px-3 text-right font-mono tabular-nums text-slate-500">
                          {formatCurrencyValue(item.standardDeduction + item.qbiDeduction)}
                        </td>
                        <td className="py-4 px-3 text-right font-mono tabular-nums text-slate-700">{formatCurrencyValue(item.taxableIncome)}</td>
                        <td className="py-4 px-3 text-right font-mono tabular-nums text-slate-600">
                          {formatCurrencyValue(item.fedTax)}
                          {item.ctcOffset > 0 && <span className="block text-[8px] text-emerald-500 font-extrabold font-sans">(-{formatCurrencyValue(item.ctcOffset)} child credit)</span>}
                        </td>
                        <td className="py-4 px-3 text-right font-mono tabular-nums text-slate-600">
                          {formatCurrencyValue(item.stateTax + item.localTax)}
                          <span className="block text-[8px] text-slate-400 font-sans">({personalProfile.state} Resident S.I.T.)</span>
                        </td>
                        <td className="py-4 px-3 text-right font-mono tabular-nums text-rose-600 font-bold">{formatCurrencyValue(item.taxLiability)}</td>
                        <td className="py-4 pl-3 text-right font-mono tabular-nums text-emerald-600 font-extrabold">{formatCurrencyValue(item.afterTaxNet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activePanel === 'filing_draft' && (
          <motion.div
            key="filing_draft"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-12"
          >
            {/* Split layout: Typewriter drafted form & actionable checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Typewriter drafted form output */}
              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between bg-white px-6 py-4 border border-slate-200 rounded-[32px] shadow-sm">
                  <div className="flex items-center gap-1.5 font-bold text-xs uppercase text-slate-800">
                    <FileText size={14} className="text-indigo-500" />
                    Format IRS Draft:
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      onClick={() => setActiveFilingForm('schedule_c')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        activeFilingForm === 'schedule_c' ? "bg-white text-slate-800 shadow-sm" : "text-slate-450 hover:text-slate-850"
                      )}
                    >
                      Form Schedule C
                    </button>
                    <button
                      onClick={() => setActiveFilingForm('form_1120')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        activeFilingForm === 'form_1120' ? "bg-white text-slate-800 shadow-sm" : "text-slate-450 hover:text-slate-850"
                      )}
                    >
                      Form 1120
                    </button>
                  </div>
                </div>

                <div className="relative bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-[32px] p-6 sm:p-4 md:p-10 shadow-inner overflow-hidden">
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                      onClick={handleCopyToClipboard}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-sm rounded-xl text-[10px] font-medium uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedNotification ? (
                        <>
                          Copied <Check size={12} className="text-emerald-500" />
                        </>
                      ) : (
                        <>
                          Copy Text <Copy size={12} />
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto text-xs font-mono text-zinc-800 leading-relaxed font-semibold block whitespace-pre select-all bg-white border border-zinc-150 p-6 sm:p-4 md:p-8 rounded-[32px] max-h-[600px] overflow-y-auto shadow-sm">
                    {currentFilingDraftText}
                  </div>
                  
                  <div className="mt-4 text-center text-[10px] text-zinc-400 font-extrabold uppercase font-mono tracking-wider italic">
                     ⚠️ PROXIMA WORKFLOW LEDGER SIMULATED SHEET. DRAFT ONLY - DO NOT SUBMIT PRE-CALCIED PRINT TO IRS.
                  </div>
                </div>
              </div>

              {/* Actionable checklists and details */}
              <div className="lg:col-span-4 space-y-8">
                 <div className="p-4 md:p-8 bg-white border border-slate-200 rounded-[32px] space-y-8 shadow-sm">
                    <span className="text-[9px] font-black uppercase text-indigo-500 font-mono tracking-widest block">AI compliance advisor</span>
                    <h3 className="text-lg font-black uppercase text-slate-800 tracking-tight italic pb-3 border-b border-slate-100">Action items for tax season</h3>
                    
                    <div className="space-y-5">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-[32px] space-y-2">
                        <span className="text-[9px] font-black text-rose-500 block uppercase tracking-widest font-mono">1. S-Corp Reasonable Wage</span>
                        <p className="text-xs text-slate-600 font-bold leading-normal">
                          If filing under S-Corp, IRS requires officers to receive "Reasonable Wages". Use the Payroll engine to schedule monthly checks representing at least 50% of operating profits.
                        </p>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-150 rounded-[32px] space-y-2">
                        <span className="text-[9px] font-black text-orange-500 block uppercase tracking-widest font-mono">2. Form 1045 - ES Estimates</span>
                        <p className="text-xs text-slate-600 font-bold leading-normal">
                          US Federal law mandates pay-as-you-go. Avoid underpayment penalties by establishing Quarterly Estimated Taxes based on the staged average liability of {formatCurrency(Math.round(taxMetrics.estimatedTax / 4))}.
                        </p>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-150 rounded-[32px] space-y-2">
                        <span className="text-[9px] font-black text-indigo-500 block uppercase tracking-widest font-mono">3. Qualified QBI validation</span>
                        <p className="text-xs text-slate-600 font-bold leading-normal">
                          Section 199A passthrough deduction saves substantial taxes but can be capped for high-income engineering consulting. Review the complete Schedule K-1 allocation.
                        </p>
                      </div>
                    </div>
                 </div>

                 {/* Download or printable compliance packet */}
                 <div className="p-4 md:p-8 bg-zinc-950 text-white rounded-[32px] space-y-6 shadow-xl relative overflow-hidden">
                    <div className="absolute technical-grid inset-0 opacity-[0.02]" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Ready for accountant</span>
                    <h4 className="text-xl font-black italic uppercase text-indigo-400">Export Ledger Bundle</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                       Combine transaction category allocations, Schedule C matrices, 5-year growth tables, and audit logs into a single package.
                    </p>
                    <button 
                      onClick={() => alert("Simulated Download: Form Schedule C allocations exported to ExcelCSV ledger formats successfully!")}
                      className="w-full py-4 bg-white text-slate-800 border border-slate-200 text-[10px] font-medium uppercase tracking-wider hover:bg-slate-100 rounded-[32px] flex items-center justify-center gap-2 cursor-pointer transition-all hover:translate-y-[-1px]"
                    >
                      Export CSV Compliance Packet <FileSpreadsheet size={14} />
                    </button>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
