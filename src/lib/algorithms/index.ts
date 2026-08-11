import { AlgorithmDefinition } from './types';
import { MULTIDIMENSIONAL_MATRIX } from './multidimensional-matrix';
import { heuristicPipeline } from './heuristic-pipeline';
import { assetAmortizer } from './asset-amortizer';
import { ANOMALY_DETECTION_ALGO } from './anomaly-detection';
import { CATEGORIZATION_CONSISTENCY_ALGO } from './categorization-consistency';
import { SUBSET_SUM_RECONCILIATION } from './subset-sum';
import { RECURRENCE_DETECTION } from './recurrence';
import { TF_IDF_MATCHER } from './tf-idf';
import { FIND_MY_ERROR_ALGO } from './find-my-error';
import { RULE_INDUCTION_ALGO } from './rule-induction';
import { FENWICK_TIME_TRAVEL_ALGO } from './fenwick';
import { BENFORDS_LAW_ALGO } from './benfords-law';
import { DUPLICATE_DETECTION_ALGO } from './duplicate-detection';

import { CASH_RUNWAY_ALGO } from './cash-runway';
import { CAPITAL_BUDGETING_ALGO } from './capital-budgeting';
import { EXPENSE_POLICY_ALGO } from './expense-policy-violator';
import { VENDOR_CHURN_ALGO } from './vendor-churn';
import { EXPENSE_VELOCITY_ALGO } from './expense-velocity';
import { PARETO_ANALYSIS_ALGO } from './pareto-analysis';

// New Easy-Mode & Moat Algorithms
import { AUTO_SETUP_ALGO } from './auto-setup';
import { NL_PARSER_ALGO } from './nl-parser';
import { TAX_SET_ASIDE_ALGO } from './tax-set-aside';
import { RECEIPT_CAPTURE_ALGO } from './receipt-capture';
import { NUMBER_EXPLAINER_ALGO } from './number-explainer';
import { LOCALIZED_FORENSICS_ALGO } from './localized-forensics';
import { CONTINUOUS_CLOSE_ALGO } from './continuous-close';
import { CROSS_DIMENSION_INFERENCE_ALGO } from './cross-dimension-inference';
import { SHARED_TRANSACTION_IDENTITY_ALGO } from './shared-transaction-identity';
import { MONTE_CARLO_ALGO } from './monte-carlo';
import { ALTMAN_Z_SCORE_ALGO } from './altman-z-score';
import { CURRENCY_EXPOSURE_ALGO } from './currency-exposure';
import { VENDOR_CONCENTRATION_ALGO } from './vendor-concentration';
import { LIQUIDITY_STRESS_ALGO } from './liquidity-stress';
import { DUPONT_ANALYSIS_ALGO } from './dupont-analysis';
import { CASH_CONVERSION_CYCLE_ALGO } from './cash-conversion-cycle';
import { SAAS_UNIT_ECONOMICS_ALGO } from './saas-unit-economics';
import { PROFITABILITY_HEATMAP_ALGO } from './profitability-heatmap';
import { INTEREST_RATE_SENSITIVITY_ALGO } from './interest-rate-sensitivity';
import { CUSTOMER_CHURN_ALGO } from './customer-churn';
import { WORKING_CAPITAL_AGING_ALGO } from './working-capital-aging';

// Niche Daily Tools
import { 
  LOAN_AMORTIZATION_ALGO, 
  SUBSCRIPTION_AUDIT_ALGO, 
  DEDUCTION_FINDER_ALGO, 
  PROPERTY_PNL_ALGO, 
  RESTRICTED_FUND_ALGO, 
  PROJECT_PROFITABILITY_ALGO 
} from './niche-tools';

export * from './types';

export const FINANCIAL_ALGORITHMS: Record<string, AlgorithmDefinition> = {
  '1': MULTIDIMENSIONAL_MATRIX,
  '2': heuristicPipeline,
  '3': assetAmortizer,
  'forensics_1': ANOMALY_DETECTION_ALGO,
  'forensics_2': CATEGORIZATION_CONSISTENCY_ALGO,
  'recon_1': SUBSET_SUM_RECONCILIATION,
  'planning_2': RECURRENCE_DETECTION,
  'ops_2': TF_IDF_MATCHER,
  'forensics_3': FIND_MY_ERROR_ALGO,
  'ops_3': RULE_INDUCTION_ALGO,
  'system_1': FENWICK_TIME_TRAVEL_ALGO,
  'forensics_4': BENFORDS_LAW_ALGO,
  'forensics_5': DUPLICATE_DETECTION_ALGO,
  'forensics_6': EXPENSE_POLICY_ALGO,
  'planning_3': CASH_RUNWAY_ALGO,
  'planning_4': MONTE_CARLO_ALGO,
  'valuation_1': CAPITAL_BUDGETING_ALGO,
  'valuation_2': ALTMAN_Z_SCORE_ALGO,
  'treasury_1': CURRENCY_EXPOSURE_ALGO,
  'intelligence_4': VENDOR_CONCENTRATION_ALGO,
  'planning_5': LIQUIDITY_STRESS_ALGO,
  'valuation_3': DUPONT_ANALYSIS_ALGO,
  'ops_1': CASH_CONVERSION_CYCLE_ALGO,
  'planning_6': SAAS_UNIT_ECONOMICS_ALGO,
  'intelligence_5': PROFITABILITY_HEATMAP_ALGO,
  'treasury_2': INTEREST_RATE_SENSITIVITY_ALGO,
  'intelligence_6': CUSTOMER_CHURN_ALGO,
  'ops_6': WORKING_CAPITAL_AGING_ALGO,
  'ops_4': VENDOR_CHURN_ALGO,
  'ops_5': EXPENSE_VELOCITY_ALGO,
  'intelligence_3': PARETO_ANALYSIS_ALGO,
  
  // Ease & Simplicity Tools
  'ease_1': AUTO_SETUP_ALGO,
  'ease_2': NL_PARSER_ALGO,
  'ease_3': TAX_SET_ASIDE_ALGO,
  'ease_4': RECEIPT_CAPTURE_ALGO,
  'ease_5': NUMBER_EXPLAINER_ALGO,

  // Moat & Localized Intelligence
  'moat_1': LOCALIZED_FORENSICS_ALGO,
  'moat_2': CONTINUOUS_CLOSE_ALGO,
  'moat_3': CROSS_DIMENSION_INFERENCE_ALGO,
  'moat_4': SHARED_TRANSACTION_IDENTITY_ALGO,

  // Niche Daily Tools
  'niche_1': LOAN_AMORTIZATION_ALGO,
  'niche_2': SUBSCRIPTION_AUDIT_ALGO,
  'niche_3': DEDUCTION_FINDER_ALGO,
  'niche_4': PROPERTY_PNL_ALGO,
  'niche_5': RESTRICTED_FUND_ALGO,
  'niche_6': PROJECT_PROFITABILITY_ALGO,
};
