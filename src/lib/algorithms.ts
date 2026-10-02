/** Public API for the financial algorithms; implementations live in algorithmInternals. */
export { seedPRNG, predictHoltWinters, fitPolynomialTrend, IsolationForest } from './algorithmInternals/forecasting';
export { findGlobalOptimalMatch, optimizedTransactionSimilarity, jaroWinklerSimilarity, lexicalSimilarity, AhoCorasick } from './algorithmInternals/similarity';
export { kMeans, sha256Sync, MerkleTree, KalmanFilter, MinHash, ComplianceEngine, BloomFilter, SpectralAnalyzer, RootOptimizer } from './algorithmInternals/optimization';
export type { BayesianClassifierOptions, EvaluationSample, EvaluationResultItem, BenchmarkMetrics } from './algorithmInternals/classification';
export { BayesianClassifier, evaluateClassifier, cosineSimilarity } from './algorithmInternals/classification';
export { AnomalyDetector, levenshteinDistance, SpellChecker, InvariantReconciliation, CausalExplorer, SmartMatchingEngine, OptionsEngine, MarkowitzOptimization, ARIMAModel, AnalyticalMatcher, FlowAnalyzer } from './algorithmInternals/advancedModels';
export type { MerchantIdentity } from './algorithmInternals/merchantIdentity';
export { normalizeMerchantIdentity, generateImportIdentity } from './algorithmInternals/merchantIdentity';
export * from './MatchingEngine';
export * from './StrategicExpertSystem';
