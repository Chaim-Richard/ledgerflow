import { CORE_BUSINESS_TEMPLATES } from './businessTemplatesCore';
import { INDUSTRY_BUSINESS_TEMPLATES } from './businessTemplatesIndustry';
import { EXTENDED_BUSINESS_TEMPLATES } from './businessTemplatesExtended';
import { ChartAccount, DashboardSchema } from '../types';

export interface BusinessTemplate {
  id: string;
  name: string;
  description: string;
  accounts: Partial<ChartAccount>[];
  topology: Partial<DashboardSchema>;
}

export const DEFAULT_EQUITY_ACCOUNTS: Partial<ChartAccount>[] = [
  { code: '3000', name: "Owner's Equity", type: 'equity', category: 'Equity' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', category: 'Equity' },
  { code: '3200', name: 'Opening Balance Equity', type: 'equity', category: 'Equity' },
];

export const DEFAULT_ROUNDING_ACCOUNT: Partial<ChartAccount> = {
  code: '8999',
  name: 'Foreign Exchange Gain/Loss & Rounding',
  type: 'expense',
  category: 'Rounding Differences',
  subtype: 'rounding',
  role: 'fx_rounding'
};

function ensureTemplateAccounts(accounts: Partial<ChartAccount>[]): Partial<ChartAccount>[] {
  const existingCodes = new Set(accounts.map(a => a.code));
  
  const enriched = [...accounts];
  if (!existingCodes.has('3000')) {
    enriched.push({ code: '3000', name: "Owner's Equity", type: 'equity', category: 'Equity' });
  }
  if (!existingCodes.has('3100')) {
    enriched.push({ code: '3100', name: 'Retained Earnings', type: 'equity', category: 'Equity' });
  }
  if (!existingCodes.has('3200')) {
    enriched.push({ code: '3200', name: 'Opening Balance Equity', type: 'equity', category: 'Equity' });
  }
  if (!existingCodes.has('8999') && !enriched.some(a => a.role === 'fx_rounding' || a.subtype === 'rounding')) {
    enriched.push(DEFAULT_ROUNDING_ACCOUNT);
  }
  return enriched;
}

const RAW_BUSINESS_TEMPLATES: Record<string, BusinessTemplate> = {
  ...CORE_BUSINESS_TEMPLATES,
  ...INDUSTRY_BUSINESS_TEMPLATES,
  ...EXTENDED_BUSINESS_TEMPLATES
};

export const BUSINESS_TEMPLATES: Record<string, BusinessTemplate> = Object.fromEntries(
  Object.entries(RAW_BUSINESS_TEMPLATES).map(([key, template]) => [
    key,
    {
      ...template,
      accounts: ensureTemplateAccounts(template.accounts)
    }
  ])
);
