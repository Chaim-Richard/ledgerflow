import { ChartAccount, Transaction, Invoice, Bill } from '../types';

export interface XeroAccountRow {
  Code: string;
  Name: string;
  Type: string;
  TaxRate?: string;
}

export interface XeroInvoiceRow {
  InvoiceNumber: string;
  ContactName: string;
  Date: string;
  DueDate: string;
  UnitAmount: string;
  Quantity: string;
  AccountCode: string;
  TaxType?: string;
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
    code: r.Code || `99${idx}`,
    name: r.Name || 'Imported Xero Account',
    type: typeMapping[(r.Type || '').toUpperCase()] || 'expense',
    workspaceId
  }));
}
