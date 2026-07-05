export interface ScheduleCategory {
  code: string;
  name: string;
  irsDeductibilityRate: number; // e.g. 1.0 for 100%, 0.5 for 50%, 0.0 for 0%
  description: string;
  potentialMishapWarning?: string;
}

export const SCHEDULE_C_CATEGORIES: Record<string, ScheduleCategory> = {
  'Advertising': {
    code: 'AD',
    name: 'Advertising & Marketing',
    irsDeductibilityRate: 1.0,
    description: '100% deductible for business promotion, online ads, pamphlets, and sponsorships.'
  },
  'Meals': {
    code: 'MEALS',
    name: 'Business Meals (Client / Travel)',
    irsDeductibilityRate: 0.5,
    description: 'Generally 50% deductible under standard IRC guidelines. Must document the business purpose and attendees.',
    potentialMishapWarning: 'Make sure not to categorize client-only entertainment here, only the actual food/beverages!'
  },
  'Entertainment': {
    code: 'ENT',
    name: 'Entertainment (Client Events)',
    irsDeductibilityRate: 0.0,
    description: '0% deductible under modern TCJA tax laws. Pure entertainment events are non-deductible.',
    potentialMishapWarning: 'IRS completely disallows client entertainment. Consider reclassifying as team-building or purely educational meals!'
  },
  'Office': {
    code: 'OFFICE',
    name: 'Office Expenses & Equipment',
    irsDeductibilityRate: 1.0,
    description: '100% deductible for office supplies, small software subscriptions, and stationery.'
  },
  'Rent': {
    code: 'RENT',
    name: 'Rent or Lease (Vehicle / Property)',
    irsDeductibilityRate: 1.0,
    description: '100% deductible. Includes office rentals, co-working desks, and leased vehicles for business travel.'
  },
  'Travel': {
    code: 'TRAVEL',
    name: 'Business Travel & Lodging',
    irsDeductibilityRate: 1.0,
    description: '100% deductible for flights, hotels, taxi/rideshare fares, and tolls accumulated during business trips.'
  },
  'Utilities': {
    code: 'UTILITIES',
    name: 'Utilities (Electricity / internet)',
    irsDeductibilityRate: 1.0,
    description: '100% deductible for commercial locations. Sourced home office internet depends on square footage split proportions.'
  },
  'Wages': {
    code: 'WAGES',
    name: 'Salaries & Contract Labor',
    irsDeductibilityRate: 1.0,
    description: '100% deductible. Wage payouts, payroll taxes, and independent contractor 1099 disbursements.'
  },
  'Legal': {
    code: 'LEGAL',
    name: 'Professional & Legal Services',
    irsDeductibilityRate: 1.0,
    description: '100% deductible. CPA auditing fees, legal counsels, business filings, and consulting services.'
  },
  'Insurance': {
    code: 'INSURANCE',
    name: 'Business Insurance Premiums',
    irsDeductibilityRate: 1.0,
    description: '100% deductible. Liability coverages, professional indemnity, and workers compensation.'
  }
};

/**
 * Checks an account or description and attempts to map it automatically 
 * to a standardized Schedule C category.
 */
export function resolveScheduleCCategory(accountName: string, description: string = ''): ScheduleCategory | null {
  const nameLower = accountName.toLowerCase();
  const descLower = description.toLowerCase();

  if (nameLower.includes('meal') || descLower.includes('restaurant') || descLower.includes('cafe') || descLower.includes('dining')) {
    return SCHEDULE_C_CATEGORIES['Meals'];
  }
  if (nameLower.includes('entertainment') || descLower.includes('concert') || descLower.includes('stadium') || descLower.includes('golf')) {
    return SCHEDULE_C_CATEGORIES['Entertainment'];
  }
  if (nameLower.includes('adver') || nameLower.includes('marketing') || nameLower.includes('promo') || descLower.includes('google ads') || descLower.includes('facebook ads')) {
    return SCHEDULE_C_CATEGORIES['Advertising'];
  }
  if (nameLower.includes('office') || nameLower.includes('supplies') || nameLower.includes('photocopy')) {
    return SCHEDULE_C_CATEGORIES['Office'];
  }
  if (nameLower.includes('rent') || nameLower.includes('lease') || descLower.includes('wework')) {
    return SCHEDULE_C_CATEGORIES['Rent'];
  }
  if (nameLower.includes('travel') || nameLower.includes('flight') || nameLower.includes('hotel') || descLower.includes('uber') || descLower.includes('delta')) {
    return SCHEDULE_C_CATEGORIES['Travel'];
  }
  if (nameLower.includes('utility') || nameLower.includes('electric') || nameLower.includes('internet') || descLower.includes('comcast')) {
    return SCHEDULE_C_CATEGORIES['Utilities'];
  }
  if (nameLower.includes('wage') || nameLower.includes('payroll') || nameLower.includes('salary') || nameLower.includes('labor') || descLower.includes('contractor')) {
    return SCHEDULE_C_CATEGORIES['Wages'];
  }
  if (nameLower.includes('legal') || nameLower.includes('attorney') || nameLower.includes('audit') || nameLower.includes('consult')) {
    return SCHEDULE_C_CATEGORIES['Legal'];
  }
  if (nameLower.includes('insur') || nameLower.includes('premium')) {
    return SCHEDULE_C_CATEGORIES['Insurance'];
  }

  return null;
}

export interface ExpenseDeductibilityCalculation {
  rawAmountCents: number;
  deductibleAmountCents: number;
  nonDeductibleAmountCents: number;
  category: ScheduleCategory;
}

/**
 * Calculates total deductible amount for corporate expenses
 */
export function computeExpenseDeductibility(
  accountName: string, 
  amountCents: number, 
  description: string = ''
): ExpenseDeductibilityCalculation {
  const cat = resolveScheduleCCategory(accountName, description) || {
    code: 'MISC',
    name: 'Miscellaneous Deductibles',
    irsDeductibilityRate: 1.0,
    description: 'Standard deductible business expense.'
  };

  const roundedCents = Math.abs(amountCents);
  const deductibleAmountCents = Math.round(roundedCents * cat.irsDeductibilityRate);
  const nonDeductibleAmountCents = roundedCents - deductibleAmountCents;

  return {
    rawAmountCents: roundedCents,
    deductibleAmountCents,
    nonDeductibleAmountCents,
    category: cat
  };
}
