import { EvaluationSample } from '../../lib/algorithms';

/**
 * Standard Multi-Merchant Benchmark Evaluation Dataset
 * Representative collection of real-world noisy statement lines:
 * - Store numbering variants (#0451, STORE 1234, 1234 PARAMUS NJ)
 * - Payment gateway prefixes (SQ*, TST*, PAYPAL*, CHECKCARD)
 * - Trailing arbitrary order/auth references (AMAZON.COM*RT4G9, SHELL OIL 57442136)
 * - Merchant typo/spacing deformities (SHOPRIT E)
 * - Multi-category merchant distributions
 */
export const MERCHANT_BENCHMARK_SET: EvaluationSample[] = [
  // Groceries / Supermarket
  { text: 'SHOPRITE', expectedCategory: 'Groceries' },
  { text: 'SHOPRITE#0451', expectedCategory: 'Groceries' },
  { text: 'SHOPRITE #1234 PARAMUS NJ', expectedCategory: 'Groceries' },
  { text: 'SHOPRIT E 1234', expectedCategory: 'Groceries' },
  { text: 'WAL-MART #1234', expectedCategory: 'Groceries' },
  { text: 'WMT SUPERCENTER #4582 BENTONVILLE AR', expectedCategory: 'Groceries' },
  { text: 'TRADER JOE #542 AUSTIN TX', expectedCategory: 'Groceries' },
  { text: 'WHOLE FOODS MKT #1024 SEATTLE WA', expectedCategory: 'Groceries' },
  { text: 'KROGER #924 CINCINNATI OH', expectedCategory: 'Groceries' },
  { text: 'COSTCO WHSE #0482', expectedCategory: 'Groceries' },

  // Office & Supplies
  { text: 'AMZN*MKTPLACE US*2H45L', expectedCategory: 'Office Supplies' },
  { text: 'AMAZON.COM*RT4G9', expectedCategory: 'Office Supplies' },
  { text: 'STAPLES #0821 FRAMINGHAM MA', expectedCategory: 'Office Supplies' },
  { text: 'DEPOT OFFICE SUPPLIES #229', expectedCategory: 'Office Supplies' },

  // Fuel & Transportation
  { text: 'SHELL OIL 57442136', expectedCategory: 'Fuel' },
  { text: 'CHEVRON 0092415 HOUSTON TX', expectedCategory: 'Fuel' },
  { text: 'EXXONMOBIL 9823412', expectedCategory: 'Fuel' },
  { text: 'UBER TRIP 2948 HELP.UBER.COM', expectedCategory: 'Travel & Meals' },
  { text: 'LYFT *RIDE 4821 SAN FRANCISCO CA', expectedCategory: 'Travel & Meals' },

  // Software & Cloud Subscriptions
  { text: 'MSFT*OFFICE 365 E5 REDMOND WA', expectedCategory: 'Software Subscriptions' },
  { text: 'GOOGLE *WORKSPACE GSUITE CC', expectedCategory: 'Software Subscriptions' },
  { text: 'SLACK TECHNOLOGIES SAN FRANCISCO CA', expectedCategory: 'Software Subscriptions' },
  { text: 'GITHUB INC SAN FRANCISCO CA', expectedCategory: 'Software Subscriptions' },

  // Utilities & Communication
  { text: 'VERIZON WIRELESS PMT', expectedCategory: 'Utilities' },
  { text: 'AT&T MOBILITY AUTOPAY', expectedCategory: 'Utilities' }
];

export const MERCHANT_TRAINING_CORPUS = [
  { text: 'SHOPRITE SUPERMARKET FOOD', category: 'Groceries' },
  { text: 'WALMART SUPERCENTER GROCERY STORE FOOD', category: 'Groceries' },
  { text: 'TRADER JOES ORGANIC GROCERIES MARKET', category: 'Groceries' },
  { text: 'WHOLE FOODS MARKET FRESH PRODUCE', category: 'Groceries' },
  { text: 'KROGER GROCERY STORE PRODUCE', category: 'Groceries' },
  { text: 'COSTCO WHOLESALE BULK FOOD GROCERIES', category: 'Groceries' },
  
  { text: 'AMAZON MKTPLACE OFFICE SUPPLIES PAPER PENS', category: 'Office Supplies' },
  { text: 'AMAZON RETAIL DESK CHAIR SUPPLIES', category: 'Office Supplies' },
  { text: 'STAPLES OFFICE SUPPLIES PRINTER TONER', category: 'Office Supplies' },
  { text: 'OFFICE DEPOT PAPER BINDERS DESK', category: 'Office Supplies' },

  { text: 'SHELL OIL GAS STATION FUEL DIESEL', category: 'Fuel' },
  { text: 'CHEVRON GAS STATION FUEL PUMP', category: 'Fuel' },
  { text: 'EXXONMOBIL GASOLINE FUEL SERVICE', category: 'Fuel' },
  { text: 'UBER TRIP TRANSPORTATION TAXI RIDE', category: 'Travel & Meals' },
  { text: 'LYFT RIDE FARE TRANSPORTATION', category: 'Travel & Meals' },

  { text: 'MICROSOFT OFFICE 365 SOFTWARE CLOUD LICENSE', category: 'Software Subscriptions' },
  { text: 'GOOGLE WORKSPACE CLOUD SOFTWARE SUBSCRIPTION', category: 'Software Subscriptions' },
  { text: 'SLACK TECHNOLOGIES SUBSCRIPTION TEAM CHAT', category: 'Software Subscriptions' },
  { text: 'GITHUB ENTERPRISE CODE REPO SOFTWARE', category: 'Software Subscriptions' },

  { text: 'VERIZON WIRELESS PHONE INTERNET UTILITIES', category: 'Utilities' },
  { text: 'ATT MOBILITY CELLULAR TELECOMMUNICATION', category: 'Utilities' }
];
