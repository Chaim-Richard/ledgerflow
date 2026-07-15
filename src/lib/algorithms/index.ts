import { DEEP_MATH_ALGORITHMS } from './deep-math';
import { AlgorithmDefinition } from './types';
import { multidimensionalMatrix } from './multidimensional-matrix';
import { heuristicPipeline } from './heuristic-pipeline';
import { assetAmortizer } from './asset-amortizer';
import { altmanZScore } from './altman-z-score';
import { liquidityProjection } from './liquidity-projection';
import { generateGenericAlgorithms } from './generic-algorithms';
import { ERP_MODELS } from './erp-models';
import { ADVANCED_STOCHASTIC_MODELS, SECURITY_ALGORITHMS } from './advanced-stochastic';

export * from './types';

// ==========================================
// ALGORITHM REGISTRY - ADD NEW TOOLS HERE
// ==========================================
// Import your new algorithm file above, then add it to this dictionary.
// The ToolCatalog and IntelligenceCenter will automatically pick it up.

export const FINANCIAL_ALGORITHMS: Record<string, AlgorithmDefinition> = {
  '1': multidimensionalMatrix,
  '2': heuristicPipeline,
  '3': assetAmortizer,
  '22': altmanZScore,
  '4': liquidityProjection,
  ...generateGenericAlgorithms(),
  'dm_0': DEEP_MATH_ALGORITHMS[0],
  'dm_1': DEEP_MATH_ALGORITHMS[1],
  'dm_2': DEEP_MATH_ALGORITHMS[2],
  'dm_3': DEEP_MATH_ALGORITHMS[3],
  'dm_4': DEEP_MATH_ALGORITHMS[4],
  'dm_5': DEEP_MATH_ALGORITHMS[5],
  'erp_0': ERP_MODELS[0],
  'erp_1': ERP_MODELS[1],
  'erp_2': ERP_MODELS[2],
  'erp_3': ERP_MODELS[3],
  'adv_0': ADVANCED_STOCHASTIC_MODELS[0],
  'adv_1': ADVANCED_STOCHASTIC_MODELS[1],
  'adv_2': ADVANCED_STOCHASTIC_MODELS[2],
  'sec_0': SECURITY_ALGORITHMS[0],
  'sec_1': SECURITY_ALGORITHMS[1],
  'sec_2': SECURITY_ALGORITHMS[2],
  'sec_3': SECURITY_ALGORITHMS[3],
};
