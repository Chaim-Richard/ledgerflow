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
  'valuation_1': CAPITAL_BUDGETING_ALGO,
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
};
