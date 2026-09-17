export type FeatureFlag =
  | 'multi_currency_revaluation'
  | 'automated_dunning'
  | 'mt940_import'
  | 'ai_receipt_matching'
  | 'xero_migration'
  | 'forensic_hash_chaining';

export interface FeatureFlagConfig {
  enabled: boolean;
  minTier?: 'starter' | 'pro' | 'enterprise';
}

const DEFAULT_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  multi_currency_revaluation: { enabled: true, minTier: 'pro' },
  automated_dunning: { enabled: true, minTier: 'starter' },
  mt940_import: { enabled: true, minTier: 'pro' },
  ai_receipt_matching: { enabled: true, minTier: 'starter' },
  xero_migration: { enabled: true, minTier: 'starter' },
  forensic_hash_chaining: { enabled: true, minTier: 'enterprise' }
};

export function isFeatureEnabled(flag: FeatureFlag, userTier: 'starter' | 'pro' | 'enterprise' = 'pro'): boolean {
  const config = DEFAULT_FLAGS[flag];
  if (!config || !config.enabled) return false;

  const tierWeight = { starter: 1, pro: 2, enterprise: 3 };
  const userWeight = tierWeight[userTier] || 1;
  const minWeight = tierWeight[config.minTier || 'starter'];

  return userWeight >= minWeight;
}
