import { ChartAccount } from '../types';

export interface XeroAccountRow {
  Code: string;
  Name: string;
  Type: string;
  TaxRate?: string;
}

/**
 * Converts Xero Chart of Accounts CSV export rows into LedgerFlow ChartAccounts.
 */
export function convertXeroAccounts(rows: XeroAccountRow[], workspaceId: string): ChartAccount[] {
  const typeMapping: Record<string, ChartAccount['type']> = {
    'BANK': 'asset',
    'CURRENT': 'asset',
    'FIXED': 'asset',
    'CURRLIAB': 'liability',
    'TERMLIAB': 'liability',
    'EQUITY': 'equity',
    'REVENUE': 'income',
    'SALES': 'income',
    'DIRECTCOSTS': 'expense',
    'EXPENSE': 'expense',
    'OVERHEADS': 'expense'
  };

  return rows.map((r, idx) => ({
    id: `acc_xero_${r.Code || idx}`,
    uid: 'usr_import',
    workspaceId,
    code: r.Code || `99${idx}`,
    name: r.Name || 'Imported Xero Account',
    type: typeMapping[(r.Type || '').toUpperCase()] || 'expense',
    balanceCents: 0
  }));
}
