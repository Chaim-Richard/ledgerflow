export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

export const TAX_CODES = {
  STANDARD: 0.20,
  REDUCED: 0.05,
  ZERO: 0.0,
  EXEMPT: 0.0
};

export const ACCOUNT_TYPES = [
  'asset', 'liability', 'equity', 'revenue', 'expense', 'cost_of_goods'
];

export const ASSET_CLASSES = [
  'equipment', 'furniture', 'vehicles', 'buildings', 'land', 'intangible'
];

export const TRANSACTION_STATUSES = [
  'draft', 'pending', 'approved', 'failed', 'flagged', 'reconciled', 'void'
];
