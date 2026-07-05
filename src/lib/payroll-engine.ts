import { Employee, TemporalValidity } from '../types';
import { TemporalTruth } from '../modules/truth/TruthEngine';

export interface PayPeriodBreakdown {
  grossPayCents: number;
  employeeFicaSocialSecurityCents: number;
  employeeFicaMedicareCents: number;
  employeeFederalTaxCents: number;
  employeeStateTaxCents: number;
  employeeCityTaxCents: number;
  employeeCountyTaxCents: number;
  netPayCents: number;
  employerFicaSocialSecurityCents: number;
  employerFicaMedicareCents: number;
  employerFutaCents: number;
  employerSutaCents: number;
  totalWithholdingCents: number;
  totalEmployerTaxCents: number;
  totalPeriodLiabilityCents: number;
}

export function getPeriodsPerYear(frequency: Employee['payFrequency']): number {
  switch (frequency) {
    case 'Weekly': return 52;
    case 'Bi-Weekly': return 26;
    case 'Monthly': return 12;
    default: return 12;
  }
}

/**
 * High-precision progressive tax tier withholding engine for multiple fiscal years.
 * Accounts for real-world IRS Single Filer brackets and year-end adjustments.
 */

export interface TaxBracket {
  limitCents: number;
  rate: number;
}

export interface TaxYearConfig {
  standardDeductionCents: number;
  brackets: TaxBracket[];
}

export const FEDERAL_TAX_YEARS: Record<number, TaxYearConfig> = {
  2024: {
    standardDeductionCents: 1460000,
    brackets: [
      { limitCents: 1160000, rate: 0.10 },
      { limitCents: 4715000, rate: 0.12 },
      { limitCents: 10052500, rate: 0.22 },
      { limitCents: 19195000, rate: 0.24 },
      { limitCents: 24372500, rate: 0.32 },
      { limitCents: 60935000, rate: 0.35 },
      { limitCents: Infinity, rate: 0.37 },
    ]
  },
  2025: {
    standardDeductionCents: 1500000,
    brackets: [
      { limitCents: 1192500, rate: 0.10 },
      { limitCents: 4847500, rate: 0.12 },
      { limitCents: 10335000, rate: 0.22 },
      { limitCents: 19730000, rate: 0.24 },
      { limitCents: 25052500, rate: 0.32 },
      { limitCents: 62635000, rate: 0.35 },
      { limitCents: Infinity, rate: 0.37 },
    ]
  },
  2026: {
    standardDeductionCents: 1545000,
    brackets: [
      { limitCents: 1227500, rate: 0.10 },
      { limitCents: 4992500, rate: 0.12 },
      { limitCents: 10645000, rate: 0.22 },
      { limitCents: 20322500, rate: 0.24 },
      { limitCents: 25805000, rate: 0.32 },
      { limitCents: 64515000, rate: 0.35 },
      { limitCents: Infinity, rate: 0.37 },
    ]
  }
};

/**
 * Returns tax laws for the specified fiscal year.
 * If the requested year is not in our federal table, it automatically
 * calculates inflation adjustments (3% margin compounded, $500 std deduction steps).
 */
export function getFederalTaxYearConfig(year: number): TaxYearConfig {
  if (FEDERAL_TAX_YEARS[year]) {
    return FEDERAL_TAX_YEARS[year];
  }
  const baseYear = 2026;
  const delta = year - baseYear;
  const config2026 = FEDERAL_TAX_YEARS[baseYear];

  // Standard deduction adjusts average $500 per year (50000 cents)
  const standardDeductionCents = Math.max(1200000, config2026.standardDeductionCents + delta * 50000);

  // Compounds 3% inflation on upper limit ranges
  const scale = Math.pow(1.03, delta);
  const brackets = config2026.brackets.map(b => ({
    limitCents: b.limitCents === Infinity ? Infinity : Math.round(b.limitCents * scale),
    rate: b.rate
  }));

  return {
    standardDeductionCents,
    brackets
  };
}

export interface TemporalRegionalTaxRates {
  stateCode: string;
  stateName: string;
  stateRateSeries: TemporalValidity[];
  cityCode?: string;
  cityName?: string;
  cityRateSeries?: TemporalValidity[];
  countyCode?: string;
  countyName?: string;
  countyRateSeries?: TemporalValidity[];
}

export interface RegionalTaxRates {
  stateCode: string;
  stateName: string;
  stateRate: number; 
  cityCode?: string;
  cityName?: string;
  cityRate?: number; 
  countyCode?: string;
  countyName?: string;
  countyRate?: number; 
}

export const REGIONAL_TAX_LOOKUPS: Record<string, TemporalRegionalTaxRates> = {
  'NY': { stateCode: 'NY', stateName: 'New York', stateRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.065 }], cityCode: 'NYC', cityName: 'New York City', cityRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.03876 }], countyCode: 'KC', countyName: 'Kings County', countyRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.01 }] },
  'CA': { stateCode: 'CA', stateName: 'California', stateRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.080 }], cityCode: 'SF', cityName: 'San Francisco', cityRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.015 }], countyCode: 'SFC', countyName: 'SF County', countyRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.005 }] },
  'TX': { stateCode: 'TX', stateName: 'Texas', stateRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.00 }] },
  'FL': { stateCode: 'FL', stateName: 'Florida', stateRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.00 }] },
  'IL': { stateCode: 'IL', stateName: 'Illinois', stateRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.0495 }] },
  'OH': { stateCode: 'OH', stateName: 'Ohio', stateRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.035 }], cityCode: 'CLE', cityName: 'Cleveland', cityRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.02 }], countyCode: 'CC', countyName: 'Cuyahoga County', countyRateSeries: [{ validFrom: '0000-01-01', validTo: '9999-12-31', value: 0.0075 }] },
};

