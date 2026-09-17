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

export interface PricingTier {
  id: string;
  name: string;
  monthlyPriceUsd: number;
  description: string;
  recommended?: boolean;
  features: string[];
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Community / Starter',
    monthlyPriceUsd: 0,
    description: 'Essential single-workspace ledger and manual journal entry suite',
    features: ['1 Workspace', 'Standard Double-Entry Ledger', 'CSV Data Exports', 'Basic Financial Reports']
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPriceUsd: 49,
    description: 'Automated bank matching, invoicing, and bill management',
    recommended: true,
    features: ['Up to 5 Workspaces', 'MT940 & CAMT.053 Parsers', 'AI Receipt Auto-Matching', 'Automated Dunning Rules']
  },
  {
    id: 'pro',
    name: 'Professional',
    monthlyPriceUsd: 149,
    description: 'Multi-currency, tax set-aside, and fixed asset depreciation',
    features: ['Unlimited Workspaces', 'Multi-Currency Revaluation', 'Fixed Asset Depreciation Register', 'Xero / Quickbooks COA Import']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPriceUsd: 499,
    description: 'Forensic audit hash chaining, intercompany elimination & SLAs',
    features: ['Dedicated Firestore Instance', 'SHA-256 Audit Chain Verification', 'Intercompany Consolidation Engine', '24/7 Dedicated Support']
  }
];

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