export function getRegionalTaxConfig(stateCode: string = 'NY', targetDateStr: string = new Date().toISOString().split('T')[0]): RegionalTaxRates {
  const code = (stateCode || 'NY').toUpperCase();
  const config = REGIONAL_TAX_LOOKUPS[code];
  
  if (!config) {
    return {
      stateCode: code,
      stateName: 'Default State',
      stateRate: 0.045, 
      cityCode: 'GEN_CITY',
      cityName: 'Local City',
      cityRate: 0.01,  
      countyCode: 'GEN_COUNTY',
      countyName: 'Local County',
      countyRate: 0.005  
    };
  }

  return {
    stateCode: config.stateCode,
    stateName: config.stateName,
    stateRate: TemporalTruth.resolveEffectiveValue(config.stateRateSeries, targetDateStr),
    cityCode: config.cityCode,
    cityName: config.cityName,
    cityRate: config.cityRateSeries ? TemporalTruth.resolveEffectiveValue(config.cityRateSeries, targetDateStr) : undefined,
    countyCode: config.countyCode,
    countyName: config.countyName,
    countyRate: config.countyRateSeries ? TemporalTruth.resolveEffectiveValue(config.countyRateSeries, targetDateStr) : undefined
  };
}

export function computeFederalIncomeTaxWithholding(annualSalaryCents: number, payPeriods: number, year: number = 2026): number {
  const config = getFederalTaxYearConfig(year);
  const taxableAnnualSalaryCents = Math.max(0, annualSalaryCents - config.standardDeductionCents);
  
  let remainingCents = taxableAnnualSalaryCents;
  let previousLimitCents = 0;
  let annualTaxCents = 0;

  for (const bracket of config.brackets) {
    const widthCents = bracket.limitCents - previousLimitCents;
    const taxableInThisBracketCents = Math.min(remainingCents, widthCents);
    
    if (taxableInThisBracketCents <= 0) break;
    
    annualTaxCents += taxableInThisBracketCents * bracket.rate;
    remainingCents -= taxableInThisBracketCents;
    previousLimitCents = bracket.limitCents;
  }

  return Math.round(annualTaxCents / payPeriods);
}

export function computePeriodPayroll(employee: Employee, year: number = 2026): PayPeriodBreakdown {
  const payPeriods = getPeriodsPerYear(employee.payFrequency);
  const grossPayCents = Math.round(employee.salaryCents / payPeriods);

  // FICA Employee: SS 6.2%, Medicare 1.45%
  const employeeFicaSocialSecurityCents = Math.round(grossPayCents * 0.062);
  const employeeFicaMedicareCents = Math.round(grossPayCents * 0.0145);

  // FICA Employer matching: SS 6.2%, Medicare 1.45%
  const employerFicaSocialSecurityCents = Math.round(grossPayCents * 0.062);
  const employerFicaMedicareCents = Math.round(grossPayCents * 0.0145);

  // Federal Income Tax (FIT) withholding using selected tax year
  const employeeFederalTaxCents = computeFederalIncomeTaxWithholding(employee.salaryCents, payPeriods, year);

  // Regional Tax Rates calculation (State, City, County) from employee metadata or fallback
  const userLocState = (employee as any).state || 'NY';
  const regionalConfig = getRegionalTaxConfig(userLocState);

  // State Income Tax mapping
  const employeeStateTaxCents = Math.round(grossPayCents * regionalConfig.stateRate);

  // Local City Tax mapping
  const employeeCityTaxCents = Math.round(grossPayCents * (regionalConfig.cityRate || 0));

  // County margin surcharge mapping
  const employeeCountyTaxCents = Math.round(grossPayCents * (regionalConfig.countyRate || 0));

  // FUTA: 0.6% (mocked as accrued per period)
  const employerFutaCents = Math.round(grossPayCents * 0.006);
  // SUTA: 2.7% (mocked as accrued per period)
  const employerSutaCents = Math.round(grossPayCents * 0.027);

  const totalWithholdingCents = 
    employeeFicaSocialSecurityCents + 
    employeeFicaMedicareCents + 
    employeeFederalTaxCents + 
    employeeStateTaxCents +
    employeeCityTaxCents +
    employeeCountyTaxCents;

  const netPayCents = grossPayCents - totalWithholdingCents;

  const totalEmployerTaxCents = 
    employerFicaSocialSecurityCents + 
    employerFicaMedicareCents + 
    employerFutaCents + 
    employerSutaCents;

  // The economic liability is the sum of Gross wages + Employer taxes, which represents the total cash outflow expected from the enterprise.
  const totalPeriodLiabilityCents = grossPayCents + totalEmployerTaxCents;

  return {
    grossPayCents,
    employeeFicaSocialSecurityCents,
    employeeFicaMedicareCents,
    employeeFederalTaxCents,
    employeeStateTaxCents,
    employeeCityTaxCents,
    employeeCountyTaxCents,
    netPayCents,
    employerFicaSocialSecurityCents,
    employerFicaMedicareCents,
    employerFutaCents,
    employerSutaCents,
    totalWithholdingCents,
    totalEmployerTaxCents,
    totalPeriodLiabilityCents,
  };
}
